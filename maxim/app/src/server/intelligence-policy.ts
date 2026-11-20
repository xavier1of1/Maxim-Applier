import type {PoolClient} from 'pg';
import {z} from 'zod';

export const intelligenceSchema=z.object({
 autoScan:z.boolean().default(false),autoScore:z.boolean().default(false),cleanupEnabled:z.boolean().default(false),
 scanIntervalMinutes:z.number().int().min(30).max(10080).default(360),scoreIntervalMinutes:z.number().int().min(15).max(10080).default(60),
 maxActiveJobs:z.number().int().min(20).max(2000).default(200),maxMatches:z.number().int().min(1).max(500).default(100),
 evaluationsPerCycle:z.number().int().min(1).max(20).default(5),evaluationsPerDay:z.number().int().min(1).max(100).default(10),
 maxAgeDays:z.number().int().min(1).max(90).default(7),allowUnknownDates:z.boolean().default(false),
 minEvidenceMatches:z.number().int().min(1).max(10).default(1),idleArchiveDays:z.number().int().min(1).max(365).default(30),
 rawRetentionDays:z.number().int().min(1).max(90).default(7),dailyBudgetCents:z.number().int().min(0).max(10000).default(0),
 dailyTokenBudget:z.number().int().min(1000).max(20000000).default(1000000),
 inputUsdPerMillion:z.number().min(0).max(1000).default(0),outputUsdPerMillion:z.number().min(0).max(1000).default(0),
 pricingModel:z.string().max(120).default(''),sourceIds:z.array(z.string().uuid()).max(3).default([]),
 terms:z.array(z.string().trim().min(2).max(120)).max(10).default([]),
 excludedTitleTerms:z.array(z.string().trim().min(2).max(80)).max(20).default(['intern','unpaid','principal','director','vice president']),
 timezone:z.string().max(80).refine(v=>{try{new Intl.DateTimeFormat('en',{timeZone:v});return true;}catch{return false;}}).default('America/New_York'),
}).strict();
export type IntelligencePolicy=z.infer<typeof intelligenceSchema>;
export const defaults=()=>intelligenceSchema.parse({});
export async function intelligenceLock(tx:PoolClient,w:string){await tx.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',[w+':intelligence']);}
export async function policyFor(tx:PoolClient,w:string){
 const row=(await tx.query('SELECT * FROM discovery_policies WHERE workspace_id=$1',[w])).rows[0];
 return {...row,revision:row?.revision||0,value:intelligenceSchema.parse(row?.value||{}),active:Boolean(row)};
}
export const protectedJob=`EXISTS(SELECT 1 FROM applications a WHERE a.workspace_id=j.workspace_id AND a.job_id=j.id)
 OR j.note<>'' OR EXISTS(SELECT 1 FROM job_discovery_states s WHERE s.workspace_id=j.workspace_id AND s.job_id=j.id AND s.state='saved')
 OR EXISTS(SELECT 1 FROM artifacts a WHERE a.workspace_id=j.workspace_id AND a.job_id=j.id AND a.deleted_at IS NULL
 AND NOT EXISTS(SELECT 1 FROM evaluations e WHERE e.workspace_id=a.workspace_id AND e.report_artifact_id=a.id))`;
export const activeLead=`NOT j.archived AND NOT EXISTS(SELECT 1 FROM applications a WHERE a.workspace_id=j.workspace_id AND a.job_id=j.id AND a.outcome<>'not_submitted')`;
export async function capacity(tx:PoolClient,w:string){
 const p=await policyFor(tx,w),r=(await tx.query(`SELECT count(*)::int AS active,count(*) FILTER(WHERE ${protectedJob})::int AS protected FROM jobs j WHERE j.workspace_id=$1 AND ${activeLead}`,[w])).rows[0];
 return {...r,limit:p.value.maxActiveJobs,enforced:p.active,available:!p.active||r.active<p.value.maxActiveJobs};
}
