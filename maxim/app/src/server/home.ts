import {z} from 'zod';
import {type Context,reauthorize} from './auth';
import {transaction} from './db';
import {policyFor,activeLead} from './intelligence-policy';
import {budgetView} from './intelligence-budget';
import {jobFitJoin} from './job-fit';
import {engineSnapshot} from './evaluation-native';
import {config} from './config';
import {domain} from './domain';
import {canonicalJobUrl} from './application-duplicates';

const identity=(a:{url:string|null;opening_key:string|null;job_id:string})=>canonicalJobUrl(a.url)||a.opening_key||a.job_id;

export async function homeView(ctx:Context,q:URLSearchParams){
 const days=z.coerce.number().refine(v=>[30,90,365].includes(v)).parse(q.get('days')||90),engine=await engineSnapshot();
 return transaction(async tx=>{
  await tx.query('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ');await reauthorize(tx,ctx);
  const w=ctx.workspaceId,p=await policyFor(tx,w),zone=p.value.timezone;
  const rows=(await tx.query(`WITH cohort AS (
   SELECT a.id,a.job_id,a.outcome,a.applied_at AS date,j.url,j.opening_key,
    a.applied_at>=(date_trunc('day',now() AT TIME ZONE $3) AT TIME ZONE $3) AS today,
    a.applied_at>=(date_trunc('week',now() AT TIME ZONE $3) AT TIME ZONE $3) AS week
   FROM applications a JOIN jobs j ON j.workspace_id=a.workspace_id AND j.id=a.job_id WHERE a.workspace_id=$1 AND a.applied_at<=now() AND a.outcome<>'not_submitted' AND a.applied_at>=now()-$2*interval '1 day'
  ), states AS (SELECT a.id,a.outcome,
    a.outcome='responded' OR bool_or(x.snapshot->>'outcome'='responded') AS responded,
    a.outcome='interviewing' OR bool_or(x.snapshot->>'outcome'='interviewing') AS interviewed,
    a.outcome='offer' OR bool_or(x.snapshot->>'outcome'='offer') AS offered
   FROM cohort a LEFT JOIN application_actions x ON x.workspace_id=$1 AND x.application_id=a.id
    AND x.created_at>=coalesce((SELECT max(y.created_at) FROM application_actions y WHERE y.workspace_id=$1 AND y.application_id=a.id AND y.event_type IN ('application_outcome_corrected','submission_recorded')),a.date)
    AND x.event_type IN ('application_outcome_recorded','application_outcome_corrected') GROUP BY a.id,a.outcome)
   SELECT s.*,a.job_id,a.url,a.opening_key,a.date,a.today,a.week FROM states s JOIN cohort a ON a.id=s.id ORDER BY a.date DESC,a.id`,[w,days,zone])).rows;
  const unique=new Map<string,Record<string,any>>();
  for(const r of rows){const key=identity(r),prior=unique.get(key);if(prior){for(const f of ['responded','interviewed','offered','today','week'])prior[f]=Boolean(prior[f]||r[f]);}else unique.set(key,{...r,count:1});}
  const applications=[...unique.values()],groups=new Map<string,Record<string,any>>();
  for(const a of applications){const key=JSON.stringify([a.outcome,Boolean(a.responded),Boolean(a.interviewed),Boolean(a.offered)]),prior=groups.get(key);if(prior)prior.count++;else groups.set(key,{...a,count:1});}
  const flow=domain({operation:'application_flow',groups:[...groups.values()].map(a=>({outcome:a.outcome,responded:Boolean(a.responded),interviewed:Boolean(a.interviewed),offered:Boolean(a.offered),count:a.count}))});
  const history=(await tx.query("SELECT a.job_id,a.outcome,j.url,j.opening_key FROM applications a JOIN jobs j ON j.workspace_id=a.workspace_id AND j.id=a.job_id WHERE a.workspace_id=$1 AND a.applied_at<=now() AND a.outcome<>'not_submitted' ORDER BY a.applied_at DESC,a.id",[w])).rows;
  const latest=new Map<string,string>();for(const a of history){const key=identity(a);if(!latest.has(key))latest.set(key,a.outcome);}
  const counts={today:applications.filter(a=>a.today).length,week:applications.filter(a=>a.week).length,waiting:[...latest.values()].filter(v=>v==='submitted').length};
  const scanned=Number((await tx.query("SELECT count(DISTINCT job_id) FROM job_observations WHERE workspace_id=$1 AND observed_at>=now()-interval '7 days'",[w])).rows[0].count);
  const eligible=`j.workspace_id=$1 AND ${activeLead} AND fit.current AND fit.score>=4
   AND (j.posted_at BETWEEN now()-$3*interval '1 day' AND now() OR (j.posted_at IS NULL AND $4))
   AND coalesce(j.last_seen_at,j.updated_at)>now()-interval '48 hours'
   AND coalesce(fit.policy->'flags',j.discovery_policy->'flags','[]') @> '[{"flagType":"location","severity":"positive"}]'
   AND NOT EXISTS(SELECT 1 FROM jsonb_array_elements(coalesce(fit.policy->'flags',j.discovery_policy->'flags','[]')) f WHERE f->>'severity'='blocker')`;
  const lanes=(await tx.query(`SELECT coalesce(j.role_lane,'Unclassified') AS lane,count(*)::int AS openings,max(fit.score)::float8 AS best_score,
   (array_agg(j.id ORDER BY fit.score DESC,j.posted_at DESC NULLS LAST,j.id))[1] AS job_id,max(j.last_seen_at) AS last_checked
   FROM jobs j ${jobFitJoin} WHERE ${eligible} GROUP BY j.role_lane ORDER BY best_score DESC,openings DESC,lane LIMIT 5`,[w,engine.hash,p.value.maxAgeDays,p.value.allowUnknownDates])).rows;
  const highFit=Number((await tx.query(`SELECT count(*) FROM jobs j ${jobFitJoin} WHERE ${eligible}`,[w,engine.hash,p.value.maxAgeDays,p.value.allowUnknownDates])).rows[0].count);
  const budget=await budgetView(tx,w,p.value),candidate=(await tx.query('SELECT ownership FROM candidates WHERE workspace_id=$1',[w])).rows[0];
  const sources=Number((await tx.query("SELECT count(*) FROM discovery_sources WHERE workspace_id=$1 AND enabled AND provider<>'manual'",[w])).rows[0].count);
  return {asOf:new Date().toISOString(),days,timezone:zone,flow,lanes,
   metrics:[{id:'today',label:'Applied today',value:counts.today},{id:'week',label:'Applied this week',value:counts.week},{id:'scanned',label:'Unique jobs scanned / 7 days',value:scanned},{id:'fit',label:'Fresh high-fit openings',value:highFit},
    {id:'waiting',label:'Awaiting response',value:counts.waiting},{id:'interviews',label:'Interview evidence / '+days+' days',value:applications.filter(a=>a.interviewed).reduce((n,a)=>n+a.count,0)},
    {id:'offers',label:'Offer evidence / '+days+' days',value:applications.filter(a=>a.offered).reduce((n,a)=>n+a.count,0)},{id:'spend',label:'Automatic cost reserved / today',value:'$'+(budget.cents/100).toFixed(2)}],
   setup:{candidate:candidate?.ownership==='canonical',model:Boolean(config().model.apiKey),sources:sources>0,limits:p.active},
   formulas:{cohort:'Known canonical posting URLs/identities are deduplicated; unknown identities remain separate. Latest submission outcome wins and recorded stage evidence is combined. Within each record the latest submission/correction resets earlier evidence.',postingAvailability:'unconfirmed',week:'Monday 00:00 in '+zone}};
 });
}
