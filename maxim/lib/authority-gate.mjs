import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';

const defaultRoot=fileURLToPath(new URL('../../',import.meta.url));
export function readAuthority(root=defaultRoot){
 const file=path.join(root,'data/maxim/authority.json');
 if(!fs.existsSync(file))return {candidate:'legacy',applications:'legacy'};
 let state;try{state=JSON.parse(fs.readFileSync(file,'utf8'));}catch{throw Error('Authority marker is unreadable; refusing implicit legacy fallback.');}
 for(const family of ['candidate','applications'])if(state[family]&&!['legacy','canonical','frozen'].includes(state[family]))throw Error('Authority marker has an unsupported owner.');
 return state;
}
export function assertLegacyWriteAllowed(family,root=defaultRoot){
 const state=readAuthority(root),owner=state[family]||'legacy';
 if(owner!=='legacy')throw Error('This '+family+' family is '+owner+'. Use the authenticated Maxim workspace; offline legacy writes are disabled.');
}
export async function assertNativeCandidateCurrent(root=defaultRoot){
 const state=readAuthority(root);
 if(state.candidate==='legacy'||!state.candidate)return;
 if(state.candidate!=='canonical')throw Error('Candidate projections are frozen for reconciliation.');
 for(const file of ['cv.md','config/profile.yml','modes/_profile.md','article-digest.md']){
  const current=fs.existsSync(path.join(root,file))?crypto.createHash('sha256').update(fs.readFileSync(path.join(root,file))).digest('hex'):null;
  if(current!==state.files?.[file])throw Error('A generated candidate projection changed. Review edits in the workspace instead of using unapproved native data.');
 }
 const runtimeFile=process.env.MAXIM_RUNTIME_FILE||path.join(process.env.LOCALAPPDATA||'','MaximApply/private/workspace/runtime.json');
 let runtime;try{runtime=JSON.parse(fs.readFileSync(runtimeFile,'utf8'));}catch{throw Error('Canonical workspace configuration is unavailable.');}
 const origin=new URL(runtime.origin);
 if(!['127.0.0.1','localhost'].includes(origin.hostname)||origin.protocol!=='http:'||runtime.workspaceId!==state.workspaceId)throw Error('Canonical workspace identity or origin mismatch.');
 const response=await fetch(origin.origin+'/api/auth/login',{method:'POST',headers:{Origin:origin.origin,'Content-Type':'application/json'},body:JSON.stringify({accessKey:runtime.bootstrapKey}),signal:AbortSignal.timeout(5000)}).catch(()=>null);
 if(!response?.ok)throw Error('Canonical candidate authority is offline; evaluation cannot use a stale projection.');
 const cookie=response.headers.get('set-cookie')?.split(';')[0];
 const result=await fetch(origin.origin+'/api/candidate/authority',{headers:{Cookie:cookie||''},signal:AbortSignal.timeout(5000)}).catch(()=>null);
 if(!result?.ok)throw Error('Canonical candidate authority could not be verified.');
 const authority=await result.json();
 if(authority.candidate?.ownership!=='canonical'||authority.candidate?.revision!==state.candidateRevision)throw Error('Candidate projection is stale. Wait for the projection worker or recover it in the workspace.');
 if(!state.disclosedCount)throw Error('No reviewed model-disclosable candidate facts are available.');
}
