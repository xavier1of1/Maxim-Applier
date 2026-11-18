import test from 'node:test';
import assert from 'node:assert/strict';
import {domain} from '../../src/server/domain.ts';

test('long public postings stay within the real Rust adapter deadline without losing final clearance requirements',()=>{
 const job={title:'Software Engineer',locations:['Arlington, VA'],salary:{flat:100000}};
 const padding='A short sentence. '.repeat(2400);
 const required=domain({operation:'job_policy',job:{...job,description:padding+'Active TS/SCI clearance required.'}});
 assert.equal(required.allowed,false);
 assert.ok(required.flags.some(f=>f.flagType==='clearance'&&f.severity==='blocker'));
 const eligible=domain({operation:'job_policy',job:{...job,description:padding+'Eligible to obtain a security clearance. No active clearance required.'}});
 assert.equal(eligible.allowed,true);
 assert.ok(eligible.flags.some(f=>f.flagType==='clearance'&&f.severity==='review'));
});

test('long-posting optimization preserves the existing policy input limit',()=>{
 assert.throws(()=>domain({operation:'job_policy',job:{description:'x'.repeat(100001)}}),e=>e.code==='policy_text_limit');
});
