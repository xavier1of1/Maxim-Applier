import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
export async function withWorkspace(fn){
 const file=process.env.MAXIM_RUNTIME_FILE||path.join(process.env.LOCALAPPDATA||'','MaximApply/private/workspace/runtime.json');
 const stat=fs.lstatSync(file);if(stat.isSymbolicLink()||!stat.isFile()||stat.size>65536)throw Error('Invalid private workspace configuration.');
 const c=JSON.parse(fs.readFileSync(file,'utf8')),origin=new URL(c.origin);
 if(origin.protocol!=='http:'||!['127.0.0.1','localhost'].includes(origin.hostname)||origin.username||origin.password)throw Error('Only the configured local workspace is supported.');
 let cookie='',csrf='';
 const request=async(route,body)=>{
  if(!/^\/api\/[a-z/0-9_?=&-]+$/i.test(route))throw Error('Unsupported workspace route.');
  const response=await fetch(origin.origin+route,{method:body?'POST':'GET',redirect:'error',signal:AbortSignal.timeout(10000),headers:{Origin:origin.origin,...(cookie?{Cookie:cookie}:{}),...(body?{'Content-Type':'application/json','X-CSRF-Token':csrf}:{})},...(body?{body:JSON.stringify(body)}:{})});
  if(route==='/api/auth/login')cookie=response.headers.get('set-cookie')?.split(';')[0]||'';
  const text=await response.text();if(Buffer.byteLength(text)>4*1024*1024)throw Error('Workspace result exceeds the CLI read bound.');
  let value;try{value=JSON.parse(text);}catch{throw Error('Invalid workspace response.');}
  if(!response.ok)throw Error(value.error?.message||value.message||'Workspace rejected the operation (HTTP '+response.status+').');
  return value;
 };
 const login=await request('/api/auth/login',{accessKey:c.bootstrapKey});csrf=login.csrfToken;
 try{return await fn(request);}finally{await request('/api/auth/logout',{}).catch(()=>{});}
}
export async function runWorkspaceCommand(args=process.argv.slice(2)){
 const [name='help',id,outcome]=args,flag=k=>args.includes(k),option=k=>{const i=args.indexOf(k);return i<0?undefined:args[i+1];};
 if(name==='help'||flag('--help'))return {commands:['list','evaluate <job-uuid>','started <application-uuid> --packet <packet-uuid> --reason "..."','submitted <application-uuid> --external --confirmed --reason "..." [--duplicate-reviewed]','outcome <application-uuid> <responded|interviewing|offer|rejected|withdrawn|unknown> --reason "..."'],dashboard:'http://127.0.0.1:3010/maxim?view=applications',manualFinalSubmission:true};
 return withWorkspace(async request=>{
  const view=await request('/api/applications'+(id&&name!=='evaluate'?'?application='+encodeURIComponent(id):''));
  if(name==='list')return view;
  if(!/^[a-f0-9-]{36}$/i.test(id||''))throw Error('Use the exact canonical job/application UUID. Legacy aliases must be reconciled in the dashboard.');
  if(name==='evaluate'){
   const job=(await request('/api/jobs/'+id)).job;
   if(!job)throw Error('Saved job not found.');
   return request('/api/evaluations/commands',{commandId:crypto.randomUUID(),action:'start_evaluation',payload:{jobId:id,expectedJobRevision:job.job_revision||job.revision,expectedCandidateRevision:view.candidate.revision}});
  }
  const app=view.applications.find(a=>a.id===id);if(!app)throw Error('Application not found in this workspace.');
  const reason=option('--reason');if(!reason||reason.trim().length<3)throw Error('An attributable --reason is required.');
  let action,payload={applicationId:id,expectedRevision:app.revision,reason};
  if(name==='started'){action='mark_started';payload.packetId=option('--packet');}
  else if(name==='submitted'){
   if(!flag('--confirmed'))throw Error('Confirm an already completed manual submission with --confirmed.');
   action='record_submission';payload={...payload,external:flag('--external'),confirmed:true,duplicateReviewed:flag('--duplicate-reviewed'),...(!flag('--external')?{packetId:option('--packet')}:{})};
  }else if(name==='outcome'){action='record_outcome';payload={...payload,outcome,correction:flag('--correction')};}
  else throw Error('Unsupported command. Use help; the rejected runner is retired.');
  return request('/api/applications/commands',{commandId:crypto.randomUUID(),action,payload});
 });
}
