import {z} from 'zod';
import {invariant} from '../errors';
import {fields} from './import-parser';

export const statuses=['ready_to_send','sent_manually','replied','follow_up_due','referral_asked','referred','declined','no_response'] as const;
export const recruiterTags=['Recruiter DM','Needs Response','Responded','Follow-Up Due','Interview Scheduling','Rejected','Offer/Comp','Correction Needed'] as const;
const text=z.string().trim().max(2000);
export const contactSchema=z.object({name:z.string().trim().min(1).max(200),company:text.default(''),title:text.default(''),email:text.default(''),linkedinUrl:text.default(''),notes:text.default(''),roleRelevance:text.default(''),alumni:z.boolean().default(false),recruiter:z.boolean().default(false),founder:z.boolean().default(false),strength:z.number().int().min(1).max(3).nullable().default(null)}).strict();
export type Contact=z.infer<typeof contactSchema>;
export function publicUrl(value:string){
 const u=new URL(value);
 invariant(u.protocol==='https:'&&!u.username&&!u.password&&!/^(localhost|127\.|0\.|10\.|192\.168\.|169\.254\.|\[)/i.test(u.hostname),'invalid_public_url','Use a public HTTPS research URL without credentials.');
 return u.href;
}
export function contactFromRaw(raw:Record<string,string>){
 const f=fields(raw),boolean=(v:string)=>['true','yes','y','1'].includes(v.toLowerCase()),s=f('connection strength','strength');
 return contactSchema.parse({name:f('name','full name')||[f('first name'),f('last name')].filter(Boolean).join(' '),company:f('company'),title:f('title','position'),email:f('email','email address'),linkedinUrl:f('linkedin url','linkedinurl','linkedin','url'),notes:f('notes'),roleRelevance:f('role relevance'),alumni:boolean(f('vt alumni','alumni')),recruiter:boolean(f('recruiter signal','recruiter')),founder:boolean(f('founder signal','founder')),strength:s?Number(s):null});
}
export function rankContact(job:{company:string;title:string},contact:Contact){
 const reasons:Array<{field:string;value:string;points:number}>=[];
 const add=(field:string,value:string,points:number)=>reasons.push({field,value,points});
 // Generic role keywords, alumni or strength alone never establish a job relationship.
 const same=Boolean(contact.company&&contact.company.toLowerCase()===job.company.trim().toLowerCase());
 const relevant=Boolean(contact.roleRelevance&&contact.roleRelevance.toLowerCase().includes(job.company.trim().toLowerCase())&&job.company.trim().length>=3);
 if(!same&&!relevant)return null;
 if(same)add('company',contact.company,40);
 if(relevant)add('roleRelevance',contact.roleRelevance,8);
 if(contact.strength)add('strength',String(contact.strength),contact.strength*15);
 if(contact.alumni)add('alumni','Explicit imported/manual alumni signal',12);
 if(contact.recruiter||/\b(recruiter|talent)\b/i.test(contact.title))add('recruiter',contact.title||'Explicit recruiter signal',10);
 if(contact.founder||/\bfounder\b/i.test(contact.title))add('founder',contact.title||'Explicit founder signal',10);
 return {rankScore:reasons.reduce((sum,r)=>sum+r.points,0),reasons};
}
export function draftParts(person:string,company:string,title:string,background:string,cta:string){
 return {person_research:person,role_reference:`${title} at ${company}`,candidate_background:background,fit_rationale:`I am exploring ${title} at ${company}. My relevant background is: ${background}`,call_to_action:cta};
}
