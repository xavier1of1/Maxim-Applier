import crypto from 'node:crypto';
import {z} from 'zod';
import type {PoolClient} from 'pg';
import type {Context} from '../auth';
import {command,event,uuid,jobFor} from '../commands';
import {candidateLock} from '../sources';
import {validRefs,renderFactEvidence} from '../answer-validity';
import {invariant,notFound} from '../errors';
import {contactSchema,rankContact,draftParts,statuses,recruiterTags,publicUrl} from './policy';
import {sourceKey,reviewHistory,hash} from './imports';

const revision=z.number().int().positive(),reason=z.string().trim().min(3).max(2000);
const target=z.object({targetId:uuid,expectedRevision:revision});
const schema=z.discriminatedUnion('action',[
 z.object({commandId:uuid,action:z.literal('save_contact'),payload:z.object({contactId:uuid.optional(),expectedRevision:revision.optional(),identityKey:sourceKey,fields:contactSchema}).strict()}).strict(),
 z.object({commandId:uuid,action:z.literal('shortlist'),payload:z.object({jobId:uuid}).strict()}).strict(),
 z.object({commandId:uuid,action:z.literal('save_research'),payload:target.extend({text:reason,sourceUrl:z.string().url().max(2000),approved:z.boolean()}).strict()}).strict(),
 z.object({commandId:uuid,action:z.literal('build_draft'),payload:target.extend({facts:z.array(z.object({id:uuid,revision}).strict()).min(1).max(8),cta:z.string().trim().min(5).max(500)}).strict()}).strict(),
 z.object({commandId:uuid,action:z.literal('set_status'),payload:target.extend({status:z.enum(statuses),reason,confirmed:z.literal(true)}).strict()}).strict(),
 z.object({commandId:uuid,action:z.literal('recruiter_evidence'),payload:z.object({sourceKey,evidenceKey:sourceKey,subject:z.string().trim().min(1).max(500),observedAt:z.string().datetime({offset:true}),needsResponse:z.boolean()}).strict()}).strict(),
 z.object({commandId:uuid,action:z.literal('correct_recruiter'),payload:z.object({taskId:uuid,expectedRevision:revision,tags:z.array(z.enum(recruiterTags)).max(8),replied:z.boolean(),reason}).strict()}).strict(),
 z.object({commandId:uuid,action:z.literal('review_history'),payload:z.unknown()}).strict(),
]);
async function targetFor(tx:PoolClient,w:string,id:string,expected?:number){
 const row=(await tx.query('SELECT * FROM networking_targets WHERE workspace_id=$1 AND id=$2 FOR UPDATE',[w,id])).rows[0];
 if(!row)throw notFound();
 invariant(expected===undefined||row.revision===expected,'revision_conflict','Networking record changed; refresh before saving.',409);return row;
}
async function approvedFacts(tx:PoolClient,w:string,refs:Array<{id:string;revision:number}>){
 const candidate=(await tx.query('SELECT ownership FROM candidates WHERE workspace_id=$1',[w])).rows[0];
 invariant(candidate?.ownership==='canonical','candidate_not_active','Review and activate candidate authority before drafting.',409);
 invariant(new Set(refs.map(r=>r.id)).size===refs.length,'duplicate_evidence','Select each fact once.');
 const facts=await validRefs(tx,w,refs);
 for(const f of facts){
  const s=(await tx.query('SELECT classification FROM candidate_sources WHERE workspace_id=$1 AND id=$2',[w,f.source_id])).rows[0];
  invariant(f.sensitivity==='standard'&&s?.classification!=='restricted','disclosure_denied','Only current standard, nonrestricted reviewed facts may appear in outreach.',409);
 }
 const text=renderFactEvidence(facts);invariant(text.length<=8000,'draft_limit','Choose a smaller set of candidate facts.');return text;
}
export async function validateTargetDraft(tx:PoolClient,w:string,t:Record<string,any>){
 invariant(t.draft&&t.research?.approved,'draft_not_ready','Approved person research and a five-part draft are required.',409);
 const j=(await tx.query('SELECT company,title,revision FROM jobs WHERE workspace_id=$1 AND id=$2',[w,t.job_id])).rows[0];
 const c=(await tx.query('SELECT revision FROM networking_contacts WHERE workspace_id=$1 AND id=$2',[w,t.contact_id])).rows[0];
 invariant(j?.revision===t.draft.jobRevision&&c?.revision===t.draft.contactRevision&&t.research.hash===t.draft.researchHash,'draft_stale','Role, contact or research changed; rebuild and review the draft.',409);
 const background=await approvedFacts(tx,w,t.draft.facts);
 const expected=draftParts(t.research.text,j.company,j.title,background,t.draft.parts.call_to_action);
 invariant(Object.keys(t.draft.parts).length===Object.keys(expected).length&&Object.entries(expected).every(([k,v])=>v.trim()&&t.draft.parts[k]===v),'draft_evidence_mismatch','Draft text does not match approved evidence.',409);
 return true;
}
export async function networkingCommand(ctx:Context,raw:unknown){
 const c=schema.parse(raw);
 return command(ctx,c.commandId,c,async tx=>{
  const w=ctx.workspaceId;
  await candidateLock(tx,w);
  await tx.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',[w+':networking']);
  if(c.action==='review_history')return reviewHistory(tx,ctx,c.payload);
  if(c.action==='save_contact'){
   const p=c.payload;
   if(p.fields.linkedinUrl)publicUrl(p.fields.linkedinUrl);
   let row;
   if(p.contactId){
    row=(await tx.query('UPDATE networking_contacts SET fields=$1,strength=$2,revision=revision+1 WHERE workspace_id=$3 AND id=$4 AND revision=$5 RETURNING *',[JSON.stringify(p.fields),p.fields.strength,w,p.contactId,p.expectedRevision])).rows[0];
    if(!row){invariant((await tx.query('SELECT id FROM networking_contacts WHERE workspace_id=$1 AND id=$2',[w,p.contactId])).rowCount,'not_found','Contact not found.',404);invariant(false,'revision_conflict','Contact changed; refresh.',409);}
   }else{
    row=(await tx.query('INSERT INTO networking_contacts(id,workspace_id,identity_key,fields,strength) VALUES($1,$2,$3,$4,$5) ON CONFLICT(workspace_id,identity_key) DO NOTHING RETURNING *',[crypto.randomUUID(),w,hash('manual:'+p.identityKey),JSON.stringify(p.fields),p.fields.strength])).rows[0];
    invariant(row,'contact_exists','This manual identity already exists; edit its current revision.',409);
   }
   await event(tx,ctx,row.id,'networking_contact_saved',{},row.revision);return row;
  }
  if(c.action==='shortlist'){
   const j=await jobFor(tx,ctx,c.payload.jobId);
   const eligible=(await tx.query("SELECT 1 FROM evaluations e JOIN candidates c ON c.workspace_id=e.workspace_id WHERE e.workspace_id=$1 AND e.job_id=$2 AND e.job_revision=$3 AND e.candidate_revision=c.revision AND e.status='completed' AND e.tier IN ('T2','T3') UNION ALL SELECT 1 FROM job_policy_reviews p WHERE p.workspace_id=$1 AND p.job_id=$2 AND p.job_revision=$3 AND 'connection'=ANY(p.priority_signals)",[w,j.id,j.revision])).rowCount;
   invariant(eligible&&!j.archived,'networking_ineligible','Select a current T2/T3 or explicitly connection-priority active role.',409);
   const contacts=(await tx.query('SELECT * FROM networking_contacts WHERE workspace_id=$1 ORDER BY id LIMIT 5001',[w])).rows;
   invariant(contacts.length<=5000,'shortlist_limit','Shortlists are bounded to 5,000 contacts.');
   const ranked=contacts.map(contact=>({contact,rank:rankContact(j,contact.fields)})).filter(x=>x.rank).sort((a,b)=>b.rank!.rankScore-a.rank!.rankScore).slice(0,5);
   const targets=[];
   for(const {contact,rank} of ranked){
    const row=(await tx.query('INSERT INTO networking_targets(id,workspace_id,job_id,contact_id,rank_score,reasons) VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT(workspace_id,job_id,contact_id) DO NOTHING RETURNING *',[crypto.randomUUID(),w,j.id,contact.id,rank!.rankScore,JSON.stringify(rank!.reasons)])).rows[0];
    if(row){await event(tx,ctx,row.id,'networking_target_added',{jobId:j.id,contactId:contact.id},1);targets.push(row);}
    else targets.push((await tx.query('SELECT * FROM networking_targets WHERE workspace_id=$1 AND job_id=$2 AND contact_id=$3',[w,j.id,contact.id])).rows[0]);
   }
   return {targets,manualOnly:true};
  }
  if(c.action==='recruiter_evidence'){
   const p=c.payload;invariant(Date.parse(p.observedAt)<=Date.now(),'future_evidence','Evidence time cannot be in the future.');
   const seen=(await tx.query('SELECT task_id FROM networking_recruiter_evidence WHERE workspace_id=$1 AND evidence_key=$2',[w,p.evidenceKey])).rows[0];
   if(seen)return {id:seen.task_id,replayed:true};
   let row=(await tx.query('SELECT * FROM networking_recruiter_tasks WHERE workspace_id=$1 AND source_key=$2 FOR UPDATE',[w,p.sourceKey])).rows[0];
   if(!row)row=(await tx.query('INSERT INTO networking_recruiter_tasks(id,workspace_id,source_key,subject,tags,needs_response,last_evidence_at) VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING *',[crypto.randomUUID(),w,p.sourceKey,p.subject,p.needsResponse?['Recruiter DM','Needs Response']:['Recruiter DM'],p.needsResponse,p.observedAt])).rows[0];
   else if(Date.parse(p.observedAt)>new Date(row.last_evidence_at).getTime()&&(!row.resolved_through||Date.parse(p.observedAt)>new Date(row.resolved_through).getTime())){
    row=(await tx.query('UPDATE networking_recruiter_tasks SET subject=$1,tags=$2,needs_response=$3,last_evidence_at=$4,revision=revision+1,updated_at=now() WHERE workspace_id=$5 AND id=$6 RETURNING *',[p.subject,p.needsResponse?['Recruiter DM','Needs Response']:['Recruiter DM'],p.needsResponse,p.observedAt,w,row.id])).rows[0];
   }
   await tx.query('INSERT INTO networking_recruiter_evidence(workspace_id,evidence_key,task_id,observed_at) VALUES($1,$2,$3,$4)',[w,p.evidenceKey,row.id,p.observedAt]);
   await event(tx,ctx,row.id,'networking_recruiter_evidence_recorded',{needsResponse:row.needs_response},row.revision);return row;
  }
  if(c.action==='correct_recruiter'){
   const p=c.payload,row=(await tx.query('SELECT * FROM networking_recruiter_tasks WHERE workspace_id=$1 AND id=$2 FOR UPDATE',[w,p.taskId])).rows[0];
   if(!row)throw notFound();invariant(row.revision===p.expectedRevision,'revision_conflict','Recruiter task changed; refresh.',409);
   const tags=[...new Set(p.tags.filter(t=>!p.replied||t!=='Needs Response'))];if(p.replied&&!tags.includes('Responded'))tags.push('Responded');
   const updated=(await tx.query('UPDATE networking_recruiter_tasks SET tags=$1,needs_response=$2,resolved_through=greatest(now(),last_evidence_at),revision=revision+1,updated_at=now() WHERE workspace_id=$3 AND id=$4 RETURNING *',[tags,tags.includes('Needs Response'),w,row.id])).rows[0];
   await event(tx,ctx,row.id,p.replied?'networking_recruiter_replied':'networking_recruiter_corrected',{reason:p.reason},updated.revision);return updated;
  }
  const p=c.payload,t=await targetFor(tx,w,p.targetId,p.expectedRevision);
  if(c.action==='save_research'){
   const q=c.payload,research={text:q.text,sourceUrl:publicUrl(q.sourceUrl),approved:q.approved,hash:hash(JSON.stringify([q.text,q.sourceUrl,q.approved])),approvedAt:q.approved?new Date().toISOString():null};
   const row=(await tx.query('UPDATE networking_targets SET research=$1,revision=revision+1,updated_at=now() WHERE workspace_id=$2 AND id=$3 RETURNING *',[JSON.stringify(research),w,t.id])).rows[0];
   await event(tx,ctx,t.id,'networking_research_reviewed',{approved:q.approved,hash:research.hash},row.revision);return row;
  }
  if(c.action==='build_draft'){
   invariant(['research_needed','draft_review','ready_to_send'].includes(t.status),'manual_history_protected','An already actioned draft is immutable. Manual history is retained.',409);
   invariant(t.research?.approved,'research_required','Approve attributable person research before drafting.',409);
   const q=c.payload,j=await jobFor(tx,ctx,t.job_id),contact=(await tx.query('SELECT * FROM networking_contacts WHERE workspace_id=$1 AND id=$2',[w,t.contact_id])).rows[0];
   const background=await approvedFacts(tx,w,q.facts),parts=draftParts(t.research.text,j.company,j.title,background,q.cta);
   const draft={parts,text:`Hi ${contact.fields.name},\n\n`+Object.entries(parts).map(([key,value])=>key.replaceAll('_',' ')+': '+value).join('\n\n'),facts:q.facts,researchHash:t.research.hash,jobRevision:j.revision,contactRevision:contact.revision,validation:{fiveParts:true,evidenceBacked:true,manualOnly:true},createdAt:new Date().toISOString()};
   const row=(await tx.query("UPDATE networking_targets SET draft=$1,status='draft_review',revision=revision+1,updated_at=now() WHERE workspace_id=$2 AND id=$3 RETURNING *",[JSON.stringify(draft),w,t.id])).rows[0];
   for(const f of q.facts)await tx.query("INSERT INTO fact_dependencies(workspace_id,fact_id,fact_revision,kind,entity_id) VALUES($1,$2,$3,'draft',$4) ON CONFLICT(workspace_id,fact_id,kind,entity_id) DO UPDATE SET fact_revision=EXCLUDED.fact_revision,status='current'",[w,f.id,f.revision,t.id]);
   await event(tx,ctx,t.id,'networking_draft_built',{factIds:q.facts.map(f=>f.id)},row.revision);return row;
  }
  invariant(c.action==='set_status','invalid_action','Unknown networking action.');
  const q=c.payload;
  const transitions:Record<string,readonly string[]>={research_needed:[],draft_review:['ready_to_send'],ready_to_send:['sent_manually','declined'],sent_manually:['replied','follow_up_due','referral_asked','no_response','declined'],replied:['referral_asked','referred','declined','follow_up_due'],follow_up_due:['sent_manually','replied','no_response','referral_asked','declined'],referral_asked:['referred','declined','replied','no_response','follow_up_due'],referred:[],declined:[],no_response:['follow_up_due','replied','declined']};
  invariant(q.status===t.status||transitions[t.status]?.includes(q.status),'status_transition','This manual transition would erase or contradict existing history.',409);
  if(['ready_to_send','sent_manually'].includes(q.status))await validateTargetDraft(tx,w,t);
  const row=(await tx.query('UPDATE networking_targets SET status=$1,revision=revision+1,updated_at=now() WHERE workspace_id=$2 AND id=$3 RETURNING *',[q.status,w,t.id])).rows[0];
  await event(tx,ctx,t.id,'networking_manual_status_recorded',{from:t.status,status:q.status,reason:q.reason,manualOnly:true},row.revision);return row;
 });
}
