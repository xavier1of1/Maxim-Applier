// The child has no credential-bearing transport. Every request is authorized by the parent.
export const BROWSER_LIKE_USER_AGENT='MaximApply-public-discovery/1.0';
export const MACOS_BROWSER_LIKE_USER_AGENT=BROWSER_LIKE_USER_AGENT;
export const DEFAULT_MAX_BODY_BYTES=5242880;
export const MAX_ERROR_BODY_BYTES=16384;
let sequence=0;
const pending=new Map();
process.on('message',m=>{
 if(m?.type!=='response')return;
 const p=pending.get(m.id);if(!p)return;pending.delete(m.id);
 if(m.error){const error=Object.assign(new Error(m.error.message||m.error.code),m.error);p.reject(error);}else p.resolve(m.value);
});
export function request(url,opts={}){
 if(!process.connected)throw new Error('Discovery transport disconnected.');
 const id=++sequence;
 return new Promise((resolve,reject)=>{pending.set(id,{resolve,reject});process.send({type:'request',id,url:String(url),options:{method:opts.method||'GET',body:opts.body||null,headers:opts.headers||{}}});});
}
export async function fetchText(url,opts){return (await request(url,opts)).text;}
export async function fetchJson(url,opts){return JSON.parse(await fetchText(url,opts));}
export async function fetchResponse(url,opts){const r=await request(url,opts);return new Response(r.text,{status:r.status,headers:{'Content-Type':r.contentType}});}
export const fetchTextHead=fetchText;
export async function fetchTextStream(url,opts,onText){const t=await fetchText(url,opts);onText(t);return {bytes:Buffer.byteLength(t)};}
// Parent owns retries/cooldowns and the absolute request budget. Never retry a challenge.
export const fetchJsonWithRetry=(ctx,url,opts)=>ctx.fetchJson(url,opts);
export const fetchTextWithRetry=(ctx,url,opts)=>ctx.fetchText(url,opts);
export const fetchResponseWithRetry=(ctx,url,opts)=>ctx.fetchResponse(url,opts);
export const sleep=ms=>new Promise(resolve=>setTimeout(resolve,Math.min(1000,Math.max(0,ms))));
export const abortableSleep=sleep;
export const isRetryableError=()=>false;
export const isRefusedRedirectError=e=>e?.code==='redirect_refused';
export const isCloudflareChallenge=e=>e?.code==='auth_or_challenge';
export const parseRetryAfterMs=s=>/^\d+$/.test(String(s))?Number(s)*1000:0;
export const resolveDefaultTimeoutMs=()=>30000;
export const makeHttpCtx=()=>({fetchJson,fetchText,fetchResponse,sleep,transport:'http'});
