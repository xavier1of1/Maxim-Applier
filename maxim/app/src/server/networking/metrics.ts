import {z} from 'zod';
import {domain} from '../domain';
import {invariant} from '../errors';

export const cohortSchema=z.object({from:z.string().datetime({offset:true}),to:z.string().datetime({offset:true}),asOf:z.string().datetime({offset:true}),maturityDays:z.number().int().min(0).max(365).default(14)}).strict();
export type Cohort=z.infer<typeof cohortSchema>;
export type Attempt={identity:string;submitted:boolean;submittedAt:string|null;location:string;interview:'accepted'|'rejected'|'unknown';interviewAt?:string|null;outcome?:string;metadata?:Record<string,unknown>;origin:string};
export const dimensions=['scoreBand','tier','source','lane','variant','networking','strength','freshness'] as const;
export function locationBucket(location:string):'compatible'|'excluded'|'unknown'{
 const result=domain({operation:'job_policy',job:{locations:[location],title:'',description:''}});
 const flag=(result.flags as Array<{flagType:string;severity:string}>).find(f=>f.flagType==='location');
 return flag?.severity==='positive'?'compatible':flag?.severity==='blocker'?'excluded':'unknown';
}
function scoreBand(value:unknown){
 if(value===null||value===undefined||value==='')return 'unknown';
 const n=Number(value);return !Number.isFinite(n)||n<1||n>5?'unknown':n<3.5?'<3.5':n<4?'3.5-3.9':n<4.5?'4.0-4.4':'4.5-5.0';
}
function segment(a:Attempt,dimension:string){
 const m=a.metadata||{};
 if(dimension==='scoreBand')return scoreBand(m.score);
 if(dimension==='strength')return [1,2,3].includes(Number(m.strength))?String(m.strength):'unknown';
 if(dimension==='freshness'){
  const posted=typeof m.postedAt==='string'?Date.parse(m.postedAt):NaN,submitted=Date.parse(a.submittedAt||'');
  if(!Number.isFinite(posted)||!Number.isFinite(submitted)||posted>submitted)return 'unknown';
  const days=(submitted-posted)/86400000;return days<=2?'0-2d':days<=7?'3-7d':days<=21?'8-21d':'22d+';
 }
 const v=m[dimension];return typeof v==='string'&&v.trim()?v:'unknown';
}
export function computeMetrics(records:Attempt[],rawCohort:unknown,classify=locationBucket){
 const cohort=cohortSchema.parse(rawCohort),asOf=Date.parse(cohort.asOf),from=Date.parse(cohort.from),to=Date.parse(cohort.to);
 invariant(from<=to&&to<=asOf&&asOf<=Date.now()+300000,'invalid_cohort','Cohort must start before it ends, with end no later than as-of and no future as-of.');
 const exclusions={duplicate:0,notSubmitted:0,missingSubmittedAt:0,afterAsOf:0,outsideCohort:0,unknownLocation:0,incompatibleLocation:0};
 const seen=new Set<string>(),eligible:Attempt[]=[],locations=new Map<string,ReturnType<typeof classify>>();
 for(const a of records){
  if(seen.has(a.identity)){exclusions.duplicate++;continue;}seen.add(a.identity);
  if(!a.submitted){exclusions.notSubmitted++;continue;}
  const at=Date.parse(a.submittedAt||'');
  if(!Number.isFinite(at)){exclusions.missingSubmittedAt++;continue;}
  if(at>asOf){exclusions.afterAsOf++;continue;}
  if(at<from||at>to){exclusions.outsideCohort++;continue;}
  if(!locations.has(a.location)){
   invariant(locations.size<256,'metric_location_limit','Narrow the cohort: at most 256 distinct location descriptions can be normalized per report.');
   locations.set(a.location,classify(a.location));
  }
  const location=locations.get(a.location);
  if(location==='unknown'){exclusions.unknownLocation++;continue;}
  if(location==='excluded'){exclusions.incompatibleLocation++;continue;}
  eligible.push(a);
 }
 const isInterview=(a:Attempt)=>a.interview==='accepted'&&Number.isFinite(Date.parse(a.interviewAt||''))&&Date.parse(a.interviewAt!)<=asOf;
 const rate=(rows:Attempt[])=>{const numerator=rows.filter(isInterview).length,denominator=rows.length;return {numerator,denominator,value:denominator?numerator/denominator:null,smallSample:denominator<20};};
 const breakdowns=Object.fromEntries(dimensions.map(d=>{
  const groups=new Map<string,Attempt[]>();groups.set('unknown',[]);
  for(const a of eligible){const key=segment(a,d);groups.set(key,[...(groups.get(key)||[]),a]);}
  return [d,[...groups].map(([value,rows])=>({segment:value,...rate(rows)}))];
 }));
 const immature=eligible.filter(a=>asOf-Date.parse(a.submittedAt!)<cohort.maturityDays*86400000).length;
 return {cohort,policy:'xavier-annual-usd-nova-dc-v1 / submitted-attempts-v1',primary:rate(eligible),exclusions,considered:records.length,immature,
  unknownOutcome:eligible.filter(a=>!a.outcome||a.outcome==='unknown').length,
  unknownInterview:eligible.filter(a=>a.interview==='unknown').length,breakdowns,
  warnings:[...(eligible.length<20?[`Small sample: ${eligible.length} unique submitted compatible attempts; descriptive counts only.`]:[]),...(immature?[`${immature} attempts are younger than ${cohort.maturityDays} days; outcomes are immature.`]:[]),'Unknown metadata stays unknown. No causal recommendations or scoring changes.']};
}
