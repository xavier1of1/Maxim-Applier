import {compile} from 'html-to-text';
import {publicUrl,type UpstreamRow} from './upstream-discovery';
import {invariant} from './errors';
const text=compile({wordwrap:false,limits:{maxInputLength:100000,maxDepth:30,maxChildNodes:5000},selectors:[{selector:'a',options:{ignoreHref:true}},{selector:'img',format:'skip'}]});
const plain=(v:unknown)=>{const t=text(typeof v==='string'?v:'');return (/<\/?(?:p|div|ul|li|br)\b/i.test(t)?text(t):t).slice(0,50000);};
const normalized=(s:unknown)=>String(s||'').normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}]/gu,'');
function titleMatches(actual:unknown,row:UpstreamRow){return normalized(actual)===normalized(row.title);}
export function structuredPosting(html:string,row:UpstreamRow,onExpired?:()=>void){
 const candidates:Record<string,any>[]=[];
 const visit=(value:unknown,depth=0)=>{
  if(depth>8||candidates.length>100)return;
  if(Array.isArray(value)){for(const v of value.slice(0,100))visit(v,depth+1);return;}
  if(!value||typeof value!=='object')return;
  const v=value as Record<string,unknown>,type=Array.isArray(v['@type'])?v['@type']:[v['@type']];
  if(type.includes('JobPosting'))candidates.push(v);
  if(v['@graph'])visit(v['@graph'],depth+1);
 };
 let scripts=0;
 for(const m of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script\s*>/gi)){
  if(++scripts>80)break;
  const mime=m[1].match(/\btype\s*=\s*["']([^"']+)["']/i)?.[1];
  if(!mime||plain(mime).toLowerCase()!=='application/ld+json'||m[2].length>260000)continue;
  try{visit(JSON.parse(m[2]));}catch{}
 }
 const matches=candidates.filter(p=>titleMatches(p.title,row)&&normalized(p.hiringOrganization?.name)===normalized(row.company)&&plain(p.description).trim().length>=50);
 if(matches.length!==1)return null;
 const p=matches[0];
 if(p.validThrough&&Number.isFinite(Date.parse(p.validThrough))&&Date.parse(p.validThrough)<Date.now()){onExpired?.();return null;}
 const locations=(Array.isArray(p.jobLocation)?p.jobLocation:[p.jobLocation]).filter((l:Record<string,any>)=>l?.address?.addressLocality||l?.address?.addressRegion).map((l:Record<string,any>)=>[l.address?.addressLocality,l.address?.addressRegion,l.address?.addressCountry].map(v=>typeof v==='object'?v?.name:v).filter(Boolean).join(', ')).filter(Boolean);
 const posted=Date.parse(p.datePosted);const salary=p.baseSalary?.value;
 return {...row,description:plain(p.description),...(locations.length?{locations,location:locations.join('; ')}:{}),...(Number.isFinite(posted)?{postedAt:posted}:{}),
  ...(p.baseSalary?.currency==='USD'&&salary?.unitText==='YEAR'&&[salary.minValue,salary.maxValue,salary.value].some(v=>typeof v==='number'&&v>0)?{salary:{min:salary.minValue??salary.value,max:salary.maxValue??salary.value,currency:'USD',period:'year'}}:{})};
}
export type DetailResult={row:UpstreamRow;full:boolean;status:string;errorCode?:string};
export async function enrichPosting(row:UpstreamRow,request:(url:string)=>Promise<{text:string}>,allowHost:(host:string)=>void):Promise<DetailResult>{
 const destination=publicUrl(row.applicationUrl||row.url),parts=destination.pathname.split('/').filter(Boolean);
 if(/(^|\.)(linkedin\.com|indeed\.com|glassdoor\.com|dice\.com)$/.test(destination.hostname))return {row,full:false,status:'restricted_destination'};
 let endpoint=destination.href,kind='json_ld';
 const greenhouse=['job-boards.greenhouse.io','job-boards.eu.greenhouse.io','boards.greenhouse.io'].includes(destination.hostname)&&parts.length>=3&&parts.at(-2)==='jobs'&&/^\d+$/.test(parts.at(-1)||'');
 if(greenhouse){endpoint=`https://boards-api.greenhouse.io/v1/boards/${encodeURIComponent(parts[0])}/jobs/${parts.at(-1)}`;kind='greenhouse_detail';}
 else if(destination.hostname==='speedrun-talent-network.com'&&parts[0]==='jobs'&&parts[1]){endpoint=`https://speedrun-talent-network.com/api/v1/jobs/${encodeURIComponent(String(row.externalId||parts[1]))}?source=career-ops`;kind='a16z_detail';}
 else if(destination.hostname==='jobs.lever.co'&&parts.length===2){endpoint=`https://api.lever.co/v0/postings/${encodeURIComponent(parts[0])}/${encodeURIComponent(parts[1])}?mode=json`;kind='lever_detail';}
 else if(destination.hostname.endsWith('.myworkdayjobs.com')){
  const tenant=destination.hostname.split('.')[0],m=destination.pathname.match(/^\/(?:[a-z]{2}-[A-Z]{2}\/)?([^/]+)\/(job\/.+)$/);
  if(m){endpoint=`${destination.origin}/wday/cxs/${tenant}/${m[1]}/${m[2]}`;kind='workday_detail';}
 }
 allowHost(publicUrl(endpoint).hostname);
 try{
  const response=await request(endpoint);let resolved:UpstreamRow|null=null;
  if(kind==='json_ld'){
   let expired=false;resolved=structuredPosting(response.text,row,()=>{expired=true;});
   if(expired)return {row,full:false,status:'posting_expired'};
  }
  else{
   const payload=JSON.parse(response.text),p=kind==='a16z_detail'?payload.job:payload.jobPostingInfo||payload;
   invariant(p&&typeof p==='object','posting_details_unavailable','The detail endpoint did not return a posting.');
   if(kind==='a16z_detail'){
    if(p.status!=='open')return {row,full:false,status:'posting_closed'};
    invariant(normalized(p.company)===normalized(row.company)&&(!row.externalId||String(p.id)===String(row.externalId)),'posting_changed','Detail employer or identity differs from the discovered opening.');
   }
   const actualTitle=kind==='lever_detail'?p.text:p.title;
   invariant(titleMatches(actualTitle,row),'posting_changed','Detail title differs from the discovered opening.');
   if(kind==='greenhouse_detail')invariant(String(p.id)===parts.at(-1),'posting_changed','Detail identity differs from the discovered opening.');
   if(kind==='lever_detail')invariant(String(p.id)===parts.at(-1),'posting_changed','Detail identity differs from the discovered opening.');
   const sections=Array.isArray(p.lists)?p.lists.map((s:{text?:string;content?:string})=>plain(s.text)+'\n'+plain(s.content)).join('\n'):'';
   const description=[plain(p.content||p.jobDescription||p.descriptionPlain||p.description_text||p.description),sections,plain(p.additionalPlain||p.additional)].filter(Boolean).join('\n').slice(0,50000);
   if(description.length>=50)resolved={...row,description,...(kind==='a16z_detail'&&p.apply?.kind==='external'&&typeof p.apply.url==='string'?{applicationUrl:publicUrl(p.apply.url).href}:{})};
  }
  if(!resolved)return {row,full:false,status:'full_description_unavailable'};
  return {row:{...resolved,descriptionEvidence:{kind,url:endpoint}},full:true,status:'verified_full'};
 }catch(e){const code=(e as {code?:string}).code||'detail_failed';return {row,full:false,status:['source_not_found','http_failure'].includes(code)?'unavailable':'detail_failed',errorCode:code};}
}
