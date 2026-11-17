import fs from 'node:fs';
import crypto from 'node:crypto';
import {harness} from '../tests/support/harness.mjs';
import {delay} from './environment.mjs';
if(process.argv[2]!=='--live'){console.error('Explicit --live required. One bounded public Greenhouse board GET, no credentials, disposable DB.');process.exit(2);}
const board=process.argv[3]||'duolingo';if(!/^[a-zA-Z0-9_-]{1,100}$/.test(board))throw Error('Invalid board slug');
const h=await harness();
try{
 const c=JSON.parse(fs.readFileSync(h.runtime,'utf8'));delete c.discoveryFixtureOrigin;fs.writeFileSync(h.runtime,JSON.stringify(c));
 const cmd=async(action,payload)=>{const r=await h.request(h.a,'/api/discovery/commands',{method:'POST',body:{commandId:crypto.randomUUID(),action,payload}});if(!r.ok)throw Error('Smoke command failed');return (await r.json()).result;};
 const source=await cmd('add_source',{name:'Public smoke '+board,provider:'greenhouse',board});
 const run=await cmd('start_search',{sourceIds:[source.id],terms:['engineer']});await h.startWorker();
 let result;
 for(let i=0;i<160;i++){
  const r=(await h.sql('SELECT status,counts,error_code,completed_at FROM discovery_runs WHERE id=$1',[run.id])).rows[0];
  if(!['queued','running'].includes(r.status)){result=r;break;}await delay(500);
 }
 if(!result)throw Error('Public smoke did not finish within its bounded test window.');
 const requests=(await h.sql('SELECT request_url,status,http_status,bytes,error_code,fixture_transport,started_at,completed_at FROM discovery_requests WHERE run_id=$1',[run.id])).rows;
 const attempts=(await h.sql('SELECT status,error_code,record_count,page_count FROM discovery_attempts WHERE run_id=$1',[run.id])).rows;
 const pages=(await h.sql('SELECT content_hash,record_count,captured_at FROM discovery_pages WHERE run_id=$1',[run.id])).rows;
 console.log(JSON.stringify({at:new Date().toISOString(),scope:'One public board, no accounts, no application actions; not universal coverage.',board,result,requests,attempts,pages,isolated:true},null,2));
 if(result.status!=='completed'||requests.length!==1||requests.some(r=>r.fixture_transport))process.exitCode=1;
}finally{await h.close();}
