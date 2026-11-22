import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {compileSearchProfile,searchProfileSchema} from '../../src/server/search-profile.ts';
import {screenDiscovery} from '../../src/server/discovery-screen.ts';
import {canonicalOpeningUrl,publicDiscoveryRead,upstreamDefinition,upstreamEntry,upstreamNormalize} from '../../src/server/upstream-discovery.ts';
import {postingIdentity} from '../../src/server/discovery-providers.ts';
import {toolsForRequest} from '../../src/server/models.ts';
import {render} from '../../src/server/projections.ts';
test('profile compilation is deterministic, bounded and never asserts candidate credentials',()=>{
 const p=searchProfileSchema.parse({families:['automation','systems_integration']});
 const a=compileSearchProfile(p);assert.deepEqual(a,compileSearchProfile(p));
 assert.equal(a.kind,'retrieval_rules_not_fit_score');assert.equal(a.responsibilityGroups.length,2);assert.match(a.geography,/remote compatibility requires review/);
 assert.ok(!JSON.stringify(a).includes('active_clearance'));assert.throws(()=>searchProfileSchema.parse({families:['imaginary']}));
 assert.equal(a.includeUnverifiedLocations,false);
});
test('public board age filters round outwards to supported windows without silently narrowing the owner policy',()=>{
 const source={provider:'a16z-speedrun-talent',name:'Public board',careers_url:'https://speedrun-talent-network.com'};
 for(const [days,posted] of [[1,'24h'],[3,'7d'],[7,'7d'],[14,'30d'],[30,'30d'],[60,undefined]]){
  const filters=upstreamEntry(source,[],{},days).maximPublicFilters;
  assert.equal(filters.metro,'dc');assert.equal(filters.posted,posted);
 }
 assert.equal(upstreamEntry(source,[]).maximPublicFilters,undefined);
});

test('only the pinned join publicJobs read query and bounded pagination are permitted as POST',()=>{
 const source=fs.readFileSync(new URL('../../../vendor/career-ops-discovery/providers/join.mjs',import.meta.url),'utf8');
 const query=source.match(/const PUBLIC_JOBS_QUERY = \x60([\s\S]+?)\x60;/)[1],url=new URL('https://join.com/candidate-api/graphql');
 const payload={operationName:'PublicJobsList',query,variables:{input:{companyId:123,paginationPage:{page:1,pageSize:100},filters:{}}}};
 const allowed=(p=payload,u=url,provider='reverse:join')=>publicDiscoveryRead(provider,u,'POST',JSON.stringify(p));
 assert.equal(allowed(),true);assert.equal(allowed({...payload,query:'mutation { submitApplication }'}),false);
 assert.equal(allowed({...payload,query:query+' query Extra { privateInfo }'}),false);
 assert.equal(allowed({...payload,variables:{input:{...payload.variables.input,paginationPage:{page:3,pageSize:100}}}}),false);
 assert.equal(allowed(payload,new URL('https://join.com/candidate-api/submit')),false);assert.equal(allowed(payload,url,'builtin'),false);
 assert.equal(publicDiscoveryRead('join',url,'POST','not json'),false);
 assert.equal(publicDiscoveryRead('join',url,'GET','{}'),false);
});

test('public provider configurations cannot carry credentials or executable hooks into the child',()=>{
 for(const configuration of [{apiKey:'private'},{api_key:'private'},{headers:{Authorization:'private'}},{nested:{refresh_token:'private'}},{parser:{command:'cmd.exe'}}]){
  assert.throws(()=>upstreamDefinition('remotive','',undefined,configuration),e=>e.code==='source_configuration_refused');
 }
 assert.equal(upstreamDefinition('join','','https://join.com/companies/fixture',{company_id:123}).native_definition.company_id,123);
});

test('generic URL identity retains requisition query parameters while ignoring tracking',()=>{
 const a=canonicalOpeningUrl('https://news.ycombinator.com/item?id=123&utm_source=demo');assert.equal(a,'https://news.ycombinator.com/item?id=123');
 assert.notEqual(a,canonicalOpeningUrl('https://news.ycombinator.com/item?id=124'));
 assert.equal(postingIdentity('https://jobs.ashbyhq.com/example/id-1/application','fallback'),'jobs.ashbyhq.com:example:id-1');
 assert.notEqual(postingIdentity('https://jobs.ashbyhq.com/example/id-1/application','fallback'),postingIdentity('https://jobs.ashbyhq.com/example/id-2/application','fallback'));
});
test('new discovery tools do not consume unrelated conversation context on every turn',()=>{
 assert.ok(!toolsForRequest('Save this role').some(t=>t.function.name==='start_market_search'));
 assert.ok(toolsForRequest('Find broad market jobs').some(t=>t.function.name==='start_market_search'));
 assert.ok(!toolsForRequest('Find broad market jobs').some(t=>t.function.name==='start_interview_practice'));
 assert.ok(toolsForRequest('Find my recent email').some(t=>t.function.name==='read_gmail_evidence'));
});
test('upstream listing metadata cannot create a second identity for a known native ATS URL',()=>{
 const row=upstreamNormalize({id:'source',name:'directory',provider:'reverse:ashby',board:'',careers_url:'https://example.org',revision:1,enabled:true},{title:'Software Engineer',company:'Employer',url:'https://jobs.ashbyhq.com/employer/id-1',listingIdentity:{ats_provider:'ashby',board_slug:'employer',posting_id:'id-1'}});
 assert.equal(row.openingKey,postingIdentity(row.url,'fallback'));
});
test('remote or foreign location is not automatically verified as NoVA/DC',()=>{
 const p=compileSearchProfile(searchProfileSchema.parse({families:['product_engineering']}));
 const r=screenDiscovery([{title:'Software Engineer',url:'https://example.org/jobs/1',location:'Reston, VA'},{title:'Software Engineer',url:'https://example.org/jobs/2',location:'UK, London, Remote'}],p,()=>true);
 assert.equal(r[0].locationCompatible,true);assert.equal(r[1].locationCompatible,false);
});
test('approved role and level disclosure reaches native archetypes without disclosing local-only preferences',()=>{
 const fact=(field_key,value,model_consent)=>({field_key,value,model_consent,sensitivity:'standard',classification:'personal'});
 const output=render(63,[fact('preferences.roles',['Software Engineer','Implementation Engineer'],true),fact('preferences.seniority',['Entry level','Junior','Associate','Mid-level'],true),fact('preferences.locations',['PRIVATE_LOCATION'],false),fact('candidate.email','PRIVATE_CONTACT',false)]);
 const profile=JSON.parse(output['config/profile.yml']);assert.equal(profile.target_roles.archetypes[0].name,'Software Engineer');assert.equal(profile.target_roles.archetypes[0].level,'Entry level / Junior / Associate / Mid-level');
 assert.ok(!JSON.stringify(output).includes('PRIVATE_LOCATION'));assert.ok(!JSON.stringify(output).includes('PRIVATE_CONTACT'));
 const local=render(63,[fact('preferences.roles',['PRIVATE_ROLE'],false),fact('preferences.seniority',['PRIVATE_LEVEL'],false)]);assert.ok(!JSON.stringify(local).includes('PRIVATE_ROLE'));assert.equal(JSON.parse(local['config/profile.yml']).target_roles,undefined);
});

test('local experience-level targeting excludes senior roles without inventing years or rejecting unknown titles',()=>{
 const p=compileSearchProfile(searchProfileSchema.parse({families:['product_engineering'],seniorityLevels:['entry','junior','associate','mid']}));
 const rows=['Senior Front End Software Engineer, React','Junior Software Engineer','Software Engineer II','Staff Software Engineer','Software Engineer','Sr. Software Engineer'].map((title,i)=>({title,url:'https://example.org/jobs/'+i,location:'Reston, VA'}));
 const r=screenDiscovery(rows,p,()=>true);assert.equal(r[0].keep,false);assert.equal(r[0].reason,'seniority_mismatch');assert.equal(r[1].keep,true);assert.equal(r[2].keep,true);assert.equal(r[3].keep,false);assert.equal(r[4].keep,true);assert.equal(r[4].seniority,null);assert.equal(r[5].keep,false);
 const entry=upstreamEntry({provider:'builtin',name:'Built In',careers_url:'https://builtin.com/jobs'},[],p);
 assert.equal(entry.builtin.scope,'washington-dc');assert.deepEqual(entry.builtin.queries,['junior software engineer','software engineer ii']);assert.deepEqual(entry.builtin.categories,['dev-engineering'],'broad category preserves unconventional-title exploration');
});

test('Rust keeps unfamiliar titles on actual work and exposes incomplete exploration',()=>{
 const p=compileSearchProfile(searchProfileSchema.parse({families:['automation','systems_integration']}));
 const r=screenDiscovery([{title:'Customer Delivery Builder',url:'https://example.org/jobs/1',description:'Use REST APIs and automate workflows.'},{title:'Research Liaison',url:'https://example.org/jobs/2'},{title:'Director',url:'https://example.org/jobs/3',description:'Use REST APIs and automate workflows.'}],p,row=>Boolean(row.description));
 assert.equal(r[0].reason,'responsibility_rescue');assert.equal(r[0].keep,true);assert.equal(r[1].explore,true);assert.equal(r[2].keep,false);
});
