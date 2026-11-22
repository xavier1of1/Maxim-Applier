import path from 'node:path';
import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';
import {compile} from 'html-to-text';
import {readFileSync} from 'node:fs';
import {invariant} from './errors';
import type {Source,NormalizedJob} from './discovery-providers';
import {postingIdentity} from './discovery-providers';

type Capability={id:string;kind:string;region:string;query:string;description:string;state:string;reason:string;hosts:string[];permission:string;limits:Record<string,number>;sha256:string};
const catalogData=JSON.parse(readFileSync(path.resolve(/* turbopackIgnore: true */ process.cwd(),'../upstream-discovery/catalog.json'),'utf8')) as {commit:string;providers:Capability[]};
export const upstreamCatalog=catalogData.providers;
export const upstreamCommit=catalogData.commit;
export const sourcePacks={us_tech:['builtin','wellfound','hackernews','a16z-speedrun-talent'],remote:['himalayas','remotive','remoteok','jobicy','workingnomads','weworkremotely'],reverse_ats:['greenhouse','lever','ashby','workday','icims','bamboohr','paylocity','join','workable']};
export const isMarketProvider=(p:string)=>p.startsWith('reverse:')||!['greenhouse','lever','ashby','manual'].includes(p);
export const capability=(id:string)=>upstreamCatalog.find(c=>c.id===id.replace(/^reverse:/,''));
export function publicDiscoveryRead(provider:string,url:URL,method:string,body?:string){
 if(method==='GET')return !body;
 if(method!=='POST'||!body||Buffer.byteLength(body)>16000)return false;
 const family=provider.replace(/^reverse:/,'');
 if(family==='workday')return url.hostname.endsWith('.myworkdayjobs.com')&&/^\/wday\/cxs\/[^/]+\/[^/]+\/jobs$/.test(url.pathname);
 if(family!=='join'||url.origin!=='https://join.com'||url.pathname!=='/candidate-api/graphql'||url.search)return false;
 try{
  const p=JSON.parse(body),v=p.variables?.input,page=v?.paginationPage;
  // Exact pinned PublicJobsList query; never authorize arbitrary GraphQL operations.
  return Object.keys(p).sort().join(',')==='operationName,query,variables'&&p.operationName==='PublicJobsList'&&typeof p.query==='string'&&createHash('sha256').update(p.query.replace(/\s+/g,'')).digest('hex')==='c35ade11e6107c5bf0f03657e8eb52180a799f5ca9db8fd9d0e445367e7a4074'
   &&Object.keys(p.variables).join(',')==='input'&&Object.keys(v).sort().join(',')==='companyId,filters,paginationPage'&&Number.isSafeInteger(v.companyId)&&v.companyId>0
   &&v.filters&&Object.keys(v.filters).length===0&&page&&Object.keys(page).sort().join(',')==='page,pageSize'&&Number.isInteger(page.page)&&page.page>=1&&page.page<=2&&page.pageSize===100;
 }catch{return false;}
}
export function publicUrl(value:string){
 const u=new URL(value);invariant(u.protocol==='https:'&&!u.username&&!u.password&&!u.hash&&(!u.port||u.port==='443'),'invalid_destination','Only credential-free public HTTPS source URLs are allowed.');return u;
}
export function upstreamDefinition(provider:string,board:string,careersUrl?:string,configuration:Record<string,unknown>={}){
 const c=capability(provider);invariant(c&&!['blocked','retired'].includes(c.state),'provider_unavailable',c?.reason||'Unknown pinned provider.');
 invariant(!JSON.stringify(configuration).match(/"(?:command|parser|script|cookies?|headers|authorization|proxy|password|(?:api[_-]?)?key|secret|client[_-]?secret|(?:access|refresh)[_-]?token|token)"\s*:/i)&&Buffer.byteLength(JSON.stringify(configuration))<=12000,'source_configuration_refused','Executable configuration, credentials and oversized source options are refused.');
 const reverse=provider.startsWith('reverse:');
 invariant(!reverse||sourcePacks.reverse_ats.includes(c.id),'invalid_provider','This ATS has no upstream reverse inventory.');
 const defaults:Record<string,string>={builtin:'https://builtin.com/jobs/dev-engineering',wellfound:'https://wellfound.com/role/l/software-engineer/washington-dc',hackernews:'https://news.ycombinator.com/', 'a16z-speedrun-talent':'https://speedrun-talent-network.com/',himalayas:'https://himalayas.app/jobs',remotive:'https://remotive.com/remote-jobs',remoteok:'https://remoteok.com/',jobicy:'https://jobicy.com/',workingnomads:'https://www.workingnomads.com/jobs',weworkremotely:'https://weworkremotely.com/'};
 const url=careersUrl||defaults[c.id]||(reverse?'https://github.com/Feashliaa/job-board-aggregator':'');
 invariant(url,'source_url_required','This provider requires its actual public careers URL.');
 publicUrl(url);
 return {provider,board:board||c.id,careers_url:url,native_definition:{...configuration,provider:c.id,name:c.id,careers_url:url,upstreamCommit,kind:reverse?'reverse_ats':c.kind}};
}
export type UpstreamRow={title:string;url:string;company?:string;location?:string;locations?:string[];description?:string;postedAt?:number;salary?:Record<string,unknown>;applicationUrl?:string;externalId?:string;listingIdentity?:{ats_provider:string;board_slug:string;posting_id:string};[k:string]:unknown};
export function canonicalOpeningUrl(value:string){
 const u=publicUrl(value);
 for(const key of [...u.searchParams.keys()])if(/^utm_/i.test(key)||['gclid','fbclid'].includes(key.toLowerCase()))u.searchParams.delete(key);
 u.searchParams.sort();u.pathname=u.pathname.replace(/\/$/,'')||'/';return u.href;
}
export type ProviderResult={jobs:UpstreamRow[];returned:number;partial:{reason:string}|null};
type RequestOptions={method?:string;body?:string;headers?:Record<string,string>};
export async function upstreamRun(provider:string,entry:Record<string,unknown>,signal:AbortSignal,request:(url:string,options:RequestOptions)=>Promise<{text:string;status:number;contentType:string}>,extra:Record<string,unknown>={}):Promise<ProviderResult>{
 const moduleUrl=pathToFileURL(path.resolve(/* turbopackIgnore: true */ process.cwd(),'../upstream-discovery/bridge.mjs')).href;
 const bridge=await import(/* webpackIgnore: true */ /* turbopackIgnore: true */ moduleUrl);
 return bridge.runProvider({provider,entry,signal,request,...extra});
}
const plain=compile({wordwrap:false,limits:{maxInputLength:100000,maxDepth:30,maxChildNodes:5000},selectors:[{selector:'a',options:{ignoreHref:true}},{selector:'img',format:'skip'}]});
export function upstreamNormalize(source:Source,row:UpstreamRow):NormalizedJob{
 const title=String(row.title||'').trim().slice(0,200),company=String(row.company||'').trim().slice(0,180);
 invariant(title&&company,'posting_identity_missing','A board result must identify its actual employer and title.');
 invariant(capability(source.provider)?.kind!=='board_wide'||company!==source.name,'posting_identity_missing','The board did not identify this posting\'s actual employer.');
 const url=publicUrl(row.url).href,applicationUrl=publicUrl(row.applicationUrl||row.url).href;
 const listing=row.listingIdentity;
 const listed=listing?.ats_provider&&listing.board_slug&&listing.posting_id?`${listing.ats_provider}:${listing.board_slug}:${listing.posting_id}`:null;
 const key=postingIdentity(applicationUrl,postingIdentity(url,listed||'url:'+canonicalOpeningUrl(url)));
 const timestamp=typeof row.postedAt==='number'&&Number.isFinite(row.postedAt)&&Math.abs(row.postedAt)<=8640000000000000?new Date(row.postedAt).toISOString():null;
 const raw={...row,description:undefined};
 return {externalId:String(row.externalId||key).slice(0,500),openingKey:key,title,company,location:String(row.location||'').slice(0,1000),locations:Array.isArray(row.locations)?row.locations.slice(0,30).map(String):[String(row.location||'')],description:plain(String(row.description||'')).slice(0,50000),url,applicationUrl,postedAt:timestamp,updatedAt:null,dateBasis:timestamp?'provider_posted_at':'unknown',salary:row.salary||null,raw};
}
export function upstreamEntry(source:Source,terms:string[],profile?:Record<string,unknown>,lookbackDays=7):Record<string,unknown>{
 const entry={...(source as Source&{native_definition?:Record<string,unknown>}).native_definition,name:source.name,provider:source.provider,careers_url:source.careers_url,max_pages:2};
 if(source.provider==='builtin')return {...entry,builtin:{categories:['dev-engineering'],max_pages:2,...(profile?{scope:'washington-dc',...(Array.isArray(profile.seniorityLevels)&&profile.seniorityLevels.length&&!profile.seniorityLevels.some(l=>['senior','staff','leadership'].includes(String(l)))?{queries:['junior software engineer','software engineer ii']}:{})}:{})}};
 if(source.provider==='wellfound')return {...entry,wellfound:{locations:['washington-dc'],max_companies:0}};
 if(source.provider==='a16z-speedrun-talent')return {...entry,max_pages:2,...(profile?{maximPublicFilters:{metro:'dc',fn:'engineering,product,operations,customer,sales,other',...(lookbackDays<=30?{posted:lookbackDays<=1?'24h':lookbackDays<=7?'7d':'30d'}:{})}}:{})};
 return entry;
}
