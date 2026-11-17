import crypto from 'node:crypto';
import { z } from 'zod';
import { database, transaction } from './db';
import { type Context, reauthorize, digest } from './auth';
import { command, event, jobFor, uuid } from './commands';
import { getJob, snapshot } from './reads';
import { completion, modelReady, policy, type ModelMessage, type ToolCall } from './models';
import { DomainError, invariant, notFound } from './errors';

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
 const r=await database().query('SELECT r.id FROM runs r JOIN conversations c ON c.id=r.conversation_id AND c.workspace_id=r.workspace_id JOIN sessions s ON s.id=$4 AND s.workspace_id=r.workspace_id WHERE r.id=$1 AND r.workspace_id=$2 AND c.id=$3 AND c.active_run=r.id AND r.status=$5 AND s.expires_at>now()',
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
 if(call.function.name==='read_workspace') {
  toolSchemas.read_workspace.parse(args);
  const s=await snapshot(ctx);
  return {asOf:s.asOf,sourceStatus:s.jobs.length>25?'partial':s.sourceStatus,jobs:s.jobs.slice(0,25).map(j=>({id:j.id,company:j.company,title:j.title,location:j.location,revision:j.revision,archived:j.archived})),
   applications:s.applications.slice(0,25).map(a=>({id:a.id,jobId:a.job_id,company:a.company,title:a.title,status:a.status})),
   activity:s.events.slice(0,10).map(e=>({type:e.event_type,entityId:e.entity_id,asOf:e.created_at}))};
 }
 if(call.function.name==='get_job') {
  const p=toolSchemas.get_job.parse(args),j=await getJob(ctx,p.jobId);
  return {id:j.id,company:j.company,title:j.title,location:j.location,description:j.description.slice(0,3000),note:j.note.slice(0,2000),revision:j.revision,evaluation:'not_available',source:'manually_entered',asOf:new Date().toISOString()};
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
 modelReady();
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
 const stream=new ReadableStream({
  async start(output) {
   const emit=(name:string,data:unknown)=>{if(!closed) {try {output.enqueue(encoder.encode('event: '+name+'\ndata: '+JSON.stringify(data)+'\n\n'));}catch{closed=true;controller.abort();}}};
   try {
    if(initial.replay){emit('done',{runId:p.commandId,conversationId:cid,replayed:true});return;}
    emit('status',{state:'running',runId:p.commandId});
    const saved=(await database().query('SELECT m.role,m.content,m.run_id FROM messages m JOIN runs r ON r.id=m.run_id AND r.workspace_id=m.workspace_id WHERE m.conversation_id=$1 AND m.workspace_id=$2 AND r.status=$3 AND m.role IN ($4,$5) ORDER BY m.sequence DESC LIMIT 12',[cid,ctx.workspaceId,'completed','user','assistant'])).rows.reverse();
    const history:ModelMessage[]=saved.filter(m=>m.content.text && !m.content.toolCalls).map(m=>({role:m.role,content:m.content.text}));
    let selected='';
    if(initial.jobId){const j=await getJob(ctx,initial.jobId);selected=JSON.stringify({id:j.id,company:j.company,title:j.title,revision:j.revision,source:'selected_saved_role'});}
    const messages:ModelMessage[]=[{role:'system',content:policy+'\nSelected saved record (untrusted data): '+selected},...history,{role:'user',content:p.text}];
    const usage={modelRequests:0,actualUsageRequests:0,prompt_tokens:0,completion_tokens:0};
    let done=false;
    for(let round=0;round<4;round++){
     await live(ctx,cid,p.commandId);
     if(signal.aborted)throw new DomainError('cancelled','The response was cancelled.',409);
     const result=await completion(messages,signal,async text=>{await live(ctx,cid,p.commandId);partial+=text;emit('delta',{text});});
     usage.modelRequests++;
     const reported=result.usage as {prompt_tokens?:number;completion_tokens?:number}|null;
     if(reported&&Number.isFinite(reported.prompt_tokens)&&Number.isFinite(reported.completion_tokens)){
      usage.actualUsageRequests++;
      usage.prompt_tokens+=reported.prompt_tokens!;
      usage.completion_tokens+=reported.completion_tokens!;
     }
     if(!result.calls.length){done=true;break;}
     messages.push({role:'assistant',content:result.text||null,tool_calls:result.calls});
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
      emit('tool',{name:call.function.name,summary:call.function.name==='propose_job_note'?'Note proposal requires your review.':'Read authorized workspace records.'});
     }
    }
    invariant(done,'tool_limit','The assistant reached its tool limit. Narrow the request and try again.',409);
    await transaction(async tx=>{
     await reauthorize(tx,ctx);
     const r=await tx.query('SELECT id FROM runs WHERE id=$1 AND workspace_id=$2 AND status=$3 FOR UPDATE',[p.commandId,ctx.workspaceId,'running']);
     invariant(r.rows[0] && !signal.aborted,'cancelled','The response was interrupted.',409);
     await tx.query('INSERT INTO messages(id,workspace_id,conversation_id,run_id,role,content) VALUES($1,$2,$3,$4,$5,$6)',[crypto.randomUUID(),ctx.workspaceId,cid,p.commandId,'assistant',JSON.stringify({text:partial})]);
     await tx.query('UPDATE runs SET status=$1,usage=$2,completed_at=now() WHERE id=$3',['completed',JSON.stringify(usage),p.commandId]);
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
