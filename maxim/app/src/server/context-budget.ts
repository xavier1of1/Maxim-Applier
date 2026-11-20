import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {createTokenizer,getRegexByEncoder,getSpecialTokensByEncoder,type TikTokenizer} from '@microsoft/tiktokenizer';
import {invariant} from './errors';
import {validateModelId} from './model-id';

export const REQUEST_BYTE_LIMIT=32000;
const hashes:Record<string,string>={
 o200k_base:'446a9538cb6c348e3516120d7c08b09f57c36495e2acfffe59a5bf8b0cfb1a2d',
 cl100k_base:'223921b76ee99bde995b7ff738513eef100fb51d18c93597a113bcffe865b2a7',
};
const loaded=new Map<string,TikTokenizer>();
export function modelProfile(model:string,testMode=false){
 validateModelId(model);
 if(testMode&&model==='fixture-model')return {encoding:'o200k_base',window:128000,profile:'synthetic_fixture'};
 if(/^(?:gpt-4o(?:-mini)?|gpt-4\.1(?:-mini|-nano)?|gpt-5(?:-mini|-nano)?)(?:-\d{4}-\d{2}-\d{2})?$/.test(model))return {encoding:'o200k_base',window:128000,profile:'bounded_openai_chat'};
 if(/^gpt-4(?:-\d{4})?$/.test(model))return {encoding:'cl100k_base',window:8192,profile:'legacy_gpt4'};
 return {encoding:'o200k_base',window:null,profile:'estimated_openai_text'};
}
export function tokenizer(encoding:string){
 invariant(hashes[encoding],'unsupported_tokenizer','Unsupported tokenizer encoding.',503);
 const cached=loaded.get(encoding);if(cached)return cached;
 const file=path.resolve(/* turbopackIgnore: true */ process.cwd(),'.cache/tokenizers',encoding+'.tiktoken');
 let bytes:Buffer;
 try{invariant(!fs.lstatSync(/* turbopackIgnore: true */ file).isSymbolicLink(),'tokenizer_unavailable','Linked tokenizer files are refused.',503);bytes=fs.readFileSync(/* turbopackIgnore: true */ file);}catch{invariant(false,'tokenizer_unavailable','Build the pinned local tokenizer assets before model use.',503);}
 invariant(crypto.createHash('sha256').update(bytes!).digest('hex')===hashes[encoding],'tokenizer_unavailable','Tokenizer integrity check failed.',503);
 const value=createTokenizer(file,getSpecialTokensByEncoder(encoding),getRegexByEncoder(encoding),8192);
 loaded.set(encoding,value);return value;
}
export type ContextAccounting={
 counter:string;encoding:string;profile:string;requestBytes:number;serializedTokens:number;framingAllowance:number;
 estimatedInputTokens:number;outputReserve:number;localTotalBudget:number;byteUpperBoundWithFraming:number;
 exactProviderBilling:false;policy:string;
};
export type ModelBody={model:string;messages?:unknown[];input?:unknown[];tools?:unknown[];max_completion_tokens?:number;max_output_tokens?:number;[key:string]:unknown};
export function compileContext(body:ModelBody,options:{testMode?:boolean;totalBudget?:number;purpose?:'evaluation'}={}){
 const serialized=JSON.stringify(body),bytes=Buffer.byteLength(serialized);
 const byteLimit=options.purpose==='evaluation'?196608:REQUEST_BYTE_LIMIT,maxBudget=options.purpose==='evaluation'?49152:8192;
 invariant(bytes<=byteLimit,'context_budget_exceeded','The full request exceeds its '+byteLimit+' byte policy. No mandatory instruction or evidence was silently trimmed.',413);
 const profile=modelProfile(body.model,options.testMode),budget=options.totalBudget||maxBudget;
 invariant(Number.isInteger(budget)&&budget>=100&&budget<=maxBudget,'invalid_context_budget','Context budget is outside its declared policy.');
 const reserve=body.max_output_tokens??body.max_completion_tokens??0;
 const framing=512+(body.messages||body.input||[]).length*16+(body.tools?.length||0)*64;
 const tokens=tokenizer(profile.encoding).encode(serialized,[]).length,estimated=Math.ceil(tokens*1.25)+framing;
 invariant(estimated+reserve<=budget&&(profile.window===null||bytes+framing+reserve<=profile.window),'context_budget_exceeded','The complete context plus framing/output reserve exceeds this model policy. Narrow the request; mandatory context was not trimmed.',413);
 return {serialized,accounting:{counter:'@microsoft/tiktokenizer@1.0.10',encoding:profile.encoding,profile:profile.profile,requestBytes:bytes,serializedTokens:tokens,framingAllowance:framing,estimatedInputTokens:estimated,outputReserve:reserve,localTotalBudget:budget,byteUpperBoundWithFraming:bytes+framing+reserve,exactProviderBilling:false as const,policy:'Local BPE estimate + 25% margin and framing/output reserve; unknown models have no assumed context window. Provider usage is measured separately.'}};
}

