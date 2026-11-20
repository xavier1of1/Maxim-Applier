import test from 'node:test';
import assert from 'node:assert/strict';
import {companySpread,locationGroup,locationMatches,rolePolicyLabel,runResultIds} from '../../src/components/maxim/role-triage.ts';
import {matchesRoleTerms} from '../../src/server/discovery-providers.ts';

const role=(company,severity,extra={})=>({company,opening_key:'opening',discovery_policy:{eligibility:severity==='blocker'?'blocked':'review',flags:[{flagType:'location',severity}]},...extra});
test('default shortlist excludes untracked outside and unknown openings without hiding intentional records',()=>{
 const outside=role('A','blocker'),local=role('A','positive'),unknown=role('B','review');
 assert.equal(locationGroup(outside),'outside');assert.equal(locationGroup(local),'local');assert.equal(locationGroup(unknown),'review');
 assert.deepEqual([outside,local,unknown].filter(j=>locationMatches(j,'focus')),[local]);
 assert.equal(locationMatches({...outside,application_id:'app'},'focus'),true);
 assert.equal(locationMatches({...unknown,discovery_state:'saved'},'focus'),true);
 assert.equal(locationMatches({company:'Manual'},'focus'),true);
 assert.equal(locationMatches(outside,'all'),true);
 assert.equal(rolePolicyLabel(outside).label,'Policy blocked');
 assert.equal(rolePolicyLabel(local).label,'Needs review');
});
test('company spread retains all records and per-company ordering, and runs never borrow old results',()=>{
 const rows=[{company:'A',id:1},{company:'a',id:2},{company:'A',id:3},{company:'B',id:4},{company:'C',id:5},{company:'B',id:6}];
 assert.deepEqual(companySpread(rows).map(j=>j.id),[1,4,5,2,6,3]);
 assert.deepEqual([...runResultIds([{job_id:'A',run_id:'old'},{job_id:'B',run_id:'new'},{job_id:'B',run_id:'new'}],'new')],['B']);
 assert.equal(runResultIds([],'unknown').size,0);
});
test('title search does not match unrelated description boilerplate and handles title punctuation',()=>{
 const job={title:'Full-Stack Software Engineer',description:'We are hiring a product manager and everyone collaborates.'};
 assert.equal(matchesRoleTerms(job,['full stack'],'title'),true);
 assert.equal(matchesRoleTerms(job,['product manager'],'title'),false);
 assert.equal(matchesRoleTerms(job,['product manager'],'title_and_description'),true);
});
