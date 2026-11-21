import http from 'node:http';
import https from 'node:https';
import {lookup as dnsLookup} from 'node:dns/promises';
import {isIP} from 'node:net';
import {createGunzip,createInflate} from 'node:zlib';
import type {Readable} from 'node:stream';
import ipaddr from 'ipaddr.js';
import {DomainError,invariant} from './errors';

export class DiscoveryError extends DomainError{
 constructor(code:string,message:string,public httpStatus?:number,public retryAfterSeconds?:number){super(code,message,502);}
}
export const networkLimits={bytes:5*1024*1024,deadlineMs:30000,maxHeaders:16384};
type Address={address:string;family:number};
type Options={allowedHosts:string[];fixtureOrigin?:string;deadlineMs?:number;byteLimit?:number;signal?:AbortSignal;resolve?:(host:string)=>Promise<Address[]>;content?:'public';method?:'GET'|'POST';body?:string;headers?:Record<string,string>};
export function publicAddress(value:string){
 try{return ipaddr.process(value).range()==='unicast';}catch{return false;}
}
function normalizedAddress(value:string){return ipaddr.process(value).toNormalizedString();}
export function validateConnectedPeer(expected:string,peer:string){
 invariant(peer&&normalizedAddress(peer)===normalizedAddress(expected),'dns_changed','Connected peer differs from the validated DNS address.');
}
export function validateFeedUrl(input:string,allowedHosts:string[],fixtureOrigin?:string){
 let url:URL;try{url=new URL(input);}catch{throw new DiscoveryError('url_refused','The feed URL is invalid.');}
 const fixture=Boolean(fixtureOrigin&&url.origin===fixtureOrigin&&url.hostname==='127.0.0.1'&&url.protocol==='http:');
 invariant(!url.username&&!url.password&&!url.hash,'url_refused','Feed credentials/fragments are refused.');
 invariant(fixture||url.protocol==='https:'&&(!url.port||url.port==='443')&&allowedHosts.includes(url.hostname),'url_refused','Only the selected public provider endpoint is allowed.');
 return {url,fixture};
}
export async function secureGet(input:string,options:Options):Promise<{text:string;status:number;bytes:number;peer:string;receivedAt:string;contentType:string}>{
 const {url,fixture}=validateFeedUrl(input,options.allowedHosts,options.fixtureOrigin);
 const deadline=Math.min(networkLimits.deadlineMs,options.deadlineMs||networkLimits.deadlineMs),cap=Math.min(networkLimits.bytes,options.byteLimit||networkLimits.bytes);
 invariant(deadline>=50&&cap>=32,'invalid_network_limits','Network bounds are invalid.');
 const stop=new AbortController(),signal=AbortSignal.any([stop.signal,...(options.signal?[options.signal]:[])]);
 const timer=setTimeout(()=>stop.abort(),deadline);
 const checkSignal=()=>{if(signal.aborted)throw new DiscoveryError('request_cancelled','Feed request was cancelled or exceeded its absolute deadline.');};
 let addresses:Address[];
 try{
  checkSignal();
  const resolution=fixture?Promise.resolve([{address:'127.0.0.1',family:4}]):(options.resolve?options.resolve(url.hostname):dnsLookup(url.hostname,{all:true,verbatim:true}));
  addresses=await Promise.race([resolution,new Promise<never>((_,reject)=>signal.addEventListener('abort',()=>reject(new DiscoveryError('request_cancelled','Feed DNS resolution exceeded its deadline.')),{once:true}))]);
  checkSignal();
  invariant(addresses.length>0&&addresses.length<=20&&(fixture||addresses.every(a=>isIP(a.address)&&publicAddress(a.address))),'private_network_refused','DNS resolved to a private, reserved or metadata address.');
 }catch(e){clearTimeout(timer);if(e instanceof DomainError)throw e;throw new DiscoveryError('dns_failed','Public feed DNS resolution failed.');}
 const selected=addresses.find(a=>a.family===4)||addresses[0];
 try{return await new Promise((resolve,reject)=>{
  let settled=false,rawBytes=0,decodedBytes=0,connectedPeer='',bodyStream:Readable|undefined;
  const fail=(error:unknown)=>{if(!settled){settled=true;bodyStream?.destroy();request.destroy();reject(error instanceof DomainError?error:new DiscoveryError(signal.aborted?'request_cancelled':'transport_failed','Feed transport failed safely.'));}};
  const request=(url.protocol==='https:'?https:http).request(url,{method:options.method||'GET',agent:false,maxHeaderSize:networkLimits.maxHeaders,family:selected.family,
   headers:{Accept:options.content==='public'?'application/json, text/html, application/xml, text/plain':'application/json',...options.headers,'Accept-Encoding':'identity','User-Agent':'MaximApply-public-feed/1.0'},
   ...(url.protocol==='https:'?{servername:url.hostname,rejectUnauthorized:true}:{}),signal,
   lookup:(_host,_opts,callback)=>callback(null,selected.address,selected.family),
  },response=>{
   const status=response.statusCode||0;
   if(status>=300&&status<400){response.destroy();fail(new DiscoveryError('redirect_refused','Provider redirect requires manual source review.',status));return;}
   if(status===429){
    const raw=response.headers['retry-after'],parsed=typeof raw==='string'?(/^\d+$/.test(raw)?Number(raw):Math.ceil((Date.parse(raw)-Date.now())/1000)):60;
    const seconds=Number.isFinite(parsed)?Math.max(60,parsed):60;
    response.destroy();fail(new DiscoveryError('quota_exceeded','Provider quota reached; retry only after the recorded cooldown.',status,Math.min(31536000,seconds)));return;
   }
   if(status===401||status===403){response.destroy();fail(new DiscoveryError('auth_or_challenge','Provider access requires manual review. No challenge workaround is attempted.',status));return;}
   if(status<200||status>=300){response.destroy();fail(new DiscoveryError(status===404?'source_not_found':'http_failure','Public feed returned HTTP '+status+'.',status));return;}
   const type=String(response.headers['content-type']||'').toLowerCase();
   if(!(options.content==='public'?/(?:application\/(?:json|xml|rss\+xml|atom\+xml|[^;]+\+json)|text\/(?:html|plain|xml))/:/(?:application\/json|application\/[^;]+\+json)/).test(type)){response.destroy();fail(new DiscoveryError('unexpected_content','Unexpected public-source content type; review the source manually.',status));return;}
   const length=Number(response.headers['content-length']);
   if(Number.isFinite(length)&&length>cap){response.destroy();fail(new DiscoveryError('response_too_large','Feed response exceeds the byte limit.'));return;}
   const encoding=String(response.headers['content-encoding']||'identity').toLowerCase();
   if(!['identity','gzip','deflate'].includes(encoding)){response.destroy();fail(new DiscoveryError('unsupported_encoding','Feed compression is unsupported.'));return;}
   const decoded=encoding==='gzip'?response.pipe(createGunzip()):encoding==='deflate'?response.pipe(createInflate()):response;
   bodyStream=decoded;
   const chunks:Buffer[]=[];
   response.on('data',(chunk:Buffer)=>{rawBytes+=chunk.length;if(rawBytes>cap)fail(new DiscoveryError('response_too_large','Compressed feed exceeds its byte limit.'));});
   response.on('error',fail);decoded.on('error',fail);
   decoded.on('data',(chunk:Buffer)=>{decodedBytes+=chunk.length;if(decodedBytes>cap)fail(new DiscoveryError('response_too_large','Expanded feed exceeds its byte limit.'));else chunks.push(chunk);});
   decoded.on('end',()=>{
    if(settled)return;
    try{
     checkSignal();
     validateConnectedPeer(selected.address,connectedPeer);
     const text=new TextDecoder('utf-8',{fatal:true}).decode(Buffer.concat(chunks));
     if(options.content==='public'&&/(?:cf-chl-|cf_chl_opt|captcha-delivery\.com|<title>\s*(?:Just a moment|Access Denied)|verify you are human)/i.test(text))throw new DiscoveryError('auth_or_challenge','Public source returned an access challenge. No workaround is attempted.',status);
     settled=true;resolve({text,status,bytes:decodedBytes,peer:normalizedAddress(connectedPeer),receivedAt:new Date().toISOString(),contentType:type});
    }catch(e){fail(e);}
   });
  });
  request.on('socket',socket=>socket.once('connect',()=>{
   try{connectedPeer=socket.remoteAddress||'';validateConnectedPeer(selected.address,connectedPeer);}catch(e){fail(e);}
  }));
  request.on('error',fail);request.end(options.body);
 });}finally{clearTimeout(timer);}
}

