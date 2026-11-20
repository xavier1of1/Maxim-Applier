import {z} from 'zod';
import {activeLead} from './intelligence-policy';

export function jobFilters(q:URLSearchParams,timezone='America/New_York'){
 const values:unknown[]=[],clauses:string[]=[];
 const add=(value:unknown)=>{values.push(value);return '$'+(values.length+2);};
 for(const [key,column]of [['company','j.company'],['industry','j.industry'],['lane','j.role_lane']]as const){
  const v=z.string().max(200).parse(q.get(key)||'');if(v)clauses.push(key!=='company'&&v==='Unknown'?column+' IS NULL':column+'='+add(v));
 }
 const text=z.string().max(200).parse(q.get('q')||'');if(text)clauses.push("strpos(lower(j.title||' '||j.company||' '||coalesce(j.location,'')),lower("+add(text)+'))>0');
 const location=z.string().max(200).parse(q.get('location')||'');if(location)clauses.push("strpos(lower(coalesce(j.location,'')),lower("+add(location)+'))>0');
 const filter=q.get('filter');if(filter==='active'||filter==='archived')clauses.push(filter==='active'?activeLead:'j.archived');
 const flags="coalesce(CASE WHEN fit.current THEN fit.policy->'flags' END,j.discovery_policy->'flags','[]')";
 const group=filter==='archived'?null:q.get('locationGroup'),local=flags+" @> '[{\"flagType\":\"location\",\"severity\":\"positive\"}]'",outside=flags+" @> '[{\"flagType\":\"location\",\"severity\":\"blocker\"}]'";
 if(group==='local')clauses.push('('+local+') AND NOT ('+outside+')');
 if(group==='outside')clauses.push(outside);
 if(group==='review')clauses.push('NOT ('+local+') AND NOT ('+outside+')');
 if(group==='focus')clauses.push('('+local+' OR j.opening_key IS NULL OR a.id IS NOT NULL OR d.state=\'saved\')');
 const age=q.get('age');if(age==='unknown')clauses.push('j.posted_at IS NULL');
 if(['today','7','30'].includes(age||'')){
  clauses.push('j.posted_at<=now()');
  if(age==='today'){const zone=add(timezone);clauses.push("j.posted_at>=(date_trunc('day',now() AT TIME ZONE "+zone+") AT TIME ZONE "+zone+')');}
  else clauses.push('j.posted_at>=now()-'+add(Number(age))+"*interval '1 day'");
 }
 for(const key of ['minScore','maxScore'])if(q.get(key))clauses.push('fit.current AND fit.score'+(key==='minScore'?'>=':'<=')+add(z.coerce.number().min(1).max(5).parse(q.get(key))));
 if(q.get('fit')==='current')clauses.push('fit.current');
 if(q.get('fit')==='unscored')clauses.push('coalesce(fit.current,false)=false');
 const limit=z.coerce.number().int().min(1).max(500).parse(q.get('limit')||500),offset=z.coerce.number().int().min(0).max(10000000).parse(q.get('offset')||0);
 return {sql:clauses.length?' AND '+clauses.map(c=>'('+c+')').join(' AND '):'',values,limit,offset};
}
