import {fork} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {providerCapability,verifyBundle,vendorRoot} from './catalog.mjs';
export {catalog,sourceLock,boardPack,remotePack,reverseFamilies,providerCapability,verifyBundle} from './catalog.mjs';
let verified=false;
export async function runProvider({provider,entry,maxRecords=500,signal,request,operation,forbiddenPath}){
 const capability=providerCapability(provider);
 if(!operation&&(!capability||['blocked','retired'].includes(capability.state)))throw Object.assign(new Error(capability?.reason||'Unknown upstream provider.'),{code:'provider_unavailable'});
 if(!verified){verifyBundle();verified=true;}
 const childFile=fileURLToPath(new URL('./child.mjs',import.meta.url)),bridgeRoot=fileURLToPath(new URL('./',import.meta.url));
 const child=fork(childFile,[],{cwd:vendorRoot,execPath:process.execPath,
  execArgv:['--permission','--allow-fs-read='+vendorRoot,'--allow-fs-read='+bridgeRoot,'--max-old-space-size=192','--disallow-code-generation-from-strings'],
  env:{NODE_ENV:'production',...(process.env.SystemRoot?{SystemRoot:process.env.SystemRoot}:{})},windowsHide:true,silent:true});
 return new Promise((resolve,reject)=>{
  let done=false,requests=0,logBytes=0;
  const finish=(error,value)=>{if(done)return;done=true;clearTimeout(timer);signal?.removeEventListener('abort',cancel);child.kill();error?reject(error):resolve(value);};
  const cancel=()=>finish(Object.assign(new Error('Discovery provider cancelled.'),{code:'request_cancelled'}));
  const timer=setTimeout(cancel,80000);signal?.addEventListener('abort',cancel,{once:true});
  if(signal?.aborted){cancel();return;}
  for(const stream of [child.stdout,child.stderr])stream.on('data',b=>{logBytes+=b.length;if(logBytes>16384)finish(Object.assign(new Error('Provider log limit exceeded.'),{code:'provider_output_limit'}));});
  child.on('error',e=>finish(e));child.on('exit',()=>{if(!done)finish(Object.assign(new Error('Provider exited before returning results.'),{code:'provider_interrupted'}));});
  child.on('message',async m=>{
   if(done)return;
   if(m?.type==='result')return finish(null,m.value);
   if(m?.type==='error')return finish(Object.assign(new Error(m.error.message),m.error));
   if(m?.type!=='request')return;
   try{
    if(++requests>12)throw Object.assign(new Error('Provider request cap reached.'),{code:'request_budget'});
    const value=await request(m.url,m.options);
    if(!done&&child.connected)child.send({type:'response',id:m.id,value});
   }catch(e){if(!done&&child.connected)child.send({type:'response',id:m.id,error:{code:e.code||'transport_failed',status:e.httpStatus,retryAfterSeconds:e.retryAfterSeconds,message:e.message}});}
  });
  child.send({type:'execute',provider,entry,maxRecords,operation,forbiddenPath});
 });
}
