import test from 'node:test';
import assert from 'node:assert/strict';
import {prepareOpenAI,normalizeResponse,completedOpenAI,streamedResponses,boundedJson} from '../../src/server/openai.ts';
import {validateModelId} from '../../src/server/model-id.ts';

const body={model:'a-new-text-model',messages:[{role:'system',content:'Mandatory instructions.'},{role:'user',content:'Exact evidence.'}],max_completion_tokens:1024,store:false,stream:false};
const connection={model:body.model,baseUrl:'http://127.0.0.1:1/v1',apiKey:'synthetic-only',api:'responses'};
const completed=(text='Synthetic response')=>({status:'completed',output:[{type:'message',role:'assistant',content:[{type:'output_text',text}]}],usage:{input_tokens:12,output_tokens:8}});
test('model IDs are not a family whitelist, but display names and controls are rejected',()=>{
 for(const id of ['gpt-6.1-terra','future-text-model','ft:gpt-custom:org/name'])assert.equal(validateModelId(id),id);
 for(const id of ['', 'GPT-6.1 Terra',' x','x\n','a'.repeat(121)])assert.throws(()=>validateModelId(id),e=>e.code==='invalid_model_id');
});
test('Responses translates actual request, tools, JSON and output reserve without Chat-only fields',()=>{
 const p=prepareOpenAI({...body,response_format:{type:'json_object'},stream_options:{include_usage:true},tools:[{type:'function',function:{name:'read',strict:true,parameters:{type:'object',properties:{}}}}]},'responses');
 const r=JSON.parse(p.serialized);
 assert.equal(r.model,body.model);assert.equal(r.store,false);assert.equal(r.max_output_tokens,1024);
 assert.equal(r.text.format.type,'json_object');assert.equal(r.tools[0].name,'read');assert.equal(r.tools[0].strict,true);
 for(const key of ['messages','max_completion_tokens','response_format','stream_options'])assert.equal(key in r,false);
 assert.equal(p.accounting.requestBytes,Buffer.byteLength(p.serialized));assert.equal(p.accounting.profile,'estimated_openai_text');
 assert.throws(()=>prepareOpenAI({...body,messages:[{role:'system',content:'x'.repeat(33000)}]},'responses'),e=>e.code==='context_budget_exceeded');
 assert.throws(()=>prepareOpenAI(body,'responses',{totalBudget:100}),e=>e.code==='context_budget_exceeded');
});
test('legacy request is unchanged; reasoning and exact function call identity replay only in current input',()=>{
 assert.deepEqual(JSON.parse(prepareOpenAI(body).serialized),body);
 const items=[{type:'reasoning',id:'r1',encrypted_content:'opaque-fixture'},{type:'function_call',call_id:'call1',name:'read',arguments:'{}'}];
 const normalized=normalizeResponse({status:'completed',output:items});
 assert.equal(normalized.choices[0].message.tool_calls[0].id,'call1');
 const next=JSON.parse(prepareOpenAI({...body,messages:[...body.messages,{role:'assistant',responseItems:items},{role:'tool',tool_call_id:'call1',content:'Exact result'}]},'responses').serialized);
 assert.deepEqual(next.input.slice(2,4),items);
 assert.deepEqual(next.input[4],{type:'function_call_output',call_id:'call1',output:'Exact result'});
 assert.equal(normalizeResponse(completed()).usage.prompt_tokens,12);
});
test('incomplete, empty, refused and malformed calls are never accepted',()=>{
 for(const value of [{status:'incomplete',output:completed().output},{status:'failed'}, {status:'completed',output:[]},
  {status:'completed',output:[{type:'message',content:[{type:'refusal',refusal:'no'}]}]},
  {status:'completed',output:[{type:'function_call',name:'x',arguments:'{}'}]}])assert.throws(()=>normalizeResponse(value));
});
test('bounded JSON refuses oversized and invalid bodies',async()=>{
 await assert.rejects(()=>boundedJson(new Response('x'.repeat(51)),50),e=>e.code==='model_output_limit');
 await assert.rejects(()=>boundedJson(new Response('invalid')),e=>e.code==='model_invalid_response');
});
test('Responses transport, streamed text/tool calls, safe errors and cancellation use no live account',async t=>{
 const original=globalThis.fetch;t.after(()=>{globalThis.fetch=original;});let requests=0;
 const p=prepareOpenAI(body,'responses');
 globalThis.fetch=async(url,init)=>{requests++;assert.equal(url,connection.baseUrl+'/responses');assert.equal(init.redirect,'error');assert.equal(JSON.parse(init.body).store,false);return Response.json(completed());};
 assert.equal((await completedOpenAI(connection,p,new AbortController().signal)).choices[0].message.content,'Synthetic response');
 const events=[{type:'response.created'}, {type:'response.output_text.delta',delta:'Synthetic response'}, {type:'response.completed',response:completed()}];
 const stream=ev=>new Response(ev.map(e=>'data: '+JSON.stringify(e)+'\r\n\r\n').join(''),{headers:{'Content-Type':'text/event-stream'}});
 globalThis.fetch=async()=>stream(events);let text='';
 const result=await streamedResponses(connection,{...p,serialized:p.serialized},new AbortController().signal,async delta=>{text+=delta;});
 assert.equal(text,'Synthetic response');assert.equal(result.usage.completion_tokens,8);
 globalThis.fetch=async()=>stream([{type:'response.completed',response:{status:'completed',output:[{type:'reasoning',encrypted_content:'opaque'},{type:'function_call',call_id:'call2',name:'read',arguments:'{}'}]}}]);
 assert.equal((await streamedResponses(connection,p,new AbortController().signal,async()=>{})).choices[0].message.tool_calls[0].id,'call2');
 for(const ev of [[],[{type:'response.incomplete'}],[{type:'error',message:'secret fixture upstream'}]]){
  globalThis.fetch=async()=>stream(ev);await assert.rejects(()=>streamedResponses(connection,p,new AbortController().signal,async()=>{}),e=>e.code==='model_interrupted'&&!e.message.includes('secret fixture'));
 }
 for(const status of [400,401,403,404,429,500]){
  let calls=0;globalThis.fetch=async()=>{calls++;return Response.json({error:{message:'secret fixture upstream'}},{status});};
  await assert.rejects(()=>completedOpenAI(connection,p,new AbortController().signal),e=>e.code==='model_rejected'&&!e.message.includes('secret fixture'));
  assert.equal(calls,1,'no automatic retries');
 }
 globalThis.fetch=async()=>Response.json({error:{code:'context_length_exceeded'}},{status:400});
 await assert.rejects(()=>completedOpenAI(connection,p,new AbortController().signal),e=>e.code==='context_budget_exceeded');
 const abort=new AbortController();abort.abort();globalThis.fetch=async(_u,o)=>{o.signal.throwIfAborted();};
 await assert.rejects(()=>completedOpenAI(connection,p,abort.signal),e=>e.code==='cancelled');assert.equal(requests,1);
});
