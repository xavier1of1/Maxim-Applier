import {readFileSync,readdirSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';

export const vendorRoot=fileURLToPath(new URL('../vendor/career-ops-discovery/',import.meta.url));
export const sourceLock=JSON.parse(readFileSync(new URL('../vendor/career-ops-discovery/source-lock.json',import.meta.url),'utf8'));
const words=s=>new Set(s.split(' '));
const boards=words('4dayweek a16z-speedrun-talent agentic-jobs arbeitnow arbeitsagentur builtin bulldogjob careerpuck careerviet computrabajo cryptocurrencyjobs echojobs flowxtra generalist-world germantechjobs getonbrd glints hackernews higheredjobs himalayas itviec jobbankca jobicy jobscz jobspresso jobstreet joinup justjoin kalibrr kariyer landingjobs larajobs manfred mycareersfuture nodesk nofluffjobs occ platsbanken pracecz pythonorg remote-com remoteok remotive remotli senjob solidjobs startup-jobs techinasia tes thehub themuse torre vdab wellfound weworkremotely workingnomads wttj yourator');
const employers=words('aldi-nord alibaba amazon apple atlassian bwi dassault deutschebahn garena goldman google hecklerkoch ibm meituan notion rheinmetall tencent tkms');
const regional=words('arbeitnow arbeitsagentur bulldogjob careerviet computrabajo germantechjobs getonbrd glints itviec jobbankca jobscz jobstreet joinup justjoin kalibrr kariyer manfred mycareersfuture nofluffjobs occ platsbanken pracecz senjob solidjobs techinasia thehub vdab yourator');
const remote=words('4dayweek cryptocurrencyjobs himalayas jobicy jobspresso nodesk remote-com remoteok remotive remotli weworkremotely workingnomads');
const complete=words('greenhouse lever ashby join wellfound careerpuck remotive remoteok jobicy himalayas workingnomads weworkremotely agentic-jobs');
const gated=new Map([['local-parser','Executable local parsers require separate approval; never run by discovery.'],['torre','Upstream marks this service retired.'],['themuse','Public endpoint has reported access challenges; not certified.'],['telegram-channel','Not a public job-board API; requires a separate source policy.'],['mokahr','Encrypted payload/session handling needs a separate transport review.'],['peoplesoft','Stateful session transport is not approved in the read-only bridge.'],['successfactors-classic','Stateful session transport is not approved in the read-only bridge.']]);
export const boardPack=['builtin','wellfound','hackernews','a16z-speedrun-talent'];
export const remotePack=['himalayas','remotive','remoteok','jobicy','workingnomads','weworkremotely'];
export const reverseFamilies=['greenhouse','lever','ashby','workday','icims','bamboohr','paylocity','join','workable'];

export const catalog=readdirSync(new URL('../vendor/career-ops-discovery/providers/',import.meta.url)).filter(f=>f.endsWith('.mjs')&&!f.startsWith('_')).sort().map(file=>{
 const id=file.slice(0,-4),source=readFileSync(new URL('../vendor/career-ops-discovery/providers/'+file,import.meta.url),'utf8');
 const urls=[...source.matchAll(/https:\/\/([a-zA-Z0-9.-]+)(?=[/`'"\s])/g)].map(m=>m[1].toLowerCase()).filter(h=>h.includes('.')&&!['example.com','github.com','developers.google.com'].includes(h));
 const kind=id==='local-parser'?'local_parser':employers.has(id)?'single_employer':id==='getro'||boards.has(id)&&id!=='careerpuck'?'board_wide':'tenant_ats';
 if(id==='lever')urls.push('api.lever.co','api.eu.lever.co');
 return {id,kind,region:regional.has(id)?'regional':remote.has(id)?'remote':'source_defined',query:boards.has(id)?(/search|queries|keywords|\bq:/.test(source)?'provider_specific':'feed_local_filter'):'tenant_or_employer',description:complete.has(id)?'full_when_present':'summary_or_unknown',state:id==='torre'?'retired':gated.has(id)?'blocked':'available',reason:gated.get(id)||'Configuration and live source validation required.',hosts:[...new Set(urls)],permission:'Public access only; stop on authentication, challenges or publisher restrictions.',limits:{pages:2,requests:12,bytesPerResponse:5242880,seconds:80},sha256:sourceLock.hashes['providers/'+file]};
});
export function providerCapability(id){return catalog.find(c=>c.id===id);}
export function verifyBundle(){
 for(const [file,hash] of Object.entries(sourceLock.hashes)){
  const actual=createHash('sha256').update(readFileSync(new URL('../vendor/career-ops-discovery/'+file,import.meta.url))).digest('hex');
  if(actual!==hash)throw new Error('Pinned discovery source changed: '+file);
 }
 if(catalog.length!==153)throw new Error('The pinned discovery catalog must account for 153 providers.');
 return {commit:sourceLock.commit,providers:catalog.length,files:Object.keys(sourceLock.hashes).length};
}
if(process.argv.includes('--write'))writeFileSync(new URL('./catalog.json',import.meta.url),JSON.stringify({commit:sourceLock.commit,release:sourceLock.release,providers:catalog},null,2)+'\n');
