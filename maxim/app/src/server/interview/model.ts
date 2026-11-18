import {config} from '../config';
import {modelReady} from '../models';
import {compileContext,type ContextAccounting} from '../context-budget';
import {assertDisclosureText} from '../candidate-context';
import {DomainError,invariant} from '../errors';
import {interviewPolicy,validateFeedback,type PracticeSnapshot} from './policy';

export function prepareInterviewRequest(input:{snapshot:PracticeSnapshot;text:string;hypothetical:boolean;model:string;provider:string}){
 const c=config(),model=modelReady();
 invariant(model.model===input.model&&model.baseUrl===input.provider,'model_changed','Model settings changed. Request new feedback explicitly.',409);
 const content=JSON.stringify({context:input.snapshot,attempt:{text:input.text,label:input.hypothetical?'Hypothetical, unapproved practice':'Unapproved practice, not candidate truth'}});
 assertDisclosureText(content);
 return compileContext({model:model.model,messages:[{role:'system',content:interviewPolicy},{role:'user',content}],max_completion_tokens:1024,store:false,stream:false,response_format:{type:'json_object'}},{testMode:c.testMode,totalBudget:c.contextBudget});
}
export function parseInterviewResponse(value:unknown,snapshot:PracticeSnapshot,hypothetical:boolean){
 const v=value as Record<string,any>;
 invariant(v&&v.choices?.length===1&&v.choices[0].finish_reason==='stop'&&typeof v.choices[0].message?.content==='string'&&!v.choices[0].message.tool_calls,'model_interrupted','Feedback was incomplete or requested unavailable tools.',502);
 const text=v.choices[0].message.content;
 invariant(Buffer.byteLength(text)<=16000,'model_output_limit','Feedback content exceeded its bound.',502);
 let feedback;
 try{feedback=validateFeedback(JSON.parse(text),snapshot.facts,hypothetical);}catch{throw new DomainError('model_invalid_response','Feedback did not match the bounded coaching schema.',502);}
 assertDisclosureText(JSON.stringify(feedback));
 const usage=v.usage;
 return {feedback,usage:usage&&Number.isInteger(usage.prompt_tokens)&&Number.isInteger(usage.completion_tokens)&&usage.prompt_tokens>=0&&usage.completion_tokens>=0?{prompt_tokens:usage.prompt_tokens,completion_tokens:usage.completion_tokens}:null};
}
export async function interviewCompletion(input:{snapshot:PracticeSnapshot;text:string;hypothetical:boolean;model:string;provider:string},signal:AbortSignal,onCompiled:(a:ContextAccounting)=>Promise<void>){
 const compiled=prepareInterviewRequest(input);
 await onCompiled(compiled.accounting);
 signal.throwIfAborted();
 // Commands require explicit per-attempt disclosure; config restricts production to OpenAI.
 const c=config(),url=new URL(c.model.baseUrl);
 invariant(c.testMode?url.protocol==='http:'&&url.hostname==='127.0.0.1':url.href==='https://api.openai.com/v1','interview_transport_unavailable','Feedback destination is not the configured approved provider.',503);
 let response:Response;
 try{response=await fetch(url.href.replace(/\/$/,'')+'/chat/completions',{method:'POST',headers:{Authorization:'Bearer '+c.model.apiKey,'Content-Type':'application/json'},body:compiled.serialized,signal,redirect:'error'});}
 catch{throw new DomainError(signal.aborted?'cancelled':'model_unavailable','Interview feedback transport did not complete.',502);}
 if(!response.ok){await response.body?.cancel();throw new DomainError('model_rejected','Feedback provider rejected the request (HTTP '+response.status+'). No automatic retry was sent.',502);}
 invariant(response.body,'model_invalid_response','Feedback provider returned no body.',502);
 const reader=response.body.getReader(),chunks:Uint8Array[]=[];let bytes=0;
 try{for(let i=0;i<10000;i++){const next=await reader.read();if(next.done)break;bytes+=next.value.length;invariant(bytes<=64000,'model_output_limit','Feedback response exceeded its transport bound.',502);chunks.push(next.value);}}
 finally{await reader.cancel().catch(()=>{});}
 let value;try{value=JSON.parse(Buffer.concat(chunks).toString('utf8'));}catch{throw new DomainError('model_invalid_response','Feedback response was not JSON.',502);}
 return {...parseInterviewResponse(value,input.snapshot,input.hypothetical),accounting:compiled.accounting};
}
