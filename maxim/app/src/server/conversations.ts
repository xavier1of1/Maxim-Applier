import crypto from 'node:crypto';
import { z } from 'zod';
import { database, transaction } from './db';
import { type Context, reauthorize, digest } from './auth';
import { command, event, jobFor, uuid } from './commands';
import { getJob, snapshot } from './reads';
import { completion, modelReady, policy, type ModelMessage, type ToolCall } from './models';
import { DomainError, invariant, notFound } from './errors';
import {candidateContext,proposeConversationFact,assertDisclosureText} from './candidate-context';
import {recallAnswers} from './answer-recall';
import {answerCommand} from './answers';
import {validRefs,renderFactEvidence} from './answer-validity';
import {discoveryView,discoveryCommand} from './discovery';
import {applicationView} from './application-reads';
import {evaluationCommand} from './evaluations';
import {browserTool} from './browser/agent';
import {interviewTool} from './interview/agent';
import {gmailAgentView} from './integrations/gmail/reads';
import {networkingAgentRead} from './networking/reads';
import {discordView} from './integrations/discord';
import {scopedIntent} from './scoped-intent';

const controllers=new Map<string,AbortController>();
const toolSchemas = {
 read_workspace:z.object({}).strict(),
 get_job:z.object({jobId:uuid}).strict(),
 propose_job_note:z.object({jobId:uuid,expectedRevision:z.number().int().positive(),note:z.string().max(8000)}).strict(),
};
export async function createConversation(ctx:Context, raw:unknown) {
 const p=z.object({commandId:uuid,title:z.string().trim().min(1).max(120).optional(),jobId:uuid.optional()}).strict().parse(raw);
 return command(ctx,p.commandId,{action:'create_conversation',...p},async tx=>{
  if(p.jobId)await jobFor(tx,ctx,p.jobId);
  const id=crypto.randomUUID();
  const r=await tx.query('INSERT INTO conversations(id,workspace_id,title,job_id) VALUES($1,$2,$3,$4) RETURNING *',[id,ctx.workspaceId,p.title||'New conversation',p.jobId||null]);
  await event(tx,ctx,id,'conversation_created',{jobId:p.jobId||null});
  return r.rows[0];
 });
}
async function live(ctx:Context,cid:string,rid:string) {
 const r=await database().query("SELECT r.id FROM runs r JOIN conversations c ON c.id=r.conversation_id AND c.workspace_id=r.workspace_id JOIN sessions s ON s.id=$4 AND s.workspace_id=r.workspace_id JOIN candidates k ON k.workspace_id=r.workspace_id WHERE r.id=$1 AND r.workspace_id=$2 AND c.id=$3 AND c.active_run=r.id AND r.status=$5 AND s.expires_at>now() AND (r.candidate_revision IS NULL OR k.revision=r.candidate_revision AND k.ownership='canonical') AND NOT EXISTS(SELECT 1 FROM fact_dependencies d WHERE d.workspace_id=r.workspace_id AND d.entity_id=r.id AND d.status='invalidated') AND NOT EXISTS(SELECT 1 FROM answer_dependencies d WHERE d.workspace_id=r.workspace_id AND d.entity_id=r.id AND d.status='invalidated')",
 [rid,ctx.workspaceId,cid,ctx.sessionId,'running']);
 invariant(r.rows[0],'cancelled','This response is no longer active.',409);
}
async function addMessage(ctx:Context,cid:string,rid:string,role:string,content:unknown) {
 await database().query('INSERT INTO messages(id,workspace_id,conversation_id,run_id,role,content) VALUES($1,$2,$3,$4,$5,$6)',
 [crypto.randomUUID(),ctx.workspaceId,cid,rid,role,JSON.stringify(content)]);
}
async function invoke(ctx:Context,cid:string,rid:string,call:ToolCall) {
 await live(ctx,cid,rid);
 let args:unknown;
 try { args=JSON.parse(call.function.arguments); } catch { return {error:'invalid_arguments'}; }
 if(['read_application_assistance','fill_approved_application_fields'].includes(call.function.name))return browserTool(ctx,rid,call.function.name,args);
 if(['start_interview_practice','read_interview_practice'].includes(call.function.name))return interviewTool(ctx,rid,call.function.name,args);
 if(call.function.name==='read_gmail_evidence'){toolSchemas.read_workspace.parse(args);return gmailAgentView(ctx);}
 if(call.function.name==='read_networking')return networkingAgentRead(ctx,args);
 if(call.function.name==='read_notification_status'){
  toolSchemas.read_workspace.parse(args);const d=await discordView(ctx);
  return {enabled:d.settings.enabled,deliveries:d.notifications.map(n=>({id:n.id,kind:n.kind,status:n.status})).slice(0,10),view:'discord'};
 }
 if(call.function.name==='read_applications'){
  toolSchemas.read_workspace.parse(args);const d=await applicationView(ctx);
  return {asOf:d.asOf,partial:d.partial||d.applications.length>6,authority:d.authority.owner,applications:d.applications.slice(0,6).map(a=>{
   const e=d.evaluations.find(e=>e.job_id===a.job_id&&e.current),p=d.packets.find(p=>p.application_id===a.id&&p.status==='approved'&&p.current);
   return {id:a.id,jobId:a.job_id,jobRevision:a.job_revision,candidateRevision:d.candidate.revision,company:a.company,title:a.title,workflow:a.workflow,outcome:a.outcome,score:e?.score||null,tier:e?.tier||null,evaluationId:e?.id||null,packetApproved:Boolean(p),duplicateRisk:(d.duplicates[a.id] as {risk:string})?.risk||'unknown'};
  }),detailView:'applications',submissionAutomation:'not_implemented'};
 }
 if(call.function.name==='evaluate_job'){
  const p=z.object({jobId:uuid,expectedJobRevision:z.number().int().positive(),expectedCandidateRevision:z.number().int().positive(),quote:z.string().min(3).max(4000)}).strict().parse(args);
  const user=(await database().query("SELECT m.content,c.job_id FROM messages m JOIN conversations c ON c.workspace_id=m.workspace_id AND c.id=m.conversation_id WHERE m.workspace_id=$1 AND m.run_id=$2 AND m.role='user' ORDER BY m.sequence DESC LIMIT 1",[ctx.workspaceId,rid])).rows[0];
  invariant(scopedIntent(user?.content.text,p.quote,p.jobId,user?.job_id===p.jobId,'evaluate'),'explicit_request_required','Select the role and ask to evaluate this role, or specify its exact job UUID.');
  return evaluationCommand(ctx,{commandId:digest(rid+':evaluate:'+p.jobId).slice(0,8)+'-'+digest(rid+p.jobId).slice(8,12)+'-4'+digest(rid+p.jobId).slice(13,16)+'-a'+digest(rid+p.jobId).slice(17,20)+'-'+digest(rid+p.jobId).slice(20,32),action:'start_evaluation',payload:{jobId:p.jobId,expectedJobRevision:p.expectedJobRevision,expectedCandidateRevision:p.expectedCandidateRevision}});
 }
 if(call.function.name==='read_discovery'){
  toolSchemas.read_workspace.parse(args);const d=await discoveryView(ctx);
  return {asOf:d.asOf,coverage:d.coverage,partial:{...d.partial,toolSummary:d.sources.length>5||d.runs.length>3||d.attempts.length>3||d.jobs.length>5},sources:d.sources.slice(0,5).map(s=>({id:s.id,name:s.name,provider:s.provider,revision:s.revision,enabled:s.enabled,status:s.stale?'stale':s.status})),runs:d.runs.slice(0,3).map(r=>({id:r.id,revision:r.revision,status:r.status,counts:r.counts,terms:r.terms})),attempts:d.attempts.slice(0,3).map(a=>({runId:a.run_id,sourceId:a.source_id,status:a.status,error:a.error_code})),jobs:d.jobs.slice(0,5).map(j=>({id:j.id,revision:j.revision,title:j.title,company:j.company,state:j.discovery_state,eligibility:j.discovery_policy.eligibility,postedAt:j.posted_at})),detailView:'discovery'};
 }
 if(call.function.name==='start_job_search'||call.function.name==='set_discovery_state'){
  const user=(await database().query("SELECT content FROM messages WHERE workspace_id=$1 AND run_id=$2 AND role='user' ORDER BY sequence DESC LIMIT 1",[ctx.workspaceId,rid])).rows[0];
  const p=z.object({quote:z.string().min(3).max(4000)}).passthrough().parse(args);
  invariant(typeof user?.content.text==='string'&&user.content.text.includes(p.quote),'explicit_request_required','Quote the exact current user discovery instruction.');
  if(call.function.name==='start_job_search'){
   const q=z.object({quote:z.string(),sourceIds:z.array(uuid).min(1).max(3),terms:z.array(z.string().min(2).max(120)).min(1).max(10)}).strict().parse(args);
   invariant(/\b(search|find)\b/i.test(q.quote)&&q.terms.every(t=>q.quote.toLowerCase().includes(t.toLowerCase())),'explicit_request_required','Search terms must be present in the current user request.');
   return discoveryCommand(ctx,{commandId:crypto.randomUUID(),action:'start_search',payload:{sourceIds:q.sourceIds,terms:q.terms}});
  }
  const q=z.object({quote:z.string(),jobId:uuid,expectedRevision:z.number().int().positive(),state:z.enum(['saved','dismissed','none'])}).strict().parse(args);
  const verb=q.state==='saved'?/\bsave\b/i:q.state==='dismissed'?/\bdismiss\b/i:/\b(restore|unsave)\b/i;
  invariant(verb.test(q.quote)&&q.quote.includes(q.jobId),'explicit_request_required','Quote the action and exact job UUID from the current user request.');
  return discoveryCommand(ctx,{commandId:crypto.randomUUID(),action:'set_discovery_state',payload:{jobId:q.jobId,expectedRevision:q.expectedRevision,state:q.state}});
 }
 if(call.function.name==='read_workspace') {
  toolSchemas.read_workspace.parse(args);
  const s=await snapshot(ctx);
  return {asOf:s.asOf,sourceStatus:s.jobs.length>25?'partial':s.sourceStatus,jobs:s.jobs.slice(0,25).map(j=>({id:j.id,company:j.company,title:j.title,location:j.location,revision:j.revision,archived:j.archived})),
   applications:s.applications.slice(0,25).map(a=>({id:a.id,jobId:a.job_id,company:a.company,title:a.title,status:a.status})),
   activity:s.events.slice(0,10).map(e=>({type:e.event_type,entityId:e.entity_id,asOf:e.created_at}))};
 }
 if(call.function.name==='get_job') {
  const p=toolSchemas.get_job.parse(args),j=await getJob(ctx,p.jobId);
  assertDisclosureText(j.description+' '+j.note);
  const e=(await database().query("SELECT id,score,tier,status FROM evaluations WHERE workspace_id=$1 AND job_id=$2 ORDER BY created_at DESC LIMIT 1",[ctx.workspaceId,j.id])).rows[0];
  return {id:j.id,company:j.company,title:j.title,location:j.location,description:j.description.slice(0,3000),note:j.note.slice(0,2000),revision:j.revision,evaluation:e||null,source:j.opening_key?'discovered':'manually_entered',asOf:new Date().toISOString()};
 }
 if(call.function.name==='read_candidate_context'){
  toolSchemas.read_workspace.parse(args);
  return candidateContext(ctx,rid);
 }
 if(call.function.name==='propose_candidate_fact')return proposeConversationFact(ctx,rid,args);
 if(call.function.name==='recall_application_answer'){
  const p=z.object({question:z.string().max(2000),company:z.string().max(180),roleLane:z.string().max(120)}).strict().parse(args);
  return recallAnswers(ctx,{text:p.question,company:p.company,roleLane:p.roleLane},'model',rid);
 }
 if(call.function.name==='propose_application_answer'){
  const p=z.object({question:z.string().max(2000),company:z.string().max(180),roleLane:z.string().max(120),answer:z.string().min(1).max(4000),quote:z.string().min(1).max(4000)}).strict().parse(args);
  const user=(await database().query("SELECT content FROM messages WHERE workspace_id=$1 AND run_id=$2 AND role='user' ORDER BY sequence DESC LIMIT 1",[ctx.workspaceId,rid])).rows[0];
  invariant(typeof user?.content.text==='string'&&user.content.text.includes(p.quote)&&p.quote.includes(p.answer),'evidence_mismatch','Quote the exact current user answer.');
  const q=await answerCommand(ctx,{commandId:crypto.randomUUID(),action:'save_question',payload:{text:p.question,company:p.company,roleLane:p.roleLane}});
  const candidate=(await database().query('SELECT revision FROM candidates WHERE workspace_id=$1',[ctx.workspaceId])).rows[0];
  const a=await answerCommand(ctx,{commandId:crypto.randomUUID(),action:'draft_answer',payload:{questionId:q.id,text:p.answer,facts:[],expectedCandidateRevision:candidate.revision,permission:'never',modelConsent:false,sensitiveConsent:false}},rid);
  return {answerId:a.id,revision:a.revision,status:'draft',view:'answers',requiresHumanApproval:true,permission:'never'};
 }
 if(call.function.name==='draft_answer_from_facts'){
  const p=z.object({question:z.string().max(2000),company:z.string().max(180),roleLane:z.string().max(120),facts:z.array(z.object({id:uuid,revision:z.number().int().positive()}).strict()).min(1).max(5)}).strict().parse(args);
  const refs=[...new Map(p.facts.map(f=>[f.id,f])).values()].sort((a,b)=>a.id.localeCompare(b.id));
  const evidence=await transaction(async tx=>{await reauthorize(tx,ctx);return validRefs(tx,ctx.workspaceId,refs,true);});
  const q=await answerCommand(ctx,{commandId:crypto.randomUUID(),action:'save_question',payload:{text:p.question,company:p.company,roleLane:p.roleLane}});
  const candidate=(await database().query('SELECT revision FROM candidates WHERE workspace_id=$1',[ctx.workspaceId])).rows[0];
  const a=await answerCommand(ctx,{commandId:crypto.randomUUID(),action:'draft_answer',payload:{questionId:q.id,text:renderFactEvidence(evidence),facts:refs,expectedCandidateRevision:candidate.revision,permission:'never',modelConsent:false,sensitiveConsent:false}},rid,'facts');
  return {answerId:a.id,revision:a.revision,status:'draft',view:'answers',text:a.text,facts:refs,requiresHumanApproval:true,permission:'never'};
 }
 if(call.function.name==='propose_job_note') {
  const p=toolSchemas.propose_job_note.parse(args);
  return transaction(async tx=>{
   await reauthorize(tx,ctx);
   const run=await tx.query('SELECT id FROM runs WHERE id=$1 AND workspace_id=$2 AND status=$3 FOR UPDATE',[rid,ctx.workspaceId,'running']);
   invariant(run.rows[0],'cancelled','This response is no longer active.',409);
   const j=await jobFor(tx,ctx,p.jobId);
   invariant(j.revision===p.expectedRevision,'revision_conflict','The role changed. Refresh its revision before proposing a note.',409);
   const id=crypto.randomUUID();
   await tx.query('INSERT INTO proposals(id,workspace_id,session_id,job_id,run_id,expected_revision,note,expires_at) VALUES($1,$2,$3,$4,$5,$6,$7,now()+interval \'10 minutes\')',
    [id,ctx.workspaceId,ctx.sessionId,p.jobId,rid,p.expectedRevision,p.note]);
   return {proposalId:id,status:'pending_human_confirmation',jobId:j.id,company:j.company,title:j.title,expectedRevision:j.revision,note:p.note};
  });
 }
 return {error:'tool_not_allowed',message:'Only declared read and proposal tools are available. No confirmation, submission, file or shell tool exists.'};
}
export async function cancelConversation(ctx:Context,cid:string) {
 uuid.parse(cid);
 return transaction(async tx=>{
  await reauthorize(tx,ctx);
  const r=await tx.query('SELECT active_run FROM conversations WHERE id=$1 AND workspace_id=$2 FOR UPDATE',[cid,ctx.workspaceId]);
  if(!r.rows[0])throw notFound();
  const rid=r.rows[0].active_run;
  if(rid) {
   controllers.get(rid)?.abort();
   await tx.query('UPDATE runs SET status=$1,error_code=$2,completed_at=now() WHERE id=$3 AND workspace_id=$4 AND status=$5',['cancelled','cancelled',rid,ctx.workspaceId,'running']);
   await tx.query('UPDATE proposals SET status=$1 WHERE run_id=$2 AND workspace_id=$3 AND status=$4',['cancelled',rid,ctx.workspaceId,'pending']);
   await tx.query('UPDATE conversations SET active_run=null,lease_until=null WHERE id=$1 AND workspace_id=$2',[cid,ctx.workspaceId]);
  }
  return {cancelled:Boolean(rid)};
 });
}
export async function chatResponse(ctx:Context,cid:string,raw:unknown,requestSignal:AbortSignal) {
 uuid.parse(cid);
 const p=z.object({commandId:uuid,text:z.string().trim().min(1).max(4000)}).strict().parse(raw);
 assertDisclosureText(p.text);
 const connection=JSON.stringify(modelReady());
 const hash=digest(JSON.stringify({cid,text:p.text}));
 const initial=await transaction(async tx=>{
  await reauthorize(tx,ctx);
  const c=(await tx.query('SELECT * FROM conversations WHERE id=$1 AND workspace_id=$2 FOR UPDATE',[cid,ctx.workspaceId])).rows[0];
  if(!c)throw notFound();
  const prior=(await tx.query('SELECT * FROM runs WHERE id=$1 AND workspace_id=$2',[p.commandId,ctx.workspaceId])).rows[0];
  if(prior) {
   invariant(prior.payload_hash===hash,'idempotency_conflict','Message ID already used for different text.',409);
   invariant(prior.status==='completed','message_replay','This message already has a saved outcome. Send a new message to retry.',409);
   return {replay:true,jobId:c.job_id};
  }
  invariant(!c.active_run || new Date(c.lease_until).getTime()<Date.now(),'conversation_busy','A response is already in progress.',409);
  if(c.active_run) {
   await tx.query('UPDATE runs SET status=$1,error_code=$2,completed_at=now() WHERE id=$3 AND workspace_id=$4 AND status=$5',['failed','interrupted',c.active_run,ctx.workspaceId,'running']);
   await tx.query('UPDATE proposals SET status=$1 WHERE run_id=$2 AND workspace_id=$3 AND status=$4',['cancelled',c.active_run,ctx.workspaceId,'pending']);
  }
  await tx.query('INSERT INTO runs(id,workspace_id,conversation_id,payload_hash,status) VALUES($1,$2,$3,$4,$5)',[p.commandId,ctx.workspaceId,cid,hash,'running']);
  await tx.query('INSERT INTO messages(id,workspace_id,conversation_id,run_id,role,content) VALUES($1,$2,$3,$4,$5,$6)',
   [crypto.randomUUID(),ctx.workspaceId,cid,p.commandId,'user',JSON.stringify({text:p.text})]);
  await tx.query('UPDATE conversations SET active_run=$1,lease_until=now()+interval \'90 seconds\',updated_at=now(),title=CASE WHEN title=$2 THEN $3 ELSE title END WHERE id=$4 AND workspace_id=$5',
   [p.commandId,'New conversation',p.text.slice(0,72),cid,ctx.workspaceId]);
  return {replay:false,jobId:c.job_id};
 });
 const encoder=new TextEncoder(), controller=new AbortController();
 const signal=AbortSignal.any([controller.signal,requestSignal,AbortSignal.timeout(60000)]);
 controllers.set(p.commandId,controller);
 let partial='',closed=false;
 const accounting:unknown[]=[];
 const stream=new ReadableStream({
  async start(output) {
   const emit=(name:string,data:unknown)=>{if(!closed) {try {output.enqueue(encoder.encode('event: '+name+'\ndata: '+JSON.stringify(data)+'\n\n'));}catch{closed=true;controller.abort();}}};
   try {
    if(initial.replay){emit('done',{runId:p.commandId,conversationId:cid,replayed:true});return;}
    emit('status',{state:'running',runId:p.commandId});
    const saved=(await database().query("SELECT m.role,m.content,m.run_id FROM messages m JOIN runs r ON r.id=m.run_id AND r.workspace_id=m.workspace_id WHERE m.conversation_id=$1 AND m.workspace_id=$2 AND r.status=$3 AND m.role IN ($4,$5) AND NOT EXISTS(SELECT 1 FROM fact_dependencies d WHERE d.workspace_id=m.workspace_id AND d.entity_id=r.id AND d.status='invalidated') AND NOT EXISTS(SELECT 1 FROM answer_dependencies d WHERE d.workspace_id=m.workspace_id AND d.entity_id=r.id AND d.status='invalidated') AND NOT EXISTS(SELECT 1 FROM answer_memory a WHERE a.workspace_id=m.workspace_id AND a.origin_run=r.id AND (a.status<>'approved' OR a.model_consent=false)) AND NOT EXISTS(SELECT 1 FROM candidate_sources s WHERE s.workspace_id=m.workspace_id AND s.origin_run=r.id AND (s.model_consent=false OR s.deleted_at IS NOT NULL)) ORDER BY m.sequence DESC LIMIT 12",[cid,ctx.workspaceId,'completed','user','assistant'])).rows.reverse();
    const history:ModelMessage[]=saved.filter(m=>m.content.text && !m.content.toolCalls).map(m=>({role:m.role,content:m.content.text}));
    let selected='';
    if(initial.jobId){const j=await getJob(ctx,initial.jobId);selected=JSON.stringify({id:j.id,company:j.company,title:j.title,revision:j.revision,source:'selected_saved_role'});}
    const messages:ModelMessage[]=[{role:'system',content:policy+'\nSelected saved record (untrusted data): '+selected},...history,{role:'user',content:p.text}];
    const usage={modelRequests:0,actualUsageRequests:0,prompt_tokens:0,completion_tokens:0};
    let done=false;
    for(let round=0;round<4;round++){
     await live(ctx,cid,p.commandId);
     invariant(JSON.stringify(modelReady())===connection,'model_changed','Model settings changed. Start a new response.',409);
     if(signal.aborted)throw new DomainError('cancelled','The response was cancelled.',409);
     const result=await completion(messages,signal,async text=>{await live(ctx,cid,p.commandId);partial+=text;emit('delta',{text});});
     accounting.push({...result.accounting,providerUsage:result.usage});
     usage.modelRequests++;
     const reported=result.usage as {prompt_tokens?:number;completion_tokens?:number}|null;
     if(reported&&Number.isFinite(reported.prompt_tokens)&&Number.isFinite(reported.completion_tokens)){
      usage.actualUsageRequests++;
      usage.prompt_tokens+=reported.prompt_tokens!;
      usage.completion_tokens+=reported.completion_tokens!;
     }
     if(!result.calls.length){done=true;break;}
     messages.push({role:'assistant',content:result.text||null,tool_calls:result.calls,...(result.responseItems?{responseItems:result.responseItems}:{})});
     await addMessage(ctx,cid,p.commandId,'assistant',{text:result.text,toolCalls:result.calls});
     partial='';
     for(const call of result.calls){
      let value:unknown;
      try {value=await invoke(ctx,cid,p.commandId,call);}
      catch(e){if(e instanceof DomainError && e.code==='cancelled')throw e; value={error:e instanceof DomainError?e.code:'invalid_arguments'};}
      const content=JSON.stringify(value);
      invariant(Buffer.byteLength(content)<=12000,'tool_result_limit','The selected data exceeds this conversation budget.',413);
      messages.push({role:'tool',tool_call_id:call.id,content});
      await addMessage(ctx,cid,p.commandId,'tool',{name:call.function.name,text:content,toolCallId:call.id});
      const isDraft=['propose_job_note','propose_candidate_fact','propose_application_answer','draft_answer_from_facts'].includes(call.function.name);
      emit('tool',{name:call.function.name,summary:isDraft?'Draft requires human review. No approved knowledge was changed.':'Read authorized workspace records.'});
     }
    }
    invariant(done,'tool_limit','The assistant reached its tool limit. Narrow the request and try again.',409);
    await transaction(async tx=>{
     await reauthorize(tx,ctx);
     const r=await tx.query('SELECT id FROM runs WHERE id=$1 AND workspace_id=$2 AND status=$3 FOR UPDATE',[p.commandId,ctx.workspaceId,'running']);
     invariant(r.rows[0] && !signal.aborted,'cancelled','The response was interrupted.',409);
     await tx.query('INSERT INTO messages(id,workspace_id,conversation_id,run_id,role,content) VALUES($1,$2,$3,$4,$5,$6)',[crypto.randomUUID(),ctx.workspaceId,cid,p.commandId,'assistant',JSON.stringify({text:partial})]);
     await tx.query('UPDATE runs SET status=$1,usage=$2,completed_at=now(),context_accounting=$4 WHERE id=$3',['completed',JSON.stringify(usage),p.commandId,JSON.stringify(accounting)]);
     await tx.query('UPDATE conversations SET active_run=null,lease_until=null,updated_at=now() WHERE id=$1 AND workspace_id=$2 AND active_run=$3',[cid,ctx.workspaceId,p.commandId]);
    });
    emit('done',{runId:p.commandId,conversationId:cid});
   } catch(error) {
    const code=signal.aborted?'cancelled':error instanceof DomainError?error.code:'response_interrupted';
    const message=error instanceof DomainError?error.message:'The response was interrupted. Your records are unchanged.';
    if(!initial.replay)await transaction(async tx=>{
     await tx.query('UPDATE runs SET status=$1,error_code=$2,completed_at=now() WHERE id=$3 AND workspace_id=$4 AND status=$5',[code==='cancelled'?'cancelled':'failed',code,p.commandId,ctx.workspaceId,'running']);
     await tx.query('UPDATE proposals SET status=$1 WHERE run_id=$2 AND workspace_id=$3 AND status=$4',['cancelled',p.commandId,ctx.workspaceId,'pending']);
     await tx.query('UPDATE conversations SET active_run=null,lease_until=null WHERE id=$1 AND workspace_id=$2 AND active_run=$3',[cid,ctx.workspaceId,p.commandId]);
     await tx.query('INSERT INTO messages(id,workspace_id,conversation_id,run_id,role,content) VALUES($1,$2,$3,$4,$5,$6)',[crypto.randomUUID(),ctx.workspaceId,cid,p.commandId,'assistant',JSON.stringify({text:partial,error:code,interrupted:true})]);
    }).catch(()=>{});
    emit('error',{code,message});
   } finally {
    controllers.delete(p.commandId);
    if(!closed){closed=true;output.close();}
   }
  },
  cancel(){closed=true;controller.abort();}
 });
 return new Response(stream,{headers:{'Content-Type':'text/event-stream','Cache-Control':'no-store','X-Accel-Buffering':'no'}});
}
