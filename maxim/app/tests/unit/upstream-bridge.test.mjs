import test from 'node:test';
import assert from 'node:assert/strict';
import {catalog,verifyBundle,runProvider} from '../../../upstream-discovery/bridge.mjs';

test('pinned catalog accounts for all 153 providers without conflating source types or certification',()=>{
 assert.equal(verifyBundle().providers,153);assert.equal(new Set(catalog.map(c=>c.id)).size,153);
 assert.equal(catalog.find(c=>c.id==='builtin').kind,'board_wide');
 assert.equal(catalog.find(c=>c.id==='greenhouse').kind,'tenant_ats');
 assert.equal(catalog.find(c=>c.id==='amazon').kind,'single_employer');
 assert.equal(catalog.find(c=>c.id==='torre').state,'retired');
 assert.equal(catalog.find(c=>c.id==='local-parser').state,'blocked');
 assert.ok(catalog.every(c=>c.sha256&&c.permission&&c.description&&c.limits));
});
test('upstream provider parsing returns original full postings through injected transport only',async()=>{
 const calls=[];
 const result=await runProvider({provider:'greenhouse',entry:{name:'Untracked Labs',careers_url:'https://job-boards.greenhouse.io/untracked'},request:async(url,options)=>{
  calls.push({url,options});return {status:200,contentType:'application/json',text:JSON.stringify({jobs:[{id:42,title:'Customer Delivery Builder',absolute_url:'https://job-boards.greenhouse.io/untracked/jobs/42',location:{name:'Arlington, VA'},content:'&lt;p&gt;Build software integrations and automate customer workflows.&lt;/p&gt;',first_published:'2026-11-21T10:00:00Z'}]})};
 }});
 assert.equal(result.jobs.length,1);assert.equal(result.jobs[0].company,'Untracked Labs');
 assert.match(result.jobs[0].description,/Build software integrations/);assert.equal(result.partial,null);
 assert.equal(calls.length,1);assert.match(calls[0].url,/content=true/);
 assert.equal(calls[0].options.method,'GET');
});
test('discovery child cannot write files, read private runtime or start subprocesses and receives no secrets',async()=>{
 process.env.MAXIM_TEST_SECRET='not-shared';
 try{
  const r=await runProvider({operation:'boundary_probe',forbiddenPath:new URL('../../scripts/environment.mjs',import.meta.url).pathname,request:async()=>{throw Error('No network expected');}});
  assert.deepEqual(r.denied,{write:true,read:true,spawn:true});assert.ok(!r.environmentKeys.includes('MAXIM_TEST_SECRET'));
 }finally{delete process.env.MAXIM_TEST_SECRET;}
});
test('restricted providers fail closed, provider drift is an error, cancellation stops execution',async()=>{
 await assert.rejects(()=>runProvider({provider:'local-parser',entry:{},request:async()=>{}}),e=>e.code==='provider_unavailable');
 await assert.rejects(()=>runProvider({provider:'lever',entry:{name:'Drift',careers_url:'https://jobs.lever.co/drift'},request:async()=>({status:200,contentType:'application/json',text:'{}'})}),e=>e.code==='provider_failed');
 const c=new AbortController();c.abort();await assert.rejects(()=>runProvider({provider:'builtin',entry:{},signal:c.signal,request:async()=>{}}),e=>e.code==='request_cancelled');
});
