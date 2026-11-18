import {z} from 'zod';
import {authenticate} from '../auth';
import {config} from '../config';
import {DomainError,invariant} from '../errors';
import {interviewCommand,interviewView} from './service';

const json=(v:unknown,status=200)=>Response.json(v,{status,headers:{'Cache-Control':'no-store'}});
export async function interviewHttp(req:Request){
 try{
  const u=new URL(req.url),post=req.method==='POST';
  invariant(req.headers.get('host')===new URL(config().origin).host,'host_denied','Request host denied.',403);
  invariant(post||req.method==='GET','method_denied','Method not supported.',405);
  const ctx=await authenticate(req,post);
  if(!post&&u.pathname==='/api/interview')return json(await interviewView(ctx,{jobId:u.searchParams.get('job')||undefined,sessionId:u.searchParams.get('session')||undefined}));
  if(post&&u.pathname==='/api/interview/commands'){
   invariant(req.headers.get('content-type')?.startsWith('application/json'),'invalid_content_type','JSON content is required.',415);
   const reader=req.body?.getReader(),chunks:Uint8Array[]=[];let bytes=0;
   if(reader)try{for(let i=0;i<10000;i++){const next=await reader.read();if(next.done)break;bytes+=next.value.length;invariant(bytes<=24000,'payload_too_large','Practice command exceeds its bound.',413);chunks.push(next.value);}}finally{await reader.cancel().catch(()=>{});}
   let body;try{body=JSON.parse(Buffer.concat(chunks).toString('utf8'));}catch{throw new DomainError('invalid_json','Request body is not valid JSON.');}
   return json({result:await interviewCommand(ctx,body)});
  }
  return json({error:{code:'not_found',message:'Record not found.'}},404);
 }catch(error){
  if(error instanceof z.ZodError)return json({error:{code:'validation_failed',message:'Check practice fields, revisions and identifiers.'}},400);
  if(error instanceof DomainError)return json({error:{code:error.code,message:error.message}},error.status);
  return json({error:{code:'service_unavailable',message:'Practice storage is unavailable. Refresh before retrying.'}},503);
 }
}
