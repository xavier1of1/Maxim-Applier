// Mechanical, pinned source import. Never execute downloaded provider code here.
import {mkdir,writeFile,readFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import ts from '../app/node_modules/typescript/lib/typescript.js';

export const commit='194933aa111aa4f2fd3ffa69048347fa6a974d27';
export const destination=fileURLToPath(new URL('../vendor/career-ops-discovery/',import.meta.url));
const base=`https://raw.githubusercontent.com/career-ops-hq/career-ops/${commit}/`;
const roots=['LICENSE','docs/SUPPORTED_JOB_BOARDS.md','providers/README.md','scan-ats-full.mjs'];
const files=new Map(),pending=[],blocked=[];
async function get(url){const r=await fetch(url,{signal:AbortSignal.timeout(30000)});if(!r.ok)throw new Error(`Pinned source HTTP ${r.status}: ${url}`);return r;}
const listing=await(await get(`https://api.github.com/repos/career-ops-hq/career-ops/contents/providers?ref=${commit}`)).json();
for(const f of listing)if(f.type==='file'&&/\.(mjs|js)$/.test(f.name))roots.push(f.path);
const queue=f=>{if(!files.has(f)){files.set(f,null);pending.push(f);}};
roots.forEach(queue);
while(pending.length){
 const f=pending.shift(),s=await(await get(base+f)).text();files.set(f,s);
 if(!/\.(mjs|js)$/.test(f)||f==='scan-ats-full.mjs')continue;
 const source=ts.createSourceFile(f,s,ts.ScriptTarget.Latest,true,ts.ScriptKind.JS);
 function visit(n){
  const literal=(ts.isImportDeclaration(n)||ts.isExportDeclaration(n))?n.moduleSpecifier:
   ts.isCallExpression(n)&&n.expression.kind===ts.SyntaxKind.ImportKeyword?n.arguments[0]:null;
  if(literal&&ts.isStringLiteral(literal)&&literal.text.startsWith('.')){
   const dependency=path.posix.normalize(path.posix.join(path.posix.dirname(f),literal.text));
   if(dependency.startsWith('../')||!/[.](mjs|js|json)$/.test(dependency))blocked.push({file:f,dependency,reason:'outside-source-closure'});
   else queue(dependency);
  }
  ts.forEachChild(n,visit);
 }
 visit(source);
 if(files.size>350)throw new Error('Dependency closure exceeds reviewed 350-file bound.');
}
const hashes={};
for(const [f,s] of [...files].sort(([a],[b])=>a.localeCompare(b))){
 const target=path.join(destination,f);await mkdir(path.dirname(target),{recursive:true});await writeFile(target,s);
 hashes[f]=createHash('sha256').update(s).digest('hex');
}
const providers=[...files.keys()].filter(f=>/^providers\/[^_][^/]*\.mjs$/.test(f));
if(providers.length!==153)throw new Error(`Expected 153 providers, got ${providers.length}.`);
await writeFile(path.join(destination,'source-lock.json'),JSON.stringify({version:1,upstream:'https://github.com/career-ops-hq/career-ops',release:'1.40.0',commit,providers:providers.length,hashes,blocked},null,2)+'\n');
console.log(JSON.stringify({commit,providers:providers.length,files:files.size,bytes:[...files.values()].reduce((n,s)=>n+Buffer.byteLength(s),0),blocked}));
