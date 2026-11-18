import {z} from 'zod';
import type {Context} from '../auth';
import {reauthorize} from '../auth';
import {transaction} from '../db';
import {DomainError,invariant} from '../errors';
import {uuid} from '../commands';
import {networkingCommand} from './service';
import {importNetworking,sourceKey} from './imports';
import {networkingView,networkingMetrics,rawNetworkingImport,defaultCohort} from './reads';
import {cohortSchema} from './metrics';

const json=(v:unknown,status=200)=>Response.json(v,{status,headers:{'Cache-Control':'no-store'}});
async function boundedBody(req:Request,max:number){
 const reader=req.body?.getReader();invariant(reader,'body_required','Request body is required.');
 const chunks:Uint8Array[]=[];let size=0;
 try{for(let i=0;i<10000;i++){const r=await reader.read();if(r.done)return Buffer.concat(chunks);size+=r.value.byteLength;invariant(size<=max,'payload_too_large','Request exceeds the import size limit.',413);chunks.push(r.value);}throw new DomainError('payload_too_large','Too many request chunks.',413);}
 finally{await reader.cancel().catch(()=>{});}
}
// Parent dispatcher authenticates with authenticate(req, req.method==='POST') before calling.
export async function networkingRoute(req:Request,ctx:Context):Promise<Response|null>{
 const u=new URL(req.url),route=u.pathname;
 if(route!=='/api/networking'&&!route.startsWith('/api/networking/'))return null;
 try{
  const get=req.method==='GET',post=req.method==='POST';
  invariant(get||post,'method_denied','Method not supported.',405);
  if(get&&route==='/api/networking')return json(await networkingView(ctx,{importId:u.searchParams.get('import')||undefined,offset:Number(u.searchParams.get('offset')||0)}));
  if(get&&route==='/api/networking/metrics'){
   const d=defaultCohort(),q=u.searchParams;return json(await networkingMetrics(ctx,cohortSchema.parse({from:q.get('from')||d.from,to:q.get('to')||q.get('asOf')||d.to,asOf:q.get('asOf')||d.asOf,maturityDays:q.has('maturityDays')?Number(q.get('maturityDays')):14})));
  }
  if(get&&/^\/api\/networking\/imports\/[0-9a-f-]+\/raw$/.test(route)){
   const id=route.split('/')[4],r=await rawNetworkingImport(ctx,id);
   return new Response(new Uint8Array(r.raw_bytes),{headers:{'Cache-Control':'no-store','Content-Type':'application/octet-stream','Content-Disposition':`attachment; filename="networking-${id}.bin"`,'X-Content-Type-Options':'nosniff','X-Content-SHA256':r.content_hash}});
  }
  if(get&&route==='/api/networking/export'){
   const view=await networkingView(ctx,{importId:u.searchParams.get('import')||undefined,offset:Number(u.searchParams.get('offset')||0)});
   return new Response(JSON.stringify(view,null,2),{headers:{'Cache-Control':'no-store','Content-Type':'application/json','Content-Disposition':'attachment; filename="maxim-networking-page.json"','X-Content-Type-Options':'nosniff'}});
  }
  if(post&&route==='/api/networking/imports'){
   await transaction(tx=>reauthorize(tx,ctx));
   if(req.headers.get('content-type')?.startsWith('multipart/form-data')){
    const data=await boundedBody(req,2097152+65536),form=await new Request(req.url,{method:'POST',headers:{'Content-Type':req.headers.get('content-type')!},body:new Uint8Array(data)}).formData();
    const file=form.get('file');invariant(file instanceof File,'file_required','Choose an import file.');
    z.literal('true').parse(form.get('authorized'));
    return json({result:await importNetworking(ctx,{commandId:uuid.parse(form.get('commandId')),kind:z.enum(['contacts','history']).parse(form.get('kind')),name:file.name,sourceKey:sourceKey.parse(form.get('source')),bytes:Buffer.from(await file.arrayBuffer()),authorized:true})});
   }
   const bytes=await boundedBody(req,2097152),kind=z.enum(['contacts','history']).parse(u.searchParams.get('kind')),name=z.string().min(1).max(200).parse(u.searchParams.get('name'));
   z.literal('true').parse(req.headers.get('x-import-authorized'));
   return json({result:await importNetworking(ctx,{commandId:uuid.parse(req.headers.get('x-command-id')),kind,name,sourceKey:sourceKey.parse(u.searchParams.get('source')),bytes,authorized:true})});
  }
  if(post&&route==='/api/networking/commands'){
   invariant(req.headers.get('content-type')?.startsWith('application/json'),'invalid_content_type','JSON required.',415);
   let raw;try{raw=JSON.parse((await boundedBody(req,131072)).toString('utf8'));}catch(e){if(e instanceof DomainError)throw e;throw new DomainError('invalid_json','Request must be valid JSON.');}
   return json({result:await networkingCommand(ctx,raw)});
  }
  return json({error:{code:'not_found',message:'Record not found.'}},404);
 }catch(e){
  if(e instanceof z.ZodError)return json({error:{code:'validation_failed',message:'Check the networking fields, evidence and identifiers.',fields:e.issues.map(i=>i.path.join('.'))}},400);
  if(e instanceof DomainError)return json({error:{code:e.code,message:e.message}},e.status);
  return json({error:{code:'networking_unavailable',message:'Networking storage is unavailable. No action was acknowledged; refresh and retry.'}},503);
 }
}
