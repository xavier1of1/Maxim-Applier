import {config} from '../config';
import {modelReady} from '../models';
import {type ContextAccounting} from '../context-budget';
import {assertDisclosureText} from '../candidate-context';
import {DomainError,invariant} from '../errors';
import {interviewPolicy,validateFeedback,type PracticeSnapshot} from './policy';
import {prepareOpenAI,completedOpenAI} from '../openai';
import type {ModelApi} from '../model-id';

export function prepareInterviewRequest(input:{snapshot:PracticeSnapshot;text:string;hypothetical:boolean;model:string;provider:string;api?:ModelApi}){
 const c=config(),model=modelReady();
 invariant(model.model===input.model&&model.baseUrl===input.provider&&model.api===(input.api||'chat_completions'),'model_changed','Model settings changed. Request new feedback explicitly.',409);
 const content=JSON.stringify({context:input.snapshot,attempt:{text:input.text,label:input.hypothetical?'Hypothetical, unapproved practice':'Unapproved practice, not candidate truth'}});
 assertDisclosureText(content);
 return prepareOpenAI({model:model.model,messages:[{role:'system',content:interviewPolicy},{role:'user',content}],max_completion_tokens:1024,store:false,stream:false,response_format:{type:'json_object'}},model.api,{testMode:c.testMode,totalBudget:c.contextBudget});
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
export async function interviewCompletion(input:{snapshot:PracticeSnapshot;text:string;hypothetical:boolean;model:string;provider:string;api?:ModelApi},signal:AbortSignal,onCompiled:(a:ContextAccounting)=>Promise<void>){
 const compiled=prepareInterviewRequest(input);
 await onCompiled(compiled.accounting);
 signal.throwIfAborted();
 // Commands require explicit per-attempt disclosure; config restricts production to OpenAI.
 const c=config(),url=new URL(c.model.baseUrl);
 invariant(c.testMode?url.protocol==='http:'&&url.hostname==='127.0.0.1':url.href==='https://api.openai.com/v1','interview_transport_unavailable','Feedback destination is not the configured approved provider.',503);
 const value=await completedOpenAI(c.model,compiled,signal,64000);
 return {...parseInterviewResponse(value,input.snapshot,input.hypothetical),accounting:compiled.accounting};
}
