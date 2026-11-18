import type {Outcome,Plan} from './types';

export function retryDelay(attempt:number,hint?:number) {
 const backoff=Math.min(900,5*2**Math.max(0,attempt-1));
 if(hint!==undefined && (!Number.isFinite(hint)||hint<0||hint>86400))return null;
 return Math.max(backoff,hint===undefined?0:Math.ceil(hint));
}
async function boundedJson(response:Response) {
 const reader=response.body?.getReader();if(!reader)return null;
 const chunks:Uint8Array[]=[];let length=0;
 try {
  let completed=false;
  for(let i=0;i<1024;i++){const r=await reader.read();if(r.done){completed=true;break;}length+=r.value.byteLength;if(length>8192)return null;chunks.push(r.value);}
  if(!completed)return null;
  try{return JSON.parse(Buffer.concat(chunks).toString('utf8'));}catch{return null;}
 } finally {await reader.cancel().catch(()=>{});}
}
export async function postDiscord(destination:{webhook:string;channelId:string},payload:Plan['payload'],attempt:number,signal?:AbortSignal):Promise<Outcome> {
 const stop=AbortSignal.timeout(10000),abort=signal?AbortSignal.any([stop,signal]):stop;
 try {
  const url=new URL(destination.webhook);url.searchParams.set('wait','true');
  const response=await fetch(url,{method:'POST',redirect:'manual',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload),signal:abort});
  const status=response.status;
  if(status===200){
   const data=await boundedJson(response);
   if(!/^\d{17,20}$/.test(data?.id||''))return {state:'uncertain',httpStatus:status,code:'acceptance_unconfirmed'};
   if(data.channel_id!==destination.channelId)return {state:'uncertain',httpStatus:status,code:'destination_mismatch'};
   return {state:'accepted',httpStatus:status,code:'remote_accepted',remoteId:data.id};
  }
  if(status===429){
   const header=response.headers.get('retry-after'),reset=response.headers.get('x-ratelimit-reset-after'),data=await boundedJson(response);
   const hints=[header===null?undefined:Number.isFinite(Number(header))?Number(header):(Date.parse(header)-Date.now())/1000,reset===null?undefined:Number(reset),typeof data?.retry_after==='number'?data.retry_after:undefined].filter((v):v is number=>v!==undefined);
   const seconds=retryDelay(attempt,hints.length?Math.max(...hints):undefined);
   return seconds===null?{state:'failed',httpStatus:status,code:'retry_hint_out_of_bounds'}:{state:'retry',httpStatus:status,code:'rate_limited',retrySeconds:seconds};
  }
  await response.body?.cancel().catch(()=>{});
  if(status>=500)return {state:'retry',httpStatus:status,code:'remote_failure',retrySeconds:retryDelay(attempt)!};
  if(status>=200&&status<300)return {state:'uncertain',httpStatus:status,code:'acceptance_unconfirmed'};
  return {state:'failed',httpStatus:status,code:status>=300&&status<400?'redirect_refused':'remote_rejected'};
 } catch {return {state:'uncertain',code:abort.aborted?'request_interrupted':'network_outcome_unknown'};}
}
