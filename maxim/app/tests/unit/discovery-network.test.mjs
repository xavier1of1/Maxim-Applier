import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import {gzipSync} from 'node:zlib';
import {secureGet,validateFeedUrl,publicAddress,validateConnectedPeer} from '../../src/server/discovery-network.ts';

test('feed URL/IP policy denies private, metadata, reserved, credential and non-provider destinations',async()=>{
 const hosts=['boards-api.greenhouse.io'];
 for(const url of ['http://boards-api.greenhouse.io/jobs','https://user:secret@boards-api.greenhouse.io/jobs','https://127.0.0.1/jobs','https://boards-api.greenhouse.io.evil.example/jobs','http://[::ffff:169.254.169.254]/']){
  assert.throws(()=>validateFeedUrl(url,hosts),e=>e.code==='url_refused');
 }
 for(const ip of ['127.0.0.1','10.0.0.1','192.168.0.4','169.254.169.254','100.64.0.1','0.0.0.0','::1','fe80::1','fc00::1','::ffff:10.0.0.1','2001:db8::1'])assert.equal(publicAddress(ip),false,ip);
 assert.equal(publicAddress('8.8.8.8'),true);
 for(const addresses of [[{address:'10.0.0.4',family:4}],[{address:'8.8.8.8',family:4},{address:'169.254.169.254',family:4}]]){
  await assert.rejects(()=>secureGet('https://boards-api.greenhouse.io/jobs',{allowedHosts:hosts,resolve:async()=>addresses}),e=>e.code==='private_network_refused');
 }
 assert.throws(()=>validateConnectedPeer('8.8.8.8','127.0.0.1'),e=>e.code==='dns_changed');
 assert.doesNotThrow(()=>validateConnectedPeer('127.0.0.1','::ffff:127.0.0.1'));
});
test('actual bounded transport distinguishes redirects, quota, challenges, content drift, compression and absolute deadlines',async t=>{
 const hits=[],timers=new Set();
 const server=http.createServer((req,res)=>{
  hits.push(req.url);
  if(req.url==='/redirect'){res.writeHead(302,{Location:'http://169.254.169.254/latest/meta-data'});res.end();return;}
  if(req.url==='/quota'){res.writeHead(429,{'Retry-After':'120'});res.end();return;}
  if(req.url==='/challenge'){res.writeHead(403);res.end('<html>Challenge</html>');return;}
  if(req.url==='/html'){res.writeHead(200,{'Content-Type':'text/html'});res.end('<html>Not feed JSON</html>');return;}
  if(req.url==='/zip'){const bytes=gzipSync(JSON.stringify({text:'x'.repeat(20000)}));res.writeHead(200,{'Content-Type':'application/json','Content-Encoding':'gzip','Content-Length':bytes.length});res.end(bytes);return;}
  if(req.url==='/oversize'){const bytes=JSON.stringify({text:'x'.repeat(10000)});res.writeHead(200,{'Content-Type':'application/json','Content-Length':Buffer.byteLength(bytes)});res.end(bytes);return;}
  res.writeHead(200,{'Content-Type':'application/json'});
  if(req.url==='/slow'){
   res.write('{"pending":');
   const timer=setTimeout(()=>{timers.delete(timer);if(!res.destroyed)res.end('true}');},1000);
   timers.add(timer);res.once('close',()=>{clearTimeout(timer);timers.delete(timer);});return;
  }
  res.end(JSON.stringify({jobs:[],method:req.method,authorization:req.headers.authorization||null}));
 });
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 t.after(async()=>{for(const timer of timers)clearTimeout(timer);server.closeAllConnections();await new Promise(resolve=>server.close(resolve));});
 const origin='http://127.0.0.1:'+server.address().port,options={allowedHosts:[],fixtureOrigin:origin,byteLimit:1024,deadlineMs:1000};
 const ok=await secureGet(origin+'/ok',options);
 assert.deepEqual(JSON.parse(ok.text),{jobs:[],method:'GET',authorization:null});assert.equal(ok.peer,'127.0.0.1');
 for(const[path,code]of[['/redirect','redirect_refused'],['/quota','quota_exceeded'],['/challenge','auth_or_challenge'],['/html','unexpected_content'],['/zip','response_too_large'],['/oversize','response_too_large'],['/slow','request_cancelled']]){
  await assert.rejects(()=>secureGet(origin+path,{...options,...(path==='/slow'?{deadlineMs:60}:{})}),e=>e.code===code&&(code!=='quota_exceeded'||e.retryAfterSeconds===120));
 }
 assert.equal(hits.length,8,'one bounded request per case; redirects/retries never followed');
 assert.ok(!hits.some(path=>path.includes('meta-data')));
});

