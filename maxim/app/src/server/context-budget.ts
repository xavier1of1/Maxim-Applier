import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {createTokenizer,getRegexByEncoder,getSpecialTokensByEncoder,type TikTokenizer} from '@microsoft/tiktokenizer';
import {invariant} from './errors';

export const REQUEST_BYTE_LIMIT=32000;
const hashes:Record<string,string>={
 o200k_base:'446a9538cb6c348e3516120d7c08b09f57c36495e2acfffe59a5bf8b0cfb1a2d',
 cl100k_base:'223921b76ee99bde995b7ff738513eef100fb51d18c93597a113bcffe865b2a7',
};
const loaded=new Map<string,TikTokenizer>();
export function modelProfile(model:string,testMode=false){
 if(testMode&&model==='fixture-model')return {encoding:'o200k_base',window:128000,profile:'synthetic_fixture'};
 if(/^(?:gpt-4o(?:-mini)?|gpt-4\.1(?:-mini|-nano)?|gpt-5(?:-mini|-nano)?)(?:-\d{4}-\d{2}-\d{2})?$/.test(model))return {encoding:'o200k_base',window:128000,profile:'bounded_openai_chat'};
 if(/^gpt-4(?:-\d{4})?$/.test(model))return {encoding:'cl100k_base',window:8192,profile:'legacy_gpt4'};
 invariant(false,'unsupported_tokenizer','This model has no verified tokenizer/framing profile. Choose a documented supported model or add and test a profile.',503);
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
export function compileContext(body:{model:string;messages:unknown[];tools?:unknown[];max_completion_tokens:number;[key:string]:unknown},options:{testMode?:boolean;totalBudget?:number}={}){
 const serialized=JSON.stringify(body),bytes=Buffer.byteLength(serialized);
 invariant(bytes<=REQUEST_BYTE_LIMIT,'context_budget_exceeded','The full request exceeds 32,000 bytes. No mandatory instruction or evidence was silently trimmed.',413);
 const profile=modelProfile(body.model,options.testMode),budget=options.totalBudget||8192;
 invariant(Number.isInteger(budget)&&budget>=100&&budget<=8192,'invalid_context_budget','Context budget must be between 100 and 8,192 tokens.');
 const framing=512+body.messages.length*16+(body.tools?.length||0)*64;
 const tokens=tokenizer(profile.encoding).encode(serialized,[]).length,estimated=Math.ceil(tokens*1.25)+framing;
 invariant(estimated+body.max_completion_tokens<=budget&&bytes+framing+body.max_completion_tokens<=profile.window,'context_budget_exceeded','The complete context plus framing/output reserve exceeds this model policy. Narrow the request; mandatory context was not trimmed.',413);
 return {serialized,accounting:{counter:'@microsoft/tiktokenizer@1.0.10',encoding:profile.encoding,profile:profile.profile,requestBytes:bytes,serializedTokens:tokens,framingAllowance:framing,estimatedInputTokens:estimated,outputReserve:body.max_completion_tokens,localTotalBudget:budget,byteUpperBoundWithFraming:bytes+framing+body.max_completion_tokens,exactProviderBilling:false as const,policy:'Full serialized request BPE + 25% margin + explicit framing. Provider usage is measured separately; no exact billing claim.'}};
}

