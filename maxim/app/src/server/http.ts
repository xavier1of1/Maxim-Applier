import { z } from 'zod';
import { checkModelAccess,config,publicModelSettings,saveModelSettings,listModels } from './config';
import { database } from './db';
import { authenticate,checkOrigin,login,digest } from './auth';
import { executeCommand,resolveProposal,uuid } from './commands';
import { snapshot,getJob,getConversation } from './reads';
import { createConversation,cancelConversation,chatResponse } from './conversations';
import { uploadArtifact,downloadArtifact } from './artifacts';
import {uploadSource,candidateView,sourceView} from './sources';
import {candidateCommand} from './candidates';
import {authorityView,projectionPreview,cutoverCommand} from './projections';
import {importLegacyCandidate} from './candidate-import';
import {candidateContext} from './candidate-context';
import {answerCommand,answerLibrary,exportAnswers} from './answers';
import {recallAnswers} from './answer-recall';
import {discoveryCommand,discoveryView} from './discovery';
import {evaluationCommand} from './evaluations';
import {intelligenceCommand,intelligenceView} from './intelligence';
import {retentionCommand,retentionPreview,archiveView} from './intelligence-retention';
import {homeView} from './home';
import {applicationCommand} from './applications';
import {packetCommand} from './packets';
import {applicationView} from './application-reads';
import {legacyImportCommand,legacyView} from './legacy-import';
import {applicationCutoverCommand,applicationAuthorityView} from './application-cutover';
import {browserCommand,browserView} from './browser/service';
import {gmailCommand,beginGmailOAuth,completeGmailOAuth} from './integrations/gmail/service';
import {gmailView} from './integrations/gmail/reads';
import {discordCommand,discordPlan,discordView} from './integrations/discord';
import {networkingRoute} from './networking/routes';
import {interviewHttp} from './interview/http';
import { DomainError,invariant } from './errors';

const json=(value:unknown,status=200,headers:Record<string,string>={})=>Response.json(value,{status,headers:{'Cache-Control':'no-store',...headers}});
async function bytes(req:Request,max:number) {
 const len=Number(req.headers.get('content-length'));
 invariant(!Number.isFinite(len)||len<=max,'payload_too_large','Request exceeds its size limit.',413);
 const reader=req.body?.getReader();if(!reader)return new Uint8Array();
 const chunks:Uint8Array[]=[];let size=0;
 try {
  for(let i=0;i<100000;i++){
   const r=await reader.read();if(r.done)break;
   size+=r.value.byteLength;invariant(size<=max,'payload_too_large','Request exceeds its size limit.',413);chunks.push(r.value);
  }
 } finally {await reader.cancel().catch(()=>{});}
 return new Uint8Array(Buffer.concat(chunks));
}
async function body(req:Request) {
 invariant(req.headers.get('content-type')?.startsWith('application/json'),'invalid_content_type','JSON content is required.',415);
 try {return JSON.parse(new TextDecoder().decode(await bytes(req,262144)));}
 catch(e){if(e instanceof DomainError)throw e;throw new DomainError('invalid_json','Request body is not valid JSON.');}
}
export async function handle(req:Request) {
 try {
  const route=new URL(req.url).pathname.replace(/^\/api\/?/,'').split('/').filter(Boolean);
  const name=route.join('/'),post=req.method==='POST',get=req.method==='GET';
  if(get && name==='health') {
   const version=await database().query('SELECT version FROM schema_migrations WHERE version=16');
   invariant(version.rowCount,'schema_unavailable','Workspace schema is not initialized.',503);
   return json({ok:true,application:'maxim-apply',installation:digest(config().workspaceId).slice(0,16),database:'available',recordFreshness:'not_assessed'});
  }
  invariant(['GET','POST'].includes(req.method),'method_denied','Method not supported.',405);
  const c=config();
  invariant(req.headers.get('host')===new URL(c.origin).host,'host_denied','Request host denied.',403);
  if(get&&name==='gmail/callback'){
   const q=new URL(req.url).searchParams;let failed=false;
   try{await completeGmailOAuth({state:q.get('state')||'',...(q.has('code')?{code:q.get('code')!}:{}),...(q.has('error')?{error:q.get('error')!}:{})});}catch{failed=true;}
   return new Response(null,{status:303,headers:{Location:c.origin+'/maxim?view=gmail'+(failed?'&gmail=authorization_failed':''),'Cache-Control':'no-store','Referrer-Policy':'no-referrer'}});
  }
  if(post&&name==='auth/login') {
   checkOrigin(req);
   const p=z.object({accessKey:z.string().min(1).max(256)}).strict().parse(await body(req));
   const result=await login(p.accessKey);
   return json({authenticated:true,csrfToken:result.csrfToken},200,{'Set-Cookie':'maxim_session='+result.token+'; HttpOnly; SameSite=Strict; Path=/; Max-Age=43200'});
  }
  const ctx=await authenticate(req,post);
  if(get&&name==='session') {
   const workspace=(await database().query('SELECT id,name,is_owner FROM workspaces WHERE id=$1',[ctx.workspaceId])).rows[0];
   return json({authenticated:true,csrfToken:ctx.csrfToken,workspace,testMode:c.testMode});
  }
  if(post&&name==='auth/logout') {
   await database().query('UPDATE sessions SET expires_at=now() WHERE id=$1',[ctx.sessionId]);
   return json({ok:true},200,{'Set-Cookie':'maxim_session=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0'});
  }
  if(get&&name==='workspace'){const q=new URL(req.url).searchParams;return json(await snapshot(ctx,q.get('sort'),q.get('job'),q));}
  if(get&&name==='gmail')return json(await gmailView(ctx,Number(new URL(req.url).searchParams.get('offset')||0)));
  if(post&&name==='gmail/commands')return json({result:await gmailCommand(ctx,await body(req))});
  if(post&&name==='gmail/oauth')return json({result:await beginGmailOAuth(ctx,await body(req))});
  if(get&&name==='discord')return json(await discordView(ctx));
  if(post&&name==='discord/plan')return json({result:await discordPlan(ctx,await body(req))});
  if(post&&name==='discord/commands')return json({result:await discordCommand(ctx,await body(req))});
  if(route[0]==='networking')return (await networkingRoute(req,ctx))!;
  if(route[0]==='interview')return interviewHttp(req);
  if(get&&name==='browser')return json(await browserView(ctx));
  if(post&&name==='browser/commands')return json({result:await browserCommand(ctx,await body(req))});
  if(get&&name==='applications'){const q=new URL(req.url).searchParams;return json(await applicationView(ctx,{applicationId:q.get('application')||undefined,offset:q.has('offset')?Number(q.get('offset')):0}));}
  if(get&&name==='applications/authority')return json(await applicationAuthorityView(ctx));
  if(post&&name==='applications/cutover')return json({result:await applicationCutoverCommand(ctx,await body(req))});
  if(get&&name==='legacy'){const q=new URL(req.url).searchParams;return json(await legacyView(ctx,{importId:q.get('import')||undefined,offset:q.has('offset')?Number(q.get('offset')):0}));}
  if(post&&name==='legacy/commands')return json({result:await legacyImportCommand(ctx,await body(req))});
  if(get&&route[0]==='legacy'&&route[1]==='export'&&route.length===3){
   invariant(ctx.isOwner,'not_found','Record not found.',404);const id=uuid.parse(route[2]);
   const row=(await database().query('SELECT raw_bundle FROM legacy_imports WHERE workspace_id=$1 AND id=$2',[ctx.workspaceId,id])).rows[0];
   invariant(row,'not_found','Record not found.',404);
   return json(row.raw_bundle,200,{'Content-Disposition':'attachment; filename="maxim-legacy-import-'+id+'.json"'});
  }
  if(post&&name==='applications/commands')return json({result:await applicationCommand(ctx,await body(req))});
  if(post&&name==='evaluations/commands')return json({result:await evaluationCommand(ctx,await body(req))});
  if(get&&name==='intelligence')return json(await intelligenceView(ctx));
  if(post&&name==='intelligence/commands')return json({result:await intelligenceCommand(ctx,await body(req))});
  if(get&&name==='intelligence/cleanup')return json(await retentionPreview(ctx));
  if(post&&name==='intelligence/retention')return json({result:await retentionCommand(ctx,await body(req))});
  if(get&&name==='archive')return json(await archiveView(ctx,new URL(req.url).searchParams));
  if(get&&name==='home')return json(await homeView(ctx,new URL(req.url).searchParams));
  if(post&&name==='packets/commands')return json({result:await packetCommand(ctx,await body(req))});
  if(get&&name==='discovery')return json(await discoveryView(ctx,new URL(req.url).searchParams.get('sort')));
  if(post&&name==='discovery/commands')return json({result:await discoveryCommand(ctx,await body(req))});
  if(get&&name==='candidate')return json(await candidateView(ctx));
  if(get&&name==='answers')return json(await answerLibrary(ctx,new URL(req.url).searchParams.get('question')));
  if(get&&name==='answers/export')return json(await exportAnswers(ctx),200,{'Content-Disposition':'attachment; filename="maxim-answer-memory.json"'});
  if(post&&name==='answers/commands')return json({result:await answerCommand(ctx,await body(req))});
  if(post&&name==='answers/recall')return json(await recallAnswers(ctx,await body(req)));
  if(get&&name==='candidate/context')return json(await candidateContext(ctx));
  if(get&&name==='candidate/authority')return json(await authorityView(ctx));
  if(get&&name==='candidate/projection')return json(await projectionPreview(ctx));
  if(post&&name==='candidate/cutover')return json({result:await cutoverCommand(ctx,await body(req))});
  if(post&&name==='candidate/commands')return json({result:await candidateCommand(ctx,await body(req))});
  if(post&&name==='candidate/import-legacy')return json(await importLegacyCandidate(ctx,await body(req)));
  if(post&&name==='sources'){
   const data=await bytes(req,10*1024*1024+65536);
   const request=new Request(req.url,{method:'POST',headers:{'Content-Type':req.headers.get('content-type')||''},body:data});
   return json({source:await uploadSource(ctx,await request.formData())});
  }
  if(get&&route[0]==='sources'&&route.length===2)return json({source:await sourceView(ctx,route[1])});
  if(post&&name==='commands')return json({result:await executeCommand(ctx,await body(req))});
  if(get&&route[0]==='jobs'&&route.length===2)return json({job:await getJob(ctx,route[1])});
  if(post&&name==='conversations')return json({conversation:await createConversation(ctx,await body(req))});
  if(route[0]==='conversations'&&route[1]) {
   const id=uuid.parse(route[1]);
   if(get&&route.length===2)return json(await getConversation(ctx,id));
   if(post&&route[2]==='messages'&&route.length===3)return await chatResponse(ctx,id,await body(req),req.signal);
   if(post&&route[2]==='cancel'&&route.length===3)return json(await cancelConversation(ctx,id));
  }
  if(post&&route[0]==='proposals'&&route.length===3&&['confirm','reject'].includes(route[2])) {
   const p=z.object({commandId:uuid}).strict().parse(await body(req));
   return json({result:await resolveProposal(ctx,route[1],p.commandId,route[2]==='confirm'?'confirmed':'rejected')});
  }
  if(post&&name==='settings/model') {
   invariant(ctx.isOwner,'not_found','Record not found.',404);
   const p=z.object({model:z.string(),apiKey:z.string().max(512).optional(),api:z.enum(['responses','chat_completions']).default('responses')}).strict().parse(await body(req));
   saveModelSettings(p.model,p.apiKey,p.api);
   return json({model:publicModelSettings()});
  }
  if(post&&name==='settings/model/check'){
   invariant(ctx.isOwner,'not_found','Record not found.',404);
   return json(await checkModelAccess(req.signal));
  }
  if(post&&name==='settings/model/list'){
   invariant(ctx.isOwner,'not_found','Record not found.',404);
   const p=z.object({apiKey:z.string().max(512).optional()}).strict().parse(await body(req));
   return json(await listModels(p.apiKey,req.signal));
  }
  if(post&&name==='artifacts') {
   const data=await bytes(req,10*1024*1024+65536);
   const request=new Request(req.url,{method:'POST',headers:{'Content-Type':req.headers.get('content-type')||''},body:data});
   return json({artifact:await uploadArtifact(ctx,await request.formData())});
  }
  if(get&&route[0]==='artifacts'&&route.length===2)return await downloadArtifact(ctx,route[1]);
  return json({error:{code:'not_found',message:'Record not found.'}},404);
 } catch(error) {
  if(error instanceof z.ZodError)return json({error:{code:'validation_failed',message:'Check the required fields and valid identifiers, then try again.',fields:[...new Set(error.issues.map(i=>i.path.join('.')))]}},400);
  if(error instanceof DomainError)return json({error:{code:error.code,message:error.message}},error.status);
  console.error('Workspace request failed; private error details withheld.');
  return json({error:{code:'service_unavailable',message:'Workspace storage is unavailable. Your action was not acknowledged. Retry after the connection recovers.'}},503);
 }
}
