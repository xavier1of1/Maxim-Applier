import test from 'node:test';
import assert from 'node:assert/strict';
import {compileSearchProfile,searchProfileSchema} from '../../src/server/search-profile.ts';
import {screenDiscovery} from '../../src/server/discovery-screen.ts';
test('profile compilation is deterministic, bounded and never asserts candidate credentials',()=>{
 const p=searchProfileSchema.parse({families:['automation','systems_integration']});
 const a=compileSearchProfile(p);assert.deepEqual(a,compileSearchProfile(p));
 assert.equal(a.kind,'retrieval_rules_not_fit_score');assert.equal(a.responsibilityGroups.length,2);assert.match(a.geography,/remote compatibility requires review/);
 assert.ok(!JSON.stringify(a).includes('active_clearance'));assert.throws(()=>searchProfileSchema.parse({families:['imaginary']}));
});
test('Rust keeps unfamiliar titles on actual work and exposes incomplete exploration',()=>{
 const p=compileSearchProfile(searchProfileSchema.parse({families:['automation','systems_integration']}));
 const r=screenDiscovery([{title:'Customer Delivery Builder',url:'https://example.org/jobs/1',description:'Use REST APIs and automate workflows.'},{title:'Research Liaison',url:'https://example.org/jobs/2'},{title:'Director',url:'https://example.org/jobs/3',description:'Use REST APIs and automate workflows.'}],p,row=>Boolean(row.description));
 assert.equal(r[0].reason,'responsibility_rescue');assert.equal(r[0].keep,true);assert.equal(r[1].explore,true);assert.equal(r[2].keep,false);
});
