import test from 'node:test';
import assert from 'node:assert/strict';
import {tokenizer,compileContext,modelProfile} from '../../src/server/context-budget.ts';
import {questionPolicy,questionIdentity,questionInput,normalizeQuestion} from '../../src/server/answer-policy.ts';
test('Microsoft local BPE uses pinned official ranks and handles unicode/special text ordinarily',()=>{
 const encoder=tokenizer('cl100k_base');
 assert.deepEqual(encoder.encode('hello world',[]),[15339,1917]);
 for(const value of ['Hello, world!','Rust + TypeScript','<|endoftext|>','Caf\u00e9 \u6771\u4eac r\u00e9sum\u00e9']){
  const tokens=tokenizer('o200k_base').encode(value,[]);
  assert.equal(tokenizer('o200k_base').decode(tokens),value);
 }
});
test('all instructions, schemas, history and tool results are counted with output reserve',()=>{
 const body={model:'gpt-4o-mini',messages:[{role:'system',content:'Mandatory policy.'},{role:'user',content:'Exact question.'},{role:'tool',content:'Source evidence revision 2.'}],tools:[{type:'function',function:{name:'scoped_read',parameters:{type:'object'}}}],max_completion_tokens:1024};
 const count=compileContext(body).accounting;
 assert.equal(count.outputReserve,1024);assert.equal(count.exactProviderBilling,false);
 assert.equal(count.requestBytes,Buffer.byteLength(JSON.stringify(body)));
 assert.ok(count.estimatedInputTokens>count.serializedTokens);
 assert.ok(count.localTotalBudget>=count.estimatedInputTokens+count.outputReserve);
 assert.throws(()=>compileContext(body,{totalBudget:100}),e=>e.code==='context_budget_exceeded');
 assert.throws(()=>compileContext({...body,messages:[{role:'system',content:'x'.repeat(33000)}]}),e=>e.code==='context_budget_exceeded');
 assert.throws(()=>modelProfile('invented-future-model'),e=>e.code==='unsupported_tokenizer');
 assert.throws(()=>modelProfile('fixture-model'),e=>e.code==='unsupported_tokenizer');
 assert.equal(modelProfile('fixture-model',true).profile,'synthetic_fixture');
});
test('Rust question policy is exact, conservative and never infers missing booleans',()=>{
 assert.equal(questionPolicy('What is your full name?').factKey,'candidate.name');
 assert.equal(questionPolicy('Are you authorized to work in the US?').factKey,null);
 assert.equal(questionPolicy('Do you require sponsorship?').sensitivity,'private');
 for(const q of ['Expected salary?','When can you start?','Have you ever worked here?','I certify this is true','Veteran status?'])assert.equal(questionPolicy(q).manualReview,true);
 assert.throws(()=>questionIdentity(questionInput.parse({text:'What is your password?',company:'Example'})),e=>e.code==='credential_forbidden');
});
test('reuse compatibility preserves internal punctuation, exact options and company context',()=>{
 assert.notEqual(normalizeQuestion('Experience with C++?'),normalizeQuestion('Experience with C#?'));
 const base={text:'Describe your project?',company:'Example',roleLane:'FDE',tags:['projects']};
 const first=questionIdentity(questionInput.parse(base)),same=questionIdentity(questionInput.parse({...base,text:'Describe your project',company:'EXAMPLE'}));
 assert.equal(first.normalized,same.normalized);assert.equal(first.company,same.company);assert.equal(first.contextHash,same.contextHash);
 assert.notEqual(first.contextHash,questionIdentity(questionInput.parse({...base,roleLane:'Backend'})).contextHash);
 assert.throws(()=>questionIdentity(questionInput.parse({...base,answerType:'choice',options:[]})),e=>e.code==='question_options');
});

