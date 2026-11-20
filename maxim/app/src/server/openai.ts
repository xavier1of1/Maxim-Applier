import {compileContext,type ModelBody} from './context-budget';
import {DomainError,invariant} from './errors';
import type {ModelApi} from './model-id';

type Item=Record<string,any>;
type Connection={model:string;apiKey:string;baseUrl:string;api?:ModelApi};
export function prepareOpenAI(body:ModelBody,api:ModelApi='chat_completions',options:Parameters<typeof compileContext>[1]={}){
 if(api==='chat_completions')return {...compileContext(body,options),api};
 const {messages=[],max_completion_tokens,response_format,stream_options,...rest}=body;
 const input=messages.flatMap((raw):Item[]=>{
  const m=raw as Item;
  if(m.responseItems)return m.responseItems;
  if(m.role==='tool')return [{type:'function_call_output',call_id:m.tool_call_id,output:m.content}];
  const items:Item[]=m.content?[{role:m.role,content:m.content}]:[];
  for(const call of m.tool_calls||[])items.push({type:'function_call',call_id:call.id,name:call.function.name,arguments:call.function.arguments});
  return items;
 });
 const request={...rest,input,store:false,max_output_tokens:max_completion_tokens,
  ...(body.tools?{tools:body.tools.map(raw=>{const t=raw as Item;return {type:'function',...t.function};})}:{}),
  ...(response_format?{text:{format:response_format}}:{}),include:['reasoning.encrypted_content']};
 return {...compileContext(request,options),api};
}
export async function boundedJson(response:Response,max=512000){
 invariant(response.body,'model_invalid_response','The provider returned no response body.',502);
 const reader=response.body.getReader(),chunks:Uint8Array[]=[];let size=0,ended=false;
 try{for(let n=0;n<10000;n++){const part=await reader.read();if(part.done){ended=true;break;}
  size+=part.value.length;invariant(size<=max,'model_output_limit','The provider response exceeded its limit.',502);chunks.push(part.value);
 }}finally{await reader.cancel().catch(()=>{});}
 invariant(ended,'model_output_limit','The provider response exceeded its chunk limit.',502);
 try{return JSON.parse(Buffer.concat(chunks).toString('utf8'));}catch{throw new DomainError('model_invalid_response','The provider returned invalid JSON.',502);}
}
export async function openAIRequest(connection:Connection,prepared:{api:ModelApi;serialized:string},signal:AbortSignal){
 let response:Response;
 try{response=await fetch(connection.baseUrl+(prepared.api==='responses'?'/responses':'/chat/completions'),{
  method:'POST',headers:{Authorization:'Bearer '+connection.apiKey,'Content-Type':'application/json'},
  body:prepared.serialized,signal:AbortSignal.any([signal,AbortSignal.timeout(75000)]),redirect:'error'});
 }catch{throw new DomainError(signal.aborted?'cancelled':'model_unavailable','The model request did not complete. No automatic retry was sent.',502);}
 if(!response.ok){
  let code='';try{code=(await boundedJson(response,16384))?.error?.code||'';}catch{}
  const message=code==='context_length_exceeded'?'The selected model context limit was exceeded. Narrow the request.':
   response.status===401||response.status===403?'The API key or project does not permit this request. Check Settings.':
   response.status===404?'The model or selected API is unavailable. Check the exact model ID, API selection and project access.':
   response.status===429?'The provider rate or quota limit was reached. Check billing or retry later.':
   'The provider rejected this task (HTTP '+response.status+'). Check model/API compatibility and access in Settings.';
  throw new DomainError(code==='context_length_exceeded'?'context_budget_exceeded':'model_rejected',message,502);
 }
 return response;
}
export function normalizeResponse(value:Item){
 invariant(value?.status==='completed'&&Array.isArray(value.output),'model_interrupted','The model response was incomplete; no result was accepted.',502);
 let text='';const calls:Item[]=[];
 for(const item of value.output){
  if(item.type==='message')for(const part of item.content||[]){
   invariant(part.type!=='refusal','model_refused','The model declined this task.',502);
   if(part.type==='output_text'){invariant(typeof part.text==='string','model_invalid_response','The model returned invalid text.',502);text+=part.text;}
  }
  if(item.type==='function_call'){
   invariant(typeof item.call_id==='string'&&typeof item.name==='string'&&typeof item.arguments==='string'&&item.arguments.length<=10000&&item.name.length<=100&&item.call_id.length<=200,'model_invalid_response','The model returned an invalid function call.',502);
   calls.push({id:item.call_id,type:'function',function:{name:item.name,arguments:item.arguments}});
  }
 }
 invariant(calls.length<=3,'tool_limit','Too many model tool requests.',502);
 invariant(text||calls.length,'model_invalid_response','The model returned no text or function call.',502);
 const usage=value.usage?{...value.usage,prompt_tokens:value.usage.input_tokens,completion_tokens:value.usage.output_tokens}:null;
 return {choices:[{finish_reason:'stop',message:{content:text,...(calls.length?{tool_calls:calls}:{})}}],usage,responseItems:value.output};
}
export async function completedOpenAI(connection:Connection,prepared:{api:ModelApi;serialized:string},signal:AbortSignal,max=512000){
 const raw=await boundedJson(await openAIRequest(connection,prepared,signal),max);
 return prepared.api==='responses'?normalizeResponse(raw):raw;
}
export async function streamedResponses(connection:Connection,prepared:{api:ModelApi;serialized:string},signal:AbortSignal,delta:(text:string)=>Promise<void>){
 const response=await openAIRequest(connection,prepared,signal);
 invariant(response.body,'model_invalid_response','The model returned no response stream.',502);
 const reader=response.body.getReader(),decoder=new TextDecoder();let pending='',bytes=0,streamed='',terminal:Item|undefined;
 const line=async(raw:string)=>{
  if(!raw.startsWith('data:'))return;
  let data:Item;try{data=JSON.parse(raw.slice(5));}catch{throw new DomainError('model_invalid_response','The model returned an invalid stream.',502);}
  if(data.type==='response.output_text.delta'){
   invariant(typeof data.delta==='string','model_invalid_response','The model returned an invalid text delta.',502);
   streamed+=data.delta;await delta(data.delta);
  }
  if(data.type==='response.completed')terminal=data.response;
  invariant(!['error','response.failed','response.incomplete','response.refusal.delta','response.refusal.done'].includes(data.type),'model_interrupted','The model did not complete this task.',502);
 };
 try{for(let n=0;n<10000;n++){
  const part=await reader.read();if(part.done){pending+=decoder.decode();break;}
  bytes+=part.value.length;invariant(bytes<=512000,'model_output_limit','The model stream exceeded its limit.',502);
  pending+=decoder.decode(part.value,{stream:true});let end;
  while((end=pending.indexOf('\n'))>=0){await line(pending.slice(0,end).trimEnd());pending=pending.slice(end+1);}
 }}finally{await reader.cancel().catch(()=>{});}
 if(pending.trim())await line(pending.trimEnd());
 invariant(terminal,'model_interrupted','The model stream ended without completion.',502);
 const result=normalizeResponse(terminal);
 invariant(result.choices[0].message.content===streamed,'model_invalid_response','The model stream did not match its completed text.',502);
 return result;
}
