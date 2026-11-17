import type {PoolClient} from 'pg';
export function canonicalJobUrl(value:string|null){
 if(!value)return null;try{const u=new URL(value);u.hash='';for(const key of [...u.searchParams.keys()])if(key.startsWith('utm_')||['gh_src','lever-source'].includes(key))u.searchParams.delete(key);u.searchParams.sort();u.pathname=u.pathname.replace(/\/$/,'')||'/';return u.href;}catch{return null;}
}
export async function duplicateRisk(tx:PoolClient,w:string,job:Record<string,any>,applicationId?:string){
 const rows=(await tx.query('SELECT a.id,a.job_id,a.outcome,a.workflow,j.company,j.title,j.url,j.opening_key FROM applications a JOIN jobs j ON j.id=a.job_id AND j.workspace_id=a.workspace_id WHERE a.workspace_id=$1 AND ($2::uuid IS NULL OR a.id<>$2)',[w,applicationId||null])).rows;
 const same=rows.filter(r=>r.job_id===job.id||job.opening_key&&r.opening_key===job.opening_key||canonicalJobUrl(job.url)&&canonicalJobUrl(r.url)===canonicalJobUrl(job.url));
 if(same.length)return {risk:'same_opening',warning:'Another application record refers to the same posting identity. Resolve it or explicitly record a reviewed reapplication; records are never silently merged.',matches:same.map(r=>({applicationId:r.id,jobId:r.job_id,outcome:r.outcome}))};
 const similar=rows.filter(r=>r.company.trim().toLowerCase()===job.company.trim().toLowerCase()&&r.title.trim().toLowerCase()===job.title.trim().toLowerCase());
 return {risk:similar.length?'distinct_or_uncertain_opening':'none',warning:similar.length?'Same company/title has another opening. Different posting IDs are allowed; verify the distinct opening before proceeding.':null,matches:similar.map(r=>({applicationId:r.id,jobId:r.job_id,outcome:r.outcome}))};
}
