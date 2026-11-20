import test from 'node:test';
import assert from 'node:assert/strict';
import {scopedIntent} from '../../src/server/scoped-intent.ts';
const id='b37c68dc-b89c-4cbe-8c68-bbafe6ae18c9';
const allows=(text,context,action,quote=text)=>scopedIntent(text,quote,id,context,action);
test('natural role evaluation uses only the exact selected role and current instruction',()=>{
 assert.equal(allows('Could you evaluate this role with Career-Ops?',true,'evaluate'),true);
 assert.equal(allows('Evaluate this role',false,'evaluate'),false);
 assert.equal(allows('Evaluate '+id,false,'evaluate'),true);
 assert.equal(allows('Do not evaluate this role',true,'evaluate','evaluate this role'),false);
 assert.equal(allows('Evaluate this role only after I review it',true,'evaluate'),false);
});
test('fill authorization does not carry over from another job, negation, or a final action request',()=>{
 assert.equal(allows('Please fill approved fields and the PDF.',true,'fill'),true);
 assert.equal(allows('Fill approved fields',false,'fill'),false);
 assert.equal(allows('Fill approved fields in '+id,false,'fill'),true);
 assert.equal(allows('Do not fill approved fields',true,'fill','fill approved fields'),false);
 assert.equal(allows('Fill approved fields and submit',true,'fill'),false);
});
