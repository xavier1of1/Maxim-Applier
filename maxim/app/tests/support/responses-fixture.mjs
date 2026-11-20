// Translate deterministic legacy fixture output, not production requests or provider behavior.
export function responsesFixture(req,res,wire){
 if(req.url!=='/v1/responses')return wire;
 const body={...wire,messages:wire.input.map(item=>item.type==='function_call_output'?{role:'tool',tool_call_id:item.call_id,content:item.output}:item.type==='function_call'?{role:'assistant',content:null,tool_calls:[{id:item.call_id,type:'function',function:{name:item.name,arguments:item.arguments}}]}:item).filter(item=>item.type!=='reasoning'),response_format:wire.text?.format,max_completion_tokens:wire.max_output_tokens};
 const write=res.write.bind(res),end=res.end.bind(res),head=res.writeHead.bind(res);let buffer='',status=200;
 res.writeHead=(s,...args)=>{status=s;return head(s,...args);};
 res.write=chunk=>{buffer+=String(chunk);return true;};
 res.end=chunk=>{
  buffer+=chunk?String(chunk):'';
  if(status>=400||!buffer.trim())return end(buffer);
  try{
   let text='',usage={},calls=[],done=true;
   if(wire.stream){
    const parts=buffer.split('\n').filter(l=>l.startsWith('data: ')&&!l.includes('[DONE]')).map(l=>JSON.parse(l.slice(6)));
    done=buffer.includes('[DONE]');
    for(const p of parts){text+=p.choices?.[0]?.delta?.content||'';calls.push(...(p.choices?.[0]?.delta?.tool_calls||[]));if(p.usage)usage=p.usage;}
   }else{const p=JSON.parse(buffer);text=p.choices[0].message.content;usage=p.usage||{};done=p.choices[0].finish_reason==='stop';}
   const output=[{type:'reasoning',id:'reasoning-fixture',encrypted_content:'opaque-fixture'},
    ...(text?[{type:'message',role:'assistant',status:'completed',content:[{type:'output_text',text}]}]:[]),
    ...calls.map(c=>({type:'function_call',call_id:c.id,name:c.function.name,arguments:c.function.arguments}))];
   const response={status:done?'completed':'incomplete',output,usage:{input_tokens:usage.prompt_tokens,output_tokens:usage.completion_tokens}};
   if(!wire.stream)return end(JSON.stringify(response));
   if(text)write('data: '+JSON.stringify({type:'response.output_text.delta',delta:text})+'\n\n');
   if(done)write('data: '+JSON.stringify({type:'response.completed',response})+'\n\n');
   return end();
  }catch{return end(buffer);}
 };
 return body;
}
