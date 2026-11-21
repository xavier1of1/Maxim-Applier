import {z} from 'zod';
import type {PoolClient} from 'pg';
import {type Context} from './auth';
import {candidateLock} from './sources';
import {invariant} from './errors';
import {event} from './commands';

export const workFamilies={
 software_delivery:{label:'Customer-facing software delivery',aliases:['forward deployed','solutions engineer','implementation engineer','deployment strategist','integration engineer'],groups:[{id:'customer_delivery',terms:['customer requirements','customer-facing','technical implementation','customer integrations','customer workflows']}]},
 product_engineering:{label:'Application and product engineering',aliases:['software engineer','software developer','full stack','full-stack','application engineer','product engineer'],groups:[{id:'software_building',terms:['build software','develop applications','full-stack','full stack','production software','software development','build applications']}]},
 automation:{label:'Automation and internal tooling',aliases:['automation engineer','developer productivity','internal tools'],groups:[{id:'automation',terms:['automate workflows','workflow automation','automate internal','automate operational','automation','internal tooling','internal tools']}]},
 systems_integration:{label:'Systems and integration delivery',aliases:['systems engineer','integration developer','platform engineer'],groups:[{id:'integration',terms:['api integrations','api integration','rest apis','rest api','integrate systems','systems integration','software integrations','connect systems']}]},
};
export const searchProfileSchema=z.object({
 families:z.array(z.enum(['software_delivery','product_engineering','automation','systems_integration'])).min(1).max(4),
 extraAliases:z.array(z.string().trim().min(3).max(80)).max(15).default([]),
 excludedTitles:z.array(z.string().trim().min(2).max(60)).max(20).default(['intern','unpaid','principal','director','vice president']),
 explorationPerSource:z.number().int().min(0).max(10).default(3),
 detailRequestsPerSource:z.number().int().min(0).max(8).default(4),
 responsibilityGroupsRequired:z.number().int().min(1).max(4).default(2),
}).strict();
export const profileSaveSchema=z.object({expectedRevision:z.number().int().min(0),expectedCandidateRevision:z.number().int().positive(),profile:searchProfileSchema}).strict();
export function compileSearchProfile(profile:z.infer<typeof searchProfileSchema>){
 const families=[...new Set(profile.families)].map(id=>workFamilies[id]);
 return {...profile,responsibilityGroupsRequired:Math.min(profile.responsibilityGroupsRequired,families.length),geography:'NoVA/DC; Maryland excluded without manual override; remote compatibility requires review',titleAliases:[...new Set([...families.flatMap(f=>f.aliases),...profile.extraAliases])].slice(0,40),responsibilityGroups:families.flatMap(f=>f.groups),kind:'retrieval_rules_not_fit_score'};
}
export async function searchProfileView(tx:PoolClient,w:string){
 const row=(await tx.query('SELECT revision,candidate_revision,value,approved_at FROM discovery_search_profiles WHERE workspace_id=$1',[w])).rows[0];
 const candidate=(await tx.query('SELECT revision,ownership FROM candidates WHERE workspace_id=$1',[w])).rows[0];
 const evidence=(await tx.query("SELECT f.id,f.revision,f.field_key FROM candidate_facts f JOIN candidate_sources s ON s.id=f.source_id AND s.workspace_id=f.workspace_id WHERE f.workspace_id=$1 AND f.status='current' AND f.sensitivity='standard' AND s.deleted_at IS NULL AND s.revision=f.source_revision AND s.classification<>'restricted' AND f.field_key ~ '^(skills|experience|projects|positioning)\\.' ORDER BY f.id LIMIT 300",[w])).rows;
 return {current:row?{...row,stale:row.candidate_revision!==candidate.revision}:null,candidateRevision:candidate.revision,evidenceCount:evidence.length,evidence,
  suggested:searchProfileSchema.parse({families:Object.keys(workFamilies)}),families:Object.entries(workFamilies).map(([id,f])=>({id,label:f.label})),boundaries:'Search preferences do not assert candidate qualifications, approve spending or change geography policy.'};
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
