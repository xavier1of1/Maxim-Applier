import {z} from 'zod';
import type {PoolClient} from 'pg';
import {type Context} from './auth';
import {candidateLock} from './sources';
import {invariant} from './errors';
import {event} from './commands';
import {transaction} from './db';
import {reauthorize} from './auth';
import crypto from 'node:crypto';

export const workFamilies={
 software_delivery:{label:'Customer-facing software delivery',aliases:['forward deployed','solutions engineer','implementation engineer','deployment strategist','integration engineer'],groups:[{id:'customer_delivery',terms:['customer requirements','customer-facing','technical implementation','customer integrations','customer workflows']}]},
 product_engineering:{label:'Application and product engineering',aliases:['software engineer','software developer','full stack','full-stack','application engineer','product engineer'],groups:[{id:'software_building',terms:['build software','develop applications','full-stack','full stack','production software','software development','build applications']}]},
 automation:{label:'Automation and internal tooling',aliases:['automation engineer','developer productivity','internal tools'],groups:[{id:'automation',terms:['automate workflows','workflow automation','automate internal','automate operational','automation','internal tooling','internal tools']}]},
 systems_integration:{label:'Systems and integration delivery',aliases:['systems engineer','integration developer','platform engineer'],groups:[{id:'integration',terms:['api integrations','api integration','rest apis','rest api','integrate systems','systems integration','software integrations','connect systems']}]},
};
export const seniorityLabels={entry:'Entry level',junior:'Junior',associate:'Associate',mid:'Mid-level',senior:'Senior',staff:'Staff / Principal',leadership:'Lead / Management'};
export function seniorityPreferences(value:unknown){
 const aliases:Record<string,string>={entrylevel:'entry',junior:'junior',associate:'associate',midlevel:'mid',senior:'senior',staff:'staff',principal:'staff',lead:'leadership',management:'leadership'};
 return [...new Set((Array.isArray(value)?value:[]).filter((v):v is string=>typeof v==='string').map(v=>aliases[v.toLowerCase().replace(/[\s_/-]+/g,'')]).filter(Boolean))] as (keyof typeof seniorityLabels)[];
}
export const searchProfileSchema=z.object({
 families:z.array(z.enum(['software_delivery','product_engineering','automation','systems_integration'])).min(1).max(4),
 extraAliases:z.array(z.string().trim().min(3).max(80)).max(15).default([]),
 excludedTitles:z.array(z.string().trim().min(2).max(60)).max(20).default(['intern','unpaid','principal','director','vice president']),
 explorationPerSource:z.number().int().min(0).max(10).default(3),
 detailRequestsPerSource:z.number().int().min(0).max(8).default(4),
 responsibilityGroupsRequired:z.number().int().min(1).max(4).default(2),
 includeUnverifiedLocations:z.boolean().default(false),
 seniorityLevels:z.array(z.enum(['entry','junior','associate','mid','senior','staff','leadership'])).max(7).default([]),
}).strict();
export const profileSaveSchema=z.object({expectedRevision:z.number().int().min(0),expectedCandidateRevision:z.number().int().positive(),profile:searchProfileSchema}).strict();
export function compileSearchProfile(profile:z.infer<typeof searchProfileSchema>){
 const families=[...new Set(profile.families)].map(id=>workFamilies[id]);
 return {...profile,responsibilityGroupsRequired:Math.min(profile.responsibilityGroupsRequired,families.length),geography:'NoVA/DC; Maryland excluded without manual override; remote compatibility requires review',titleAliases:[...new Set([...families.flatMap(f=>f.aliases),...profile.extraAliases])].slice(0,40),responsibilityGroups:families.flatMap(f=>f.groups),kind:'retrieval_rules_not_fit_score'};
}
export async function searchProfileView(tx:PoolClient,w:string){
 const row=(await tx.query('SELECT revision,candidate_revision,value,approved_at FROM discovery_search_profiles WHERE workspace_id=$1',[w])).rows[0];
 const candidate=(await tx.query('SELECT revision,ownership FROM candidates WHERE workspace_id=$1',[w])).rows[0];
 const seniority=(await tx.query("SELECT f.value FROM candidate_facts f JOIN candidate_sources s ON s.id=f.source_id AND s.workspace_id=f.workspace_id WHERE f.workspace_id=$1 AND f.field_key='preferences.seniority' AND f.status='current' AND s.deleted_at IS NULL AND s.revision=f.source_revision",[w])).rows[0];
 const evidence=(await tx.query("SELECT f.id,f.revision,f.field_key FROM candidate_facts f JOIN candidate_sources s ON s.id=f.source_id AND s.workspace_id=f.workspace_id WHERE f.workspace_id=$1 AND f.status='current' AND f.sensitivity='standard' AND s.deleted_at IS NULL AND s.revision=f.source_revision AND s.classification<>'restricted' AND f.field_key ~ '^(skills|experience|projects|positioning)\\.' ORDER BY f.id LIMIT 300",[w])).rows;
 return {current:row?{...row,stale:row.candidate_revision!==candidate.revision}:null,candidateRevision:candidate.revision,evidenceCount:evidence.length,evidence,
  suggested:searchProfileSchema.parse({families:Object.keys(workFamilies),seniorityLevels:seniorityPreferences(seniority?.value)}),families:Object.entries(workFamilies).map(([id,f])=>({id,label:f.label})),seniorities:Object.entries(seniorityLabels).map(([id,label])=>({id,label})),boundaries:'Search preferences do not assert candidate qualifications, approve spending or change geography policy.'};
}
export async function saveSearchProfile(tx:PoolClient,ctx:Context,p:z.infer<typeof profileSaveSchema>){
 invariant(ctx.isOwner,'not_found','Record not found.',404);await candidateLock(tx,ctx.workspaceId);
 const v=await searchProfileView(tx,ctx.workspaceId);
 invariant(v.candidateRevision===p.expectedCandidateRevision,'candidate_changed','Candidate knowledge changed. Review the search profile again.',409);
 invariant((v.current?.revision||0)===p.expectedRevision,'revision_conflict','Search profile changed. Refresh it.',409);
 invariant(v.evidenceCount>0,'candidate_context_required','Approve professional candidate knowledge before configuring evidence-backed discovery.',409);
 const value={...compileSearchProfile(p.profile),evidence:v.evidence};
 const row=(await tx.query('INSERT INTO discovery_search_profiles(workspace_id,candidate_revision,value,approved_by) VALUES($1,$2,$3,$4) ON CONFLICT(workspace_id) DO UPDATE SET candidate_revision=EXCLUDED.candidate_revision,value=EXCLUDED.value,approved_by=EXCLUDED.approved_by,approved_at=now(),revision=discovery_search_profiles.revision+1 RETURNING revision',[ctx.workspaceId,p.expectedCandidateRevision,JSON.stringify(value),ctx.sessionId])).rows[0];
 await event(tx,ctx,ctx.workspaceId,'discovery_search_profile_approved',{families:p.profile.families,candidateRevision:p.expectedCandidateRevision},row.revision);return row;
}
export async function searchProfileTool(ctx:Context,rid:string,name:string,args:unknown){
 return transaction(async tx=>{
  await reauthorize(tx,ctx);const v=await searchProfileView(tx,ctx.workspaceId);
  if(name==='read_search_profile'){z.object({}).strict().parse(args);return {revision:v.current?.revision||0,stale:v.current?.stale||false,candidateRevision:v.candidateRevision,evidenceCount:v.evidenceCount,profile:v.current?{...v.current.value,evidence:undefined}:v.suggested,families:v.families,seniorities:v.seniorities,boundaries:v.boundaries,detailView:'discovery'};}
  invariant(ctx.isOwner,'not_found','Record not found.',404);
  const a=z.object({quote:z.string().min(3).max(4000),profileJson:z.string().max(8000)}).strict().parse(args);
  const user=(await tx.query("SELECT m.content FROM messages m JOIN runs r ON r.workspace_id=m.workspace_id AND r.id=m.run_id WHERE m.workspace_id=$1 AND m.run_id=$2 AND m.role='user' AND r.status='running' ORDER BY m.sequence DESC LIMIT 1",[ctx.workspaceId,rid])).rows[0];
  invariant(user?.content.text===a.quote&&/\b(change|configure|set|search|find|prefer|look|focus)\b/i.test(a.quote),'explicit_request_required','Quote the exact current search-preference request.');
  let value;try{const parsed=JSON.parse(a.profileJson);value=searchProfileSchema.parse({...parsed,seniorityLevels:parsed.seniorityLevels??v.current?.value.seniorityLevels??v.suggested.seniorityLevels});}catch{invariant(false,'invalid_search_profile','Use the profile fields and work-family IDs returned by read_search_profile.');}
  const row=(await tx.query('INSERT INTO discovery_profile_proposals(id,workspace_id,run_id,expected_revision,candidate_revision,value,quote) VALUES($1,$2,$3,$4,$5,$6,$7) ON CONFLICT(workspace_id,run_id) DO UPDATE SET quote=discovery_profile_proposals.quote RETURNING id',[crypto.randomUUID(),ctx.workspaceId,rid,v.current?.revision||0,v.candidateRevision,JSON.stringify(value),a.quote])).rows[0];
  return {proposalId:row.id,status:'pending_owner_review',profile:value,detailView:'discovery',nextAction:'Review and approve the search profile in Discovery. No search, spending, geography override or candidate fact has been approved.'};
 });
}
