export type JobFit={id:string;score:number|null;tier:string|null;status:string;current:boolean;report_artifact_id:string|null;completed_at:string|null;candidate_revision:number};
export const roleSorts=[{value:'score_desc',label:'Score: highest first'},{value:'score_asc',label:'Score: lowest first'},{value:'recent',label:'Recently updated'},{value:'company',label:'Company'}];
export function roleSort(value:string|null){return roleSorts.some(s=>s.value===value)?value!:'score_desc';}
export function currentScore(fit?:JobFit|null){return fit?.current&&typeof fit.score==='number'&&Number.isFinite(fit.score)&&fit.score>=1&&fit.score<=5?fit.score:null;}
export function fitLabel(fit?:JobFit|null){
 const score=currentScore(fit);
 if(score!==null)return {label:score.toFixed(1)+'/5'+(fit?.tier?' / '+fit.tier:''),tone:score>=4?'green' as const:score>=3.5?'amber' as const:'coral' as const};
 if(!fit)return {label:'Not evaluated',tone:'neutral' as const};
 const label=fit.status==='queued'?'Evaluation queued':fit.status==='running'?'Evaluating':fit.status==='failed'?'Evaluation failed':fit.status==='cancelled'?'Evaluation cancelled':fit.status==='review_required'?'Evaluation needs review':'Re-evaluation needed';
 return {label,tone:'amber' as const};
}
export function sortRoles<T extends {id:string;company:string;updated_at?:string;last_seen_at?:string;fit?:JobFit|null}>(roles:readonly T[],sort:string){
 return [...roles].sort((a,b)=>{
  if(sort==='score_desc'||sort==='score_asc'){
   const x=currentScore(a.fit),y=currentScore(b.fit);
   if(x===null&&y!==null)return 1;if(y===null&&x!==null)return -1;
   if(x!==null&&y!==null&&x!==y)return sort==='score_asc'?x-y:y-x;
  }
  if(sort==='company'){const order=a.company.toLowerCase().localeCompare(b.company.toLowerCase());if(order)return order;}
  return (b.updated_at||b.last_seen_at||'').localeCompare(a.updated_at||a.last_seen_at||'')||a.id.localeCompare(b.id);
 });
}
