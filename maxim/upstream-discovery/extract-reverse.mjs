// Extract only the pinned inventory contract, never import the native scanner/writers.
import {readFileSync,writeFileSync} from 'node:fs';
import ts from '../app/node_modules/typescript/lib/typescript.js';
import {createHash} from 'node:crypto';
const file=new URL('../vendor/career-ops-discovery/scan-ats-full.mjs',import.meta.url),text=readFileSync(file,'utf8');
const ast=ts.createSourceFile('scan-ats-full.mjs',text,ts.ScriptTarget.Latest,true,ts.ScriptKind.JS);
const names=new Set(['DATASET_BASE','SINGLE_HOST_CONCURRENCY','PAYLOCITY_CONCURRENCY','JOIN_CONCURRENCY','SLUG_RE','WORKDAY_JUNK_TENANT_RE','entryOnHost','icimsHostCandidates','paylocityEntry','WORKABLE_FEED_PROVIDER','SOURCES']);
const selected=[];
for(const n of ast.statements){
 const name=ts.isFunctionDeclaration(n)?n.name?.text:ts.isVariableStatement(n)&&n.declarationList.declarations.length===1?n.declarationList.declarations[0].name.getText(ast):null;
 if(names.has(name))selected.push(n.getText(ast));
}
if(selected.length!==names.size)throw Error('Pinned reverse contract changed.');
let prelude=`// Generated from pinned scan-ats-full.mjs; SHA-256 ${createHash('sha256').update(text).digest('hex')}.\n// MIT license: ../vendor/career-ops-discovery/LICENSE. Do not hand-edit.\n`;
for(const p of ['greenhouse','lever','ashby','workday','icims','bamboohr','join'])prelude+=`import ${p} from '../vendor/career-ops-discovery/providers/${p}.mjs';\n`;
prelude+="import paylocity,{boardUrl as paylocityBoardUrl} from '../vendor/career-ops-discovery/providers/paylocity.mjs';\nimport {parseCompanySitemap} from '../vendor/career-ops-discovery/providers/join.mjs';\nimport {decodeEntities} from '../vendor/career-ops-discovery/providers/_html-entities.mjs';\nimport {WORKABLE_FEED_URL} from '../vendor/career-ops-discovery/providers/workable.mjs';\nconst workableFeedCache=()=>{throw Object.assign(new Error('Global Workable feed needs an explicit streaming budget.'),{code:'large_feed_deferred'});};\nconst loadWorkableFeed=workableFeedCache;\n";
writeFileSync(new URL('./reverse-contract.mjs',import.meta.url),prelude+selected.join('\n\n')+'\n');
console.log(JSON.stringify({extracted:selected.length,sourceSha256:createHash('sha256').update(text).digest('hex')}));
