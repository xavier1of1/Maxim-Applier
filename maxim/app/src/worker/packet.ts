import path from 'node:path';
import fs from 'node:fs/promises';
import {transaction} from '../server/db';
import {checkLease,finishWork,type WorkItem} from '../server/work';
import {candidateLock} from '../server/sources';
import {currentEvaluation,applicationFor} from '../server/application-material';
import {applicationWritable,queueApplicationProjection} from '../server/application-authority';
import {packetFacts} from '../server/packets';
import {retainedPdf} from '../server/evaluation-native';
import {artifactBytes,storeArtifact,cleanUncommitted,invocationDirectory,removeInvocation} from '../server/private-artifacts';
import {parseIsolated} from './extraction';
import {event} from '../server/commands';
import {digest} from '../server/auth';
import {DomainError,invariant} from '../server/errors';

const escape=(s:string)=>s.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
const value=(v:unknown)=>typeof v==='string'?v:Array.isArray(v)?v.join(', '):String(v);
export function normalizedPdfText(text:string){
 return text.replace(/[\u2013\u2014]/g,'-').replace(/[\u201C\u201D\u201E\u201F]/g,'"').replace(/[\u2018\u2019\u201A\u201B]/g,"'").replace(/\u2026/g,'...').replace(/[\u200B\u200C\u200D\u2060\uFEFF]/g,'').replace(/\s+/g,' ').trim();
}
export function packetHtml(facts:Record<string,any>[]){
 const name=value(facts.find(f=>f.field_key==='candidate.name')?.value||'');
 const groups=new Map<string,string[]>();
 const labels:Record<string,string>={candidate:'Contact',experience:'Experience',projects:'Projects',skills:'Skills',education:'Education',positioning:'Summary',achievements:'Achievements'};
 for(const f of facts.filter(f=>f.field_key!=='candidate.name')){
  const label=labels[f.field_key.split('.')[0]]||'Additional qualifications',items=groups.get(label)||[];
  items.push('<p>'+escape(value(f.value))+'</p>');groups.set(label,items);
 }
 const sections=[...groups].map(([label,items])=>'<section><h2>'+label+'</h2>'+items.join('')+'</section>').join('');
 const html='<!doctype html><html lang="en"><head><meta charset="utf-8"><style>@page{size:letter;margin:0.65in}body{font-family:Arial,sans-serif;color:#17241d;font-size:10pt;line-height:1.45;overflow-wrap:anywhere}h1{font-size:22pt;margin:0 0 16pt}h2{font-size:10pt;margin:14pt 0 6pt;color:#315e45;border-bottom:1px solid #ccd7ce;padding-bottom:3pt}p{white-space:pre-wrap;margin:0 0 7pt;orphans:3;widows:3}h2{break-after:avoid}p{break-inside:avoid}</style></head><body><h1>'+escape(name)+'</h1>'+sections+'</body></html>';
 invariant(!/\{\{[^}]+\}\}|<%|\b(?:TODO|TBD|PLACEHOLDER)\b|\[INSERT\b/i.test(html),'packet_placeholder','Selected evidence contains an unresolved placeholder. Correct it before PDF generation.');return html;
}
async function active(tx:import('pg').PoolClient,item:WorkItem){
 await candidateLock(tx,item.workspace_id);await applicationWritable(tx,item.workspace_id);await checkLease(tx,item);
 const e=await currentEvaluation(tx,item.workspace_id,String(item.input.evaluationId)),app=await applicationFor(tx,item.workspace_id,String(item.input.applicationId));
 invariant(app.status!=='archived','application_archived','Archived application packet work is withheld.',409);
 invariant(e.job_id===item.input.jobId&&app.job_id===e.job_id&&e.job_revision===item.input.jobRevision&&e.candidate_revision===item.input.candidateRevision,'packet_stale','Packet input changed before publication.',409);
 const facts=await packetFacts(tx,item.workspace_id,item.input.facts as {id:string;revision:number}[],Boolean(item.input.allowPrivate));
 const answers=item.input.answers as {useId:string;answerId:string;answerRevision:number}[];
 for(const a of answers){
  const valid=(await tx.query("SELECT 1 FROM answer_uses u JOIN answer_memory a ON a.id=u.answer_id AND a.workspace_id=u.workspace_id WHERE u.workspace_id=$1 AND u.id=$2 AND u.status='confirmed' AND a.id=$3 AND a.revision=$4 AND a.status='approved' AND a.expires_at>now()",[item.workspace_id,a.useId,a.answerId,a.answerRevision])).rowCount;
  invariant(valid,'answer_not_ready','Packet answer changed before publication.',409);
 }
 return {e,app,facts,answers};
}
export async function buildPacket(item:WorkItem,parent?:AbortSignal){
 const signal=AbortSignal.any([AbortSignal.timeout(75000),...(parent?[parent]:[])]),created:string[]=[];
 let committed=false,dir:string|undefined;
 try{
  const initial=await transaction(tx=>active(tx,item));dir=await invocationDirectory(item.id,item.lease_token);
  const html=packetHtml(initial.facts),input=path.join(dir,'resume.html'),output=path.join(dir,'resume.pdf');
  await fs.writeFile(input,html,{flag:'wx',mode:0o600});await retainedPdf(input,output,signal);
  const bytes=await fs.readFile(output);invariant(bytes.length<=10*1024*1024&&bytes.subarray(0,5).toString()==='%PDF-','pdf_invalid','Retained generator did not produce a bounded PDF.');
  const parsed=await parseIsolated('resume.pdf',bytes),text=normalizedPdfText(parsed.text);
  invariant(initial.facts.every(f=>text.includes(normalizedPdfText(value(f.value)))),'pdf_evidence_mismatch','Generated PDF lost or changed selected fact text; it is withheld.',409);
  await transaction(async tx=>{
   const {e,app,facts,answers}=await active(tx,item),report=await artifactBytes(tx,item.workspace_id,e.report_artifact_id,e.job_id);
   const pdf=await storeArtifact(tx,item.workspace_id,e.job_id,item.id+'-resume.pdf',bytes,'application/pdf',created);
   const evidence=facts.map(f=>({id:f.id,revision:f.revision,field_key:f.field_key,value:f.value,sourceId:f.source_id,sourceRevision:f.source_revision}));
   const binding={applicationId:app.id,evaluationId:e.id,jobRevision:e.job_revision,candidateRevision:e.candidate_revision,reportArtifactId:report.row.id,pdfArtifactId:pdf.id,reportHash:report.row.content_hash,pdfHash:pdf.content_hash,evidence,answers,untailored:Boolean(item.input.untailored),engineHash:e.input_snapshot.engine.hash};
   const hash=digest(JSON.stringify(binding));
   await tx.query('INSERT INTO application_packets(id,workspace_id,application_id,evaluation_id,job_revision,candidate_revision,report_artifact_id,pdf_artifact_id,report_hash,pdf_hash,evidence,answers,content_hash,untailored) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)',[item.id,item.workspace_id,app.id,e.id,e.job_revision,e.candidate_revision,report.row.id,pdf.id,report.row.content_hash,pdf.content_hash,JSON.stringify(evidence),JSON.stringify(answers),hash,Boolean(item.input.untailored)]);
   for(const f of facts)await tx.query("INSERT INTO fact_dependencies(workspace_id,fact_id,fact_revision,kind,entity_id) VALUES($1,$2,$3,'packet',$4)",[item.workspace_id,f.id,f.revision,item.id]);
   for(const a of answers)await tx.query("INSERT INTO answer_dependencies(workspace_id,answer_id,answer_revision,kind,entity_id) VALUES($1,$2,$3,'packet',$4)",[item.workspace_id,a.answerId,a.answerRevision,item.id]);
   await event(tx,{workspaceId:item.workspace_id},app.id,'application_packet_drafted',{packetId:item.id,contentHash:hash,pdfHash:pdf.content_hash,untailored:Boolean(item.input.untailored)});
   await queueApplicationProjection(tx,item.workspace_id);
   await finishWork(tx,item,{packetId:item.id,status:'draft',contentHash:hash,manifest:{...binding,evidence:evidence.map(f=>({id:f.id,revision:f.revision})),answers:answers.map(a=>({useId:a.useId,answerId:a.answerId,answerRevision:a.answerRevision})),htmlHash:digest(html),pdfTextVerified:true}});
  });committed=true;
 }catch(error){
  const code=error instanceof DomainError?error.code:'packet_unavailable';
  await transaction(async tx=>{await candidateLock(tx,item.workspace_id);await applicationWritable(tx,item.workspace_id);await checkLease(tx,item);await tx.query("UPDATE applications SET workflow='packet_missing',revision=revision+1,updated_at=now() WHERE workspace_id=$1 AND id=$2",[item.workspace_id,item.input.applicationId]);await finishWork(tx,item,{status:'failed',error:code,applicationId:item.input.applicationId});}).catch(()=>{});
  if(['lease_lost','packet_stale'].includes(code))throw error;
 }finally{if(!committed)await cleanUncommitted(created);if(dir)await removeInvocation(dir);}
}
