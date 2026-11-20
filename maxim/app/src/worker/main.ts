import crypto from 'node:crypto';
import {database} from '../server/db';
import {config,configFile} from '../server/config';
import {claimWork,renewWork,failWork,type WorkItem} from '../server/work';
import {extractSource,purgeArtifact,expireRawSources} from './extraction';
import {DomainError} from '../server/errors';
import {projectionWork} from '../server/projections';
import {expireAnswers} from '../server/answer-retention';
import {discoverJobs} from './discovery';
import {evaluateJob} from './evaluation';
import {buildPacket} from './packet';
import {applicationProjectionWork} from '../server/application-projections';
import {expireApplicationWork} from '../server/private-artifacts';
import {browserAction,closeBrowserSessions} from './browser';
import {gmailWork} from './gmail';
import {expireGmail} from '../server/integrations/gmail/reads';
import {deliverDiscord,tickDiscord} from './discord';
import {practiceInterview} from './interview';
import {expireInterviews} from '../server/interview/service';
import {tickIntelligence,runIntelligenceCycle} from '../server/intelligence-cycle';
import {setTimeout as wait} from 'node:timers/promises';

config();
const runtimeFlag=process.argv.indexOf('--runtime-file');
if(runtimeFlag>=0&&process.argv[runtimeFlag+1]!==configFile())throw Error('Worker runtime identity does not match configuration.');
const workerId='worker-'+crypto.randomUUID();
let stopping=false;
process.on('SIGINT',()=>{stopping=true;});
process.on('SIGTERM',()=>{stopping=true;});
const delay=(ms:number)=>new Promise<void>(resolve=>setTimeout(resolve,ms));
export async function executeWork(item:WorkItem,signal?:AbortSignal){
 if(item.kind==='intelligence_cycle')return runIntelligenceCycle(item);
 if(item.kind==='gmail_sync'||item.kind==='gmail_revoke')return gmailWork(item,signal||AbortSignal.timeout(35000));
 if(item.kind==='discord_delivery')return deliverDiscord(item,signal);
 if(item.kind==='interview_feedback')return practiceInterview(item,signal);
 if(item.kind==='browser_action')return browserAction(item,signal);
 if(item.kind==='evaluate_job')return evaluateJob(item,signal);
 if(item.kind==='build_packet')return buildPacket(item,signal);
 if(item.kind==='project_applications')return applicationProjectionWork(item);
 if(item.kind==='discover_jobs')return discoverJobs(item,signal);
 if(item.kind==='extract_source')return extractSource(item);
 if(item.kind==='purge_artifact')return purgeArtifact(item);
 if(item.kind==='project_candidate')return projectionWork(item);
 throw new DomainError('unsupported_work','This worker does not support the requested work type.');
}
async function main(){
 let maintenanceAt=0,tickAt=0,intelligenceAt=0;
 while(!stopping){
  let active:WorkItem|null=null,finished=false;
  const renewalStop=new AbortController(),executionStop=new AbortController();
  try{
   await database().query('INSERT INTO worker_heartbeats(worker_id) VALUES($1) ON CONFLICT(worker_id) DO UPDATE SET last_seen=now()',[workerId]);
   if(Date.now()-tickAt>=1000){tickAt=Date.now();await tickDiscord();}
   if(Date.now()-intelligenceAt>=60000){intelligenceAt=Date.now();await tickIntelligence();}
   if(Date.now()-maintenanceAt>=30000){maintenanceAt=Date.now();await expireRawSources();await expireAnswers();await expireApplicationWork();await expireGmail();await expireInterviews();}
   active=await claimWork(workerId);
   if(!active){await delay(1000);continue;}
   const current=active;
   const renewal=(async()=>{for(let attempt=0;attempt<8&&!finished;attempt++){
    await wait(10000,undefined,{signal:renewalStop.signal});if(finished)break;
    if(!await renewWork(current)){executionStop.abort();break;}
    await database().query('UPDATE worker_heartbeats SET last_seen=now() WHERE worker_id=$1',[workerId]);
   }})().catch(()=>{});
   await executeWork(current,executionStop.signal);finished=true;
   void renewal.catch(()=>{});
  }catch(e){
   finished=true;
   if(active)await failWork(active,e instanceof DomainError?e.code:'worker_unavailable',!(e instanceof DomainError)).catch(()=>{});
   await delay(1000);
  }finally{finished=true;renewalStop.abort();executionStop.abort();}
 }
 await closeBrowserSessions();
 await database().query('DELETE FROM worker_heartbeats WHERE worker_id=$1',[workerId]).catch(()=>{});
 await database().end();
}
main().catch(()=>{console.error('Worker stopped without acknowledging work. Expired leases remain recoverable.');process.exitCode=1;});
