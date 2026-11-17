import crypto from 'node:crypto';
import {z} from 'zod';
import {domain} from './domain';
import {invariant} from './errors';
import {assertDisclosureText} from './candidate-context';

export const normalizeQuestion=(text:string)=>text.normalize('NFKC').trim().toLowerCase().replace(/\s+/g,' ').replace(/[?]+$/,'').trim();
export const companyKey=(text:string)=>text.normalize('NFKC').trim().toLowerCase().replace(/\s+/g,' ');
export const contentHash=(value:unknown)=>crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');
export const questionInput=z.object({
 text:z.string().trim().min(2).max(2000),company:z.string().trim().min(1).max(180),
 roleLane:z.string().trim().max(120).default('unspecified'),locale:z.enum(['en-US','en-GB']).default('en-US'),
 answerType:z.enum(['text','boolean','number','choice']).default('text'),options:z.array(z.string().trim().min(1).max(200)).max(30).default([]),
 tags:z.array(z.string().trim().min(2).max(50).regex(/^[a-z0-9][a-z0-9_-]+$/)).max(10).default([]),
}).strict();
export type QuestionInput=z.infer<typeof questionInput>;
export type QuestionPolicy={kind:string;sensitivity:'standard'|'private'|'sensitive';factKey:string|null;manualReview:boolean};
export function questionPolicy(text:string):QuestionPolicy{
 return domain({operation:'question_policy',question:text}) as QuestionPolicy;
}
export function questionIdentity(p:QuestionInput){
 assertDisclosureText(JSON.stringify(p));
 const policy=questionPolicy(p.text);
 invariant(policy.kind!=='credential','credential_forbidden','Credentials and identifiers are not answer-memory content.');
 const context={roleLane:companyKey(p.roleLane||'unspecified'),locale:p.locale,answerType:p.answerType,options:[...new Set(p.options)].sort()};
 invariant(p.answerType!=='choice'||context.options.length>=2,'question_options','Choice questions require the exact available options.');
 const normalized=normalizeQuestion(p.text),company=companyKey(p.company);
 const contextHash=contentHash(context),identityHash=contentHash({text:p.text,company,contextHash,tags:[...new Set(p.tags)].sort()});
 return {policy,context,contextHash,normalized,company,identityHash};
}

