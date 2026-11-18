import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {localChecks,prompts,validateFeedback,selectPracticeEvidence} from '../../src/server/interview/policy.ts';
import {parseInterviewResponse} from '../../src/server/interview/model.ts';
const fact={id:crypto.randomUUID(),revision:1,source_id:crypto.randomUUID(),source_revision:1,field_key:'projects.summary',value:'Built a synthetic queue processor.'};
const feedback={observations:[{claim:'Served 99 million users',assessment:'supported',factIds:[fact.id,crypto.randomUUID()]}],rubric:[{dimension:'grounding',feedback:'Ask for documented measurements.'}],followUpQuestions:['Which result is supported by reviewed evidence?']};
test('practice selects whole longer project evidence under a shared byte budget',()=>{
 const long={...fact,value:'Reviewed project detail. '.repeat(200)};
 const selected=selectPracticeEvidence([long,{...fact,id:crypto.randomUUID(),value:'x'.repeat(16000)},fact]);
 assert.equal(selected[0].value,long.value);assert.equal(selected.length,2);
 assert.ok(Buffer.byteLength(JSON.stringify(selected))<=14000);
 assert.equal(selectPracticeEvidence(Array.from({length:12},()=>({...fact,id:crypto.randomUUID()}))).length,8);
});
test('all practice modes ask for evidence and distinguish hypothetical design',()=>{
 assert.deepEqual(Object.keys(prompts).sort(),['behavioral','project_defense','system_design']);
 assert.match(prompts.project_defense.join(' '),/metric is missing/);
 assert.match(prompts.behavioral.join(' '),/instead of inventing/);
 assert.match(prompts.system_design[0],/Hypothetical/);
});
test('unsupported numbers are flagged locally, never certified as experience',()=>{
 const checks=localChecks('We served 99 million users and improved latency 70%.',[fact],true).join('\n');
 assert.match(checks,/Hypothetical/);assert.match(checks,/Unsupported numeric claim.*99 million/);assert.match(checks,/70%/);
 assert.match(localChecks('Missing outcome',[],false).join('\n'),/No approved disclosable evidence/);
 assert.match(localChecks('Improved latency 70%.',[{...fact,value:'Measured a 170% increase.'}],false).join('\n'),/Unsupported numeric claim.*70%/);
});
test('model citations cannot invent evidence or make non-extractive claims supported',()=>{
 const result=validateFeedback(structuredClone(feedback),[fact],false);
 assert.equal(result.observations[0].assessment,'needs_evidence');assert.deepEqual(result.observations[0].factIds,[fact.id]);
 assert.equal(validateFeedback(structuredClone(feedback),[fact],true).observations[0].assessment,'hypothetical');
 const exact=structuredClone(feedback);exact.observations[0].claim=fact.value;
 assert.equal(validateFeedback(exact,[fact],false).observations[0].assessment,'supported');
});
test('malformed, incomplete, tool-requesting and oversize feedback is not a completed result',()=>{
 const response={choices:[{finish_reason:'stop',message:{content:JSON.stringify(feedback)}}],usage:{prompt_tokens:25,completion_tokens:12}};
 const snapshot={facts:[fact]};
 assert.equal(parseInterviewResponse(response,snapshot,false).usage.prompt_tokens,25);
 assert.throws(()=>parseInterviewResponse({...response,choices:[{...response.choices[0],finish_reason:'length'}]},snapshot,false),e=>e.code==='model_interrupted');
 assert.throws(()=>parseInterviewResponse({choices:[{finish_reason:'stop',message:{content:'{}',tool_calls:[]}}]},snapshot,false),e=>e.code==='model_interrupted');
 assert.throws(()=>parseInterviewResponse({choices:[{finish_reason:'stop',message:{content:'{}'}}]},snapshot,false),e=>e.code==='model_invalid_response');
 assert.throws(()=>validateFeedback({...feedback,approved:true},[fact],false));
});
