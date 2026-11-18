import crypto from 'node:crypto';
import {z} from 'zod';
import {transaction} from './db';
import {reauthorize,type Context} from './auth';
import {candidateLock} from './sources';
import {validateFacts} from './domain';
import {event} from './commands';
import {invariant} from './errors';

export function assertDisclosureText(text:string){
 invariant(!/\b(?:internal use only|trade secret|confidential internal)\b|wabtec.{0,40}\b(?:confidential|proprietary|internal-only)\b/i.test(text),'restricted_source','Restricted employer content cannot be sent to the model.');
 invariant(!/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY|(?:sk-|ghp_)[A-Za-z0-9_-]{24,}/.test(text),'credential_forbidden','Credentials belong in protected Settings, not conversation or candidate sources.');
}
export async function candidateContext(ctx:Context,runId?:string,valueLimit=600){
 invariant(Number.isInteger(valueLimit)&&valueLimit>=600&&valueLimit<=8000,'context_bound','Candidate value budget is invalid.');
 return transaction(async tx=>{
  await reauthorize(tx,ctx);await candidateLock(tx,ctx.workspaceId);
  const candidate=(await tx.query('SELECT revision,ownership FROM candidates WHERE workspace_id=$1',[ctx.workspaceId])).rows[0];
  if(candidate.ownership!=='canonical')return {revision:candidate.revision,sourceStatus:'staging_not_active',facts:[],warnings:['Candidate knowledge is not the active authority. Review and activate it before reuse.']};
  if(runId)await tx.query("UPDATE runs SET candidate_revision=$1 WHERE workspace_id=$2 AND id=$3 AND status='running'",[candidate.revision,ctx.workspaceId,runId]);
  const rows=(await tx.query("SELECT f.id,f.field_key,f.value,f.revision,f.source_id,f.source_revision FROM candidate_facts f JOIN candidate_sources s ON s.workspace_id=f.workspace_id AND s.id=f.source_id WHERE f.workspace_id=$1 AND f.status='current' AND f.sensitivity='standard' AND s.model_consent=true AND s.classification<>'restricted' AND s.deleted_at IS NULL AND f.source_revision=s.revision ORDER BY f.field_key LIMIT 21",[ctx.workspaceId])).rows;
  const selected=rows.slice(0,20);
  const facts=selected.map(f=>({...f,value:Buffer.byteLength(JSON.stringify(f.value))<=valueLimit?f.value:null,valueOmitted:Buffer.byteLength(JSON.stringify(f.value))>valueLimit}));
  for(const f of facts)if(typeof f.value==='string')assertDisclosureText(f.value);
  const omitted=facts.some(f=>f.valueOmitted);
  const id=crypto.randomUUID(),content={id,revision:candidate.revision,sourceStatus:rows.length>20||omitted?'partial':facts.length?'fresh':'empty',facts,warnings:[...(rows.length>20?['Context is bounded to 20 fields.']:[]),...(omitted?['Whole fact values exceeding the byte budget are withheld, not summarized as approved evidence.']:[])]};
  await tx.query('INSERT INTO candidate_contexts(id,workspace_id,candidate_revision,content) VALUES($1,$2,$3,$4)',[id,ctx.workspaceId,candidate.revision,JSON.stringify(content)]);
  for(const f of selected)for(const entityId of [id,...(runId?[runId]:[])])await tx.query("INSERT INTO fact_dependencies(workspace_id,fact_id,fact_revision,kind,entity_id) VALUES($1,$2,$3,'context',$4) ON CONFLICT DO NOTHING",[ctx.workspaceId,f.id,f.revision,entityId]);
  return content;
 });
}
export async function proposeConversationFact(ctx:Context,runId:string,raw:unknown){
 const p=z.object({fieldKey:z.string().max(100),value:z.union([z.string(),z.boolean(),z.number(),z.array(z.string())]),quote:z.string().min(1).max(4000)}).strict().parse(raw);
 const fact=validateFacts([{field_key:p.fieldKey,value:p.value}])[0];
 return transaction(async tx=>{
  await reauthorize(tx,ctx);await candidateLock(tx,ctx.workspaceId);
  const run=(await tx.query("SELECT id FROM runs WHERE id=$1 AND workspace_id=$2 AND status='running' FOR UPDATE",[runId,ctx.workspaceId])).rows[0];
  invariant(run,'cancelled','The originating response is no longer active.',409);
  const user=(await tx.query("SELECT content FROM messages WHERE run_id=$1 AND workspace_id=$2 AND role='user' ORDER BY sequence DESC LIMIT 1",[runId,ctx.workspaceId])).rows[0];
  invariant(typeof user?.content.text==='string'&&user.content.text.includes(p.quote),'evidence_mismatch','Quote the exact current user declaration.');
  assertDisclosureText(p.quote);
  const backed=typeof p.value==='string'?p.quote.includes(p.value):Array.isArray(p.value)?p.value.every(v=>p.quote.includes(v)):p.quote.includes(String(p.value))||
   (p.fieldKey==='authorization.active_clearance'&&p.value===false&&/\b(?:no active clearance|do not have.{0,20}clearance|don't have.{0,20}clearance)\b/i.test(p.quote));
  invariant(backed,'evidence_mismatch','The proposed value needs an explicit matching declaration. Ask the user rather than infer it.');
  const hash=crypto.createHash('sha256').update(runId+':'+p.fieldKey+':'+p.quote).digest('hex');
  const prior=(await tx.query("SELECT p.id FROM fact_proposals p JOIN candidate_sources s ON s.id=p.source_id AND s.workspace_id=p.workspace_id WHERE p.workspace_id=$1 AND s.content_hash=$2 AND p.status='pending'",[ctx.workspaceId,hash])).rows[0];
  if(prior)return {proposalId:prior.id,status:'pending_human_review',view:'candidate'};
  const sourceId=crypto.randomUUID(),id=crypto.randomUUID();
  await tx.query("INSERT INTO candidate_sources(id,workspace_id,name,format,content_hash,classification,model_consent,status,extracted_text,origin_run) VALUES($1,$2,'Conversation declaration','manual',$3,'personal',false,'review_required',$4,$5)",[sourceId,ctx.workspaceId,hash,p.quote,runId]);
  const previous=(await tx.query('SELECT revision FROM candidate_facts WHERE workspace_id=$1 AND field_key=$2',[ctx.workspaceId,p.fieldKey])).rows[0];
  await tx.query('INSERT INTO fact_proposals(id,workspace_id,source_id,source_revision,field_key,value,quote,expected_fact_revision) VALUES($1,$2,$3,1,$4,$5,$6,$7)',[id,ctx.workspaceId,sourceId,p.fieldKey,JSON.stringify(fact.value),p.quote,previous?.revision||0]);
  await event(tx,ctx,id,'candidate_fact_proposed',{fieldKey:p.fieldKey,sourceId});
  return {proposalId:id,sourceId,status:'pending_human_review',fieldKey:p.fieldKey,value:fact.value,view:'candidate',futureModelConsent:false};
 });
}
