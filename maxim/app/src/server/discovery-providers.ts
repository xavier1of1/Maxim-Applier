import {compile} from 'html-to-text';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {DiscoveryError} from './discovery-network';
import {invariant} from './errors';
import {upstreamDefinition} from './upstream-discovery';

export type Source={id:string;name:string;provider:string;board:string;careers_url:string;revision:number;enabled:boolean};
export const supported=['greenhouse','lever','ashby'];
export const providerHosts=['boards-api.greenhouse.io','boards.greenhouse.io','job-boards.greenhouse.io','job-boards.eu.greenhouse.io','api.lever.co','api.ashbyhq.com'];
export function sourceDefinition(provider:string,board:string,careersUrl?:string,configuration?:Record<string,unknown>){
 if(!supported.includes(provider)&&provider!=='manual')return upstreamDefinition(provider,board,careersUrl,configuration);
 if(provider==='manual'){
  invariant(careersUrl,'invalid_source','A manual source requires its careers URL.');
  const u=new URL(careersUrl||'');invariant(u.protocol==='https:'&&!u.username&&!u.password&&!u.hash,'invalid_source','Manual source must be a public HTTPS URL.');
  return {provider,board:'',careers_url:u.href};
 }
 invariant(/^[a-zA-Z0-9_-]{1,100}$/.test(board),'invalid_board','Use the provider board slug, not a URL or command.');
 const host=provider==='greenhouse'?'job-boards.greenhouse.io':provider==='lever'?'jobs.lever.co':'jobs.ashbyhq.com';
 return {provider,board,careers_url:'https://'+host+'/'+board};
}
export function feedUrl(source:Source,page=0,compact=false){
 if(source.provider==='greenhouse')return 'https://boards-api.greenhouse.io/v1/boards/'+source.board+'/jobs'+(compact?'':'?content=true');
 if(source.provider==='lever')return 'https://api.lever.co/v0/postings/'+source.board+'?mode=json&limit=100&skip='+page*100;
 if(source.provider==='ashby')return 'https://api.ashbyhq.com/posting-api/job-board/'+source.board+'?includeCompensation=true';
 throw new DiscoveryError('unsupported','This source requires manual discovery; no automated adapter is enabled.');
}
export function greenhousePostingUrl(source:Source,id:string){
 invariant(source.provider==='greenhouse'&&/^[a-zA-Z0-9_-]{1,100}$/.test(source.board)&&/^[1-9][0-9]{0,18}$/.test(id),'invalid_posting_source','A verified Greenhouse board and posting ID are required.');
 return feedUrl(source,0,true)+'/'+id;
}
export function matchesRoleTerms(job:{title:string;description:string},terms:string[],matchIn:string){
 const normal=(s:string)=>s.normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}+#.]+/gu,' ').trim();
 const haystack=normal(matchIn==='title'?job.title:job.title+' '+job.description);
 return terms.some(term=>{const value=normal(term);return value.length>0&&haystack.includes(value);});
}
export function pageRecords(provider:string,value:unknown):Record<string,unknown>[]{
 const object=value as {jobs?:unknown;meta?:{total?:unknown}};
 const rows=provider==='lever'?value:object?.jobs;
 invariant(Array.isArray(rows)&&rows.length<=10000&&rows.every(r=>r&&typeof r==='object'&&!Array.isArray(r)),'schema_drift','Provider response does not match its documented job list.');
 return rows;
}
const text=compile({wordwrap:false,limits:{maxInputLength:100000,maxDepth:30,maxChildNodes:5000,maxBaseElements:1000},selectors:[{selector:'a',options:{ignoreHref:true}},{selector:'img',format:'skip'}]});
const str=(v:unknown,max=50000)=>typeof v==='string'?v.slice(0,max):'';
const date=(v:unknown)=>typeof v==='string'&&Number.isFinite(Date.parse(v))?new Date(v).toISOString():null;
export function postingIdentity(url:string,fallback:string){
 const u=new URL(url),p=u.pathname.split('/').filter(Boolean);
 if(['jobs.lever.co','jobs.ashbyhq.com','job-boards.greenhouse.io','job-boards.eu.greenhouse.io','boards.greenhouse.io'].includes(u.hostname)&&p.length>=2){
  const id=['jobs.lever.co','jobs.ashbyhq.com'].includes(u.hostname)?p[1]:p.at(-1);
  return u.hostname.replace('job-boards.eu.greenhouse.io','greenhouse').replace('job-boards.greenhouse.io','greenhouse').replace('boards.greenhouse.io','greenhouse')+':'+p[0]+':'+id;
 }
 return fallback;
}
export type NormalizedJob={externalId:string;openingKey:string;title:string;company:string;location:string;locations:string[];description:string;url:string;applicationUrl:string;postedAt:string|null;updatedAt:string|null;dateBasis:string;salary:Record<string,unknown>|null;raw:Record<string,unknown>};
export async function normalizeProvider(source:Source,pages:Record<string,unknown>[][]):Promise<NormalizedJob[]>{
 invariant(supported.includes(source.provider),'unsupported','No automated adapter is enabled.');
 const native=pathToFileURL(path.resolve(/* turbopackIgnore: true */ process.cwd(),'../../providers',source.provider+'.mjs')).href;
 const provider=(await import(/* webpackIgnore: true */ /* turbopackIgnore: true */ native)).default as {fetch:Function};
 const raw=pages.flat().filter(row=>source.provider!=='ashby'||row.isListed!==false);
 // Reuse retained mapping only. This injected transport cannot perform HTTP or native writes.
 const payload=source.provider==='lever'?raw:{jobs:raw};
 const mapped=await provider.fetch({name:source.name,careers_url:source.careers_url,api:feedUrl(source)},{fetchJson:async()=>payload});
 const byUrl=new Map(raw.map(r=>[str(r.absolute_url||r.hostedUrl||r.jobUrl),r]));
 const result:NormalizedJob[]=[];
 for(const row of mapped){
  const r=byUrl.get(row.url);if(!r)throw new DiscoveryError('schema_drift','A retained mapped job could not be matched to its source record.');
  const title=str(row.title,200),url=str(row.url,2048),id=String(r.id||(source.provider==='ashby'?new URL(url).pathname.split('/').filter(Boolean).at(-1):'')||'');
  invariant(title&&url&&id&&id.length<=200,'schema_drift','A provider job is missing its title, URL or external identity.');
  const u=new URL(url);invariant(u.protocol==='https:'&&!u.username&&!u.password,'invalid_destination','Provider destination is not a credential-free HTTPS URL.');
  const extra=Array.isArray(r.secondaryLocations)?r.secondaryLocations.map((x:unknown)=>str((x as {location?:unknown})?.location,300)): [];
  const location=str(row.location,1000),locations=[location,...extra].filter(Boolean);
  const postedAt=date(r.first_published||r.publishedAt),updatedAt=date(r.updated_at);
  let salary:Record<string,unknown>|null=null;
  const compensation=r.compensation as {summaryComponents?:Record<string,unknown>[]} |undefined;
  const components=compensation?.summaryComponents;
  if(components?.length===1){const c=components[0];if(c.compensationType==='Salary'&&c.interval==='1 YEAR'&&c.currencyCode==='USD')salary={min:c.minValue,max:c.maxValue,currency:'USD',period:'annual'};}
  if(source.provider==='lever'&&r.salaryRange){const s=r.salaryRange as Record<string,unknown>;salary={min:s.min,max:s.max,currency:s.currency,period:s.interval==='per-year-salary'?'annual':s.interval};}
  const applicationUrl=str(r.applyUrl,2048)||u.href,application=new URL(applicationUrl);
  invariant(application.protocol==='https:'&&!application.username&&!application.password,'invalid_destination','Application destination is not a credential-free HTTPS URL.');
  result.push({externalId:id,openingKey:postingIdentity(url,source.provider+':'+source.board+':'+id),title,company:source.name,location,locations,
   description:(str(r.descriptionPlain)||text(str(r.content||r.descriptionHtml||r.description))).slice(0,50000),url:u.href,
   applicationUrl:application.href,postedAt,updatedAt,dateBasis:postedAt?(r.first_published?'first_published':'publishedAt'):'unknown',salary,raw:r});
 }
 return result;
}
