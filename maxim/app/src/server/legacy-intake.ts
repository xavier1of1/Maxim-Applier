import fs from 'node:fs/promises';
import path from 'node:path';
import {DatabaseSync} from 'node:sqlite';
import {nativeRoot} from './projections';
import {digest} from './auth';
import {domain} from './domain';
import {invariant} from './errors';

export type RawFile={path:string;hash:string;bytes:number;base64:string};
export type LegacyRow={sourceKey:string;raw:Record<string,unknown>;normalized:Record<string,any>;issues:string[]};
export type LegacyBundle={version:1;files:RawFile[];sqlite:Record<string,unknown[]>;records:LegacyRow[];issues:string[];hash:string;counts:Record<string,number>};
const sha=async(b:Buffer)=>{const {createHash}=await import('node:crypto');return createHash('sha256').update(b).digest('hex');};
export async function nativePath(relative:string){
 invariant(relative&&!path.isAbsolute(relative)&&!relative.split(/[\\/]/).includes('..'),'legacy_path_refused','Legacy link is outside its fixed read scope.');
 const root=await fs.realpath(nativeRoot()).catch(()=>null);if(!root)return null;
 let cursor=root;
 for(const part of relative.split(/[\\/]/).filter(Boolean)){
  cursor=path.join(cursor,part);
  try{const stat=await fs.lstat(cursor);invariant(!stat.isSymbolicLink(),'legacy_path_refused','Linked legacy files/directories are refused.');}
  catch(e){if((e as NodeJS.ErrnoException).code==='ENOENT')return null;throw e;}
 }
 const actual=await fs.realpath(cursor);invariant(actual.startsWith(root+path.sep),'legacy_path_refused','Legacy path escaped its root.');return actual;
}
async function inventory(){
 const names=['data/applications.md','applications.md','data/pipeline.md','data/scan-history.tsv','data/maxim/maxim.db','data/maxim/maxim.db-wal'];
 for(const directory of ['reports','output','jds','batch/tracker-additions','data/maxim/events']){
  const root=await nativePath(directory);if(!root)continue;
  const visit=async(rel:string,depth:number)=>{
   invariant(depth<=4,'legacy_depth_limit','Legacy artifact nesting exceeds its import bound.');
   const target=await nativePath(rel);if(!target)return;
   for(const entry of await fs.readdir(/* turbopackIgnore: true */ target,{withFileTypes:true})){
    invariant(!entry.isSymbolicLink(),'legacy_path_refused','Linked legacy artifacts are refused.');
    const file=rel+'/'+entry.name;
    if(entry.isDirectory())await visit(file,depth+1);
    else if(/\.(?:md|pdf|html|txt|jsonl|tsv)$/i.test(entry.name))names.push(file);
    invariant(names.length<=2000,'legacy_file_limit','Legacy import exceeds 2,000 files; no partial cutover is accepted.');
   }
  };await visit(directory,0);
 }
 return [...new Set(names)].sort();
}
const plain=(v:unknown)=>v&&typeof v==='object'&&'sqliteInteger'in v?String((v as {sqliteInteger:string}).sqliteInteger):typeof v==='string'||typeof v==='number'?String(v):'';
export function legacyScore(v:unknown){
 const s=plain(v).trim(),match=s.match(/^([1-4](?:\.\d+)?|5(?:\.0+)?)(?:\s*\/\s*5)?$/);
 return match?Number(match[1]):null;
}
function status(value:unknown){
 const s=plain(value).trim().toLowerCase();
 return {raw:plain(value),suggested:s==='applied'||s==='submitted_manually'?'submitted':s==='responded'?'responded':s==='interview'?'interviewing':s==='offer'?'offer':s==='rejected'?'rejected':s==='discarded'?'withdrawn':'not_submitted'};
}
function normalize(raw:Record<string,any>,links:Record<string,string[]>={}){
 const get=(...keys:string[])=>{const key=Object.keys(raw).find(k=>keys.includes(k.toLowerCase()));return key?plain(raw[key]):'';};
 const company=get('company','employer'),title=get('role','title','position'),s=status(get('status','application status'));
 const urlField=Object.keys(raw).find(k=>['url','link','job_url'].includes(k.toLowerCase())),url=urlField?(links[urlField]?.[0]||plain(raw[urlField])):'';
 let validUrl:string|null=null;try{const u=new URL(url);if(u.protocol==='https:'&&!u.username&&!u.password)validUrl=u.href;}catch{}
 const artifactPaths=Object.keys(raw).flatMap(k=>links[k]||[]).filter(v=>!/^https?:/i.test(v));
 for(const key of ['report_path','pdf_path'])if(raw[key])artifactPaths.push(plain(raw[key]));
 const rawScore=get('score','career_ops_score');
 return {company,title,url:validUrl,location:get('location','location_text'),rawStatus:s.raw,suggestedOutcome:s.suggested,score:legacyScore(rawScore),rawScore,rawTier:get('tier'),appliedAt:get('applied_at','date','date submitted'),artifactPaths:[...new Set(artifactPaths)],requiresHumanOutcomeReview:true};
}
export async function collectLegacy():Promise<LegacyBundle>{
 const names=await inventory(),files:RawFile[]=[],issues:string[]=[],records:LegacyRow[]=[],sqlite:Record<string,unknown[]>={};
 let total=0;
 for(const name of names){
  const file=await nativePath(name);if(!file)continue;const stat=await fs.stat(/* turbopackIgnore: true */ file);
  invariant(stat.isFile()&&stat.size<=20*1024*1024,'legacy_file_limit','Legacy source exceeds the 20 MiB per-file limit.');
  const bytes=await fs.readFile(/* turbopackIgnore: true */ file);total+=bytes.length;
  invariant(total<=64*1024*1024,'legacy_total_limit','Legacy source bundle exceeds 64 MiB; no partial cutover is accepted.');
  files.push({path:name,hash:await sha(bytes),bytes:bytes.length,base64:bytes.toString('base64')});
  if(['data/applications.md','applications.md'].includes(name)){
   const text=new TextDecoder('utf-8',{fatal:true}).decode(bytes);
   const result=domain({operation:'parse_tracker',text}) as {tables:Record<string,any>[]};
   for(const table of result.tables){
    const headers=table.headers.map((h:{text:string})=>h.text);
    if(!headers.some((h:string)=>['company','employer'].includes(h.toLowerCase()))){issues.push(name+':unrecognized_table');continue;}
    const seen=new Set<string>();
    for(const row of table.rows){
     const raw:Record<string,unknown>={},links:Record<string,string[]>={};
     headers.forEach((h:string,i:number)=>{raw[h]=row.cells[i]?.text||'';links[h]=row.cells[i]?.links||[];});
     const ordinal=plain(raw['#']||raw.Num||raw.ID),key=name+':'+(ordinal||'line:'+row.line),rowIssues:string[]=[];
     if(seen.has(key))rowIssues.push('duplicate_legacy_key');seen.add(key);
     const normalized=normalize(raw,links);
     if(!normalized.company||!normalized.title)rowIssues.push('missing_identity');
     records.push({sourceKey:key,raw:{...raw,_line:row.line,_cells:row.cells},normalized,issues:rowIssues});
    }
   }
  }
  if(name==='data/pipeline.md'){
   for(const [i,line]of new TextDecoder('utf-8',{fatal:true}).decode(bytes).split(/\r?\n/).entries()){
    const value=line.trim().replace(/^[-*]\s+/,'');if(!value.startsWith('https://'))continue;
    try{const u=new URL(value);records.push({sourceKey:name+':line:'+i,raw:{line,number:i+1},normalized:{kind:'pipeline',company:'',title:'',url:u.href},issues:['pipeline_identity_review']});}catch{issues.push(name+':invalid_url_line:'+String(i+1));}
   }
  }
 }
 const dbFile=await nativePath('data/maxim/maxim.db');
 if(dbFile){
  const db=new DatabaseSync(dbFile,{readOnly:true,allowExtension:false,defensive:true,timeout:2000});
  try{
   db.exec('PRAGMA query_only=ON; BEGIN');
   const tables=db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name").all();
   invariant(tables.length<=100,'legacy_table_limit','Legacy SQLite has too many tables.');
   for(const table of tables){
    const name=String(table.name);invariant(/^[a-zA-Z0-9_]{1,100}$/.test(name),'legacy_schema_refused','Unexpected SQLite table identifier.');
    const statement=db.prepare('SELECT * FROM "'+name+'" LIMIT 10001');statement.setReadBigInts(true);
    const rows=statement.all().map(row=>Object.fromEntries(Object.entries(row).map(([k,v])=>[k,typeof v==='bigint'?{sqliteInteger:v.toString()}:v instanceof Uint8Array?{sqliteBlob:Buffer.from(v).toString('base64')}:v])));
    invariant(rows.length<=10000,'legacy_row_limit','Legacy SQLite table exceeds 10,000 rows; no partial import is accepted.');sqlite[name]=rows;
    if(name==='applications')for(const raw of rows){const n=normalize(raw);records.push({sourceKey:'sqlite:applications:'+plain(raw.id),raw,normalized:n,issues:!n.company||!n.title?['missing_identity']:[]});}
   }
   db.exec('COMMIT');
  }finally{db.close();}
 }
 const after=await inventory();
 invariant(JSON.stringify(names)===JSON.stringify(after),'legacy_changed','Legacy file inventory changed during capture; retry after writers finish.',409);
 for(const file of files){const target=await nativePath(file.path);invariant(target&&await sha(await fs.readFile(/* turbopackIgnore: true */ target))===file.hash,'legacy_changed','A legacy source changed during capture; nothing was imported.',409);}
 const seenKeys=new Set<string>();
 for(const row of records){
  if(seenKeys.has(row.sourceKey)){const original=row.sourceKey;row.issues.push('duplicate_legacy_key');row.normalized.originalSourceKey=original;row.sourceKey=original+':physical:'+digest(JSON.stringify(row.raw)).slice(0,16);let n=1;while(seenKeys.has(row.sourceKey))row.sourceKey=original+':duplicate:'+n++;}
  seenKeys.add(row.sourceKey);
 }
 const counts={files:files.length,bytes:total,records:records.length,sqliteTables:Object.keys(sqlite).length,sqliteRows:Object.values(sqlite).reduce((n,rows)=>n+rows.length,0),issues:issues.length+records.reduce((n,r)=>n+r.issues.length,0)};
 return {version:1,files,sqlite,records,issues,hash:digest(JSON.stringify(files.map(f=>({path:f.path,hash:f.hash})))),counts};
}
