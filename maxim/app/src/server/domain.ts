import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {DomainError} from './errors';

export type CandidateValue=string|boolean|number|string[];
export type TypedFact={field_key:string;value:CandidateValue;sensitivity:'standard'|'private'|'sensitive'};
export function domain(input:unknown):Record<string,unknown>{
 const binary=path.resolve(/* turbopackIgnore: true */ process.cwd(),'../runtime/target/debug/maxim-domain'+(process.platform==='win32'?'.exe':''));
 const result=spawnSync(binary,[],{input:JSON.stringify(input),encoding:'utf8',maxBuffer:1024*1024,timeout:5000,windowsHide:true});
 if(result.error||result.status!==0)throw new DomainError('domain_unavailable','Build the local Rust domain service before continuing.',503);
 let output;try{output=JSON.parse(result.stdout);}catch{throw new DomainError('domain_unavailable','The domain service returned an invalid response.',503);}
 if(!output.ok)throw new DomainError(output.error?.code||'invalid_fact',output.error?.message||'Candidate value is not valid.');
 return output;
}
export function validateFacts(facts:unknown[]):TypedFact[]{return domain({operation:'validate_facts',facts}).facts as TypedFact[];}
