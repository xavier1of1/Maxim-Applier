import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import {spawn,execFileSync} from 'node:child_process';
import {config} from '../config';
import {DomainError,invariant} from '../errors';
import {uuid} from '../commands';
import {fieldAction,type Field,type Observation} from './policy';
import {controlsScript,guardScript,releaseScript} from './dom';

const hash=(v:unknown)=>crypto.createHash('sha256').update(JSON.stringify(v)).digest('hex');
type RawField=Omit<Field,'frame'|'origin'|'signature'|'valueHash'>&{index:number;visible:boolean;value:unknown};
const usableControl=(f:RawField)=>f.visible||f.type==='file'&&/\b(resume|cv|curriculum vitae)\b/i.test(f.label+' '+f.name);
export class BrowserExecutor {
 observation:Observation|null=null;
 private directory='';private configPath='';private locked=false;
 readonly session:string;
 constructor(readonly id:string,readonly origin:string,readonly initialUrl:string){uuid.parse(id);this.session='maxim-'+id;}
 async initialize(){
  const c=config(),root=path.join(c.privateRoot,'browser-sessions');
  await fs.mkdir(root,{recursive:true,mode:0o700});invariant(!(await fs.lstat(root)).isSymbolicLink(),'browser_profile_denied','Linked browser roots are refused.');
  this.directory=path.join(root,this.id);await fs.mkdir(this.directory,{recursive:true,mode:0o700});
  invariant(!(await fs.lstat(this.directory)).isSymbolicLink()&&await fs.realpath(this.directory)===path.join(await fs.realpath(root),this.id),'browser_profile_denied','Browser session escaped its protected root.');
  const policy=path.join(this.directory,'policy.json'),init=path.join(this.directory,'guard.js');
  this.configPath=path.join(this.directory,'config.json');
  await fs.writeFile(policy,JSON.stringify({default:'deny',allow:['navigate','open','snapshot','get','geturl','url','fill','select','check','uncheck','upload','eval','evaluate','route','unroute','close','session_info']}),{mode:0o600});
  await fs.writeFile(init,guardScript,{mode:0o600});
  await fs.writeFile(this.configPath,JSON.stringify({headed:!c.testMode||process.env.MAXIM_BROWSER_HEADED_TEST==='1',json:true,session:this.session,allowedDomains:[new URL(this.origin).hostname,'boards-api.greenhouse.io','assets.greenhouse.io','cdn.greenhouse.io','api.lever.co'],actionPolicy:policy,initScripts:[init],noWebmcp:true,maxOutput:100000,contentBoundaries:true,plugins:[],idleTimeout:'30m'}),{mode:0o600});
 }
 private async invoke(tool:string,args:Record<string,unknown>={}):Promise<Record<string,any>>{
  if(!this.configPath)await this.initialize();
  const launcher=path.resolve(/* turbopackIgnore: true */ process.cwd(),'node_modules/agent-browser/bin/agent-browser.js');
  const env=Object.fromEntries(Object.entries(process.env).filter(([k])=>!/^AGENT_BROWSER_|^AI_GATEWAY_|^BROWSER_USE_|^(?:OPENAI|ANTHROPIC|GEMINI)_API_KEY$/.test(k))) as NodeJS.ProcessEnv;
  const commands:Record<string,()=>string[]>={
   open:()=>['open',String(args.url)],get_url:()=>['get','url'],snapshot:()=>['snapshot','-i','-c'],
   eval:()=>['eval',String(args.script)],network_route:()=>['network','route',String(args.url),'--abort'],
   network_unroute:()=>['network','unroute',String(args.url)],close:()=>['close'],
   fill:()=>['fill',String(args.selector),'--',String(args.text)],select:()=>['select',String(args.selector),...(args.values as string[])],
   check:()=>['check',String(args.selector)],uncheck:()=>['uncheck',String(args.selector)],upload:()=>['upload',String(args.selector),...(args.files as string[])],
  };
  invariant(commands[tool],'browser_action_denied','This internal browser command is not supported.');
  return new Promise((resolve,reject)=>{
   const child=spawn(process.execPath,[launcher,'--session',this.session,'--config',this.configPath,'batch','--json','--omit-command','--bail'],{cwd:process.cwd(),env:{...env,AGENT_BROWSER_SOCKET_DIR:this.directory,AGENT_BROWSER_NO_VERSION_CHECK:'1',TMP:this.directory,TEMP:this.directory},windowsHide:true,stdio:['pipe','pipe','pipe']});
   let output='',settled=false;
   const fail=(code:string)=>{if(!settled){settled=true;try{if(process.platform==='win32'&&child.pid)execFileSync('taskkill',['/PID',String(child.pid),'/T','/F'],{stdio:'ignore',windowsHide:true});else child.kill();}catch{}reject(new DomainError(code,'The browser '+tool+' action was not acknowledged. Re-observe before retrying.',409));}};
   const timer=setTimeout(()=>fail('browser_action_timeout'),35000);
   child.on('error',()=>fail('browser_unavailable'));child.stdin.on('error',()=>{});
   child.stdout.on('data',chunk=>{output+=chunk;if(Buffer.byteLength(output)>400000)fail('browser_output_limit');});child.stderr.resume();
   child.on('close',code=>{clearTimeout(timer);if(settled)return;settled=true;try{const rows=JSON.parse(output),row=rows[0];
    if(code||!row?.success){reject(new DomainError('browser_action_failed','Agent-browser could not acknowledge '+tool+'. No action is blindly replayed.'+(config().testMode?' Fixture diagnostic: '+String(row?.error||'invalid result').slice(0,500):''),409));return;}
    resolve(row.result||{});
   }catch{reject(new DomainError('browser_protocol_error','Agent-browser returned an invalid response.',503));}});
   child.stdin.end(JSON.stringify([commands[tool]()]));
  });
 }
 async open(){
  await this.initialize();await this.invoke('open',{url:this.initialUrl,headed:!config().testMode,webmcp:false,timeoutMs:30000});
  await this.lockNetwork();return this.observe();
 }
 async resume(){await this.initialize();try{return await this.observe();}catch(error){if(error instanceof DomainError&&error.code==='browser_navigation_changed')throw error;return this.open();}}
 async lockNetwork(){await this.invoke('network_route',{url:'*',abort:true});this.locked=true;}
 private async controls():Promise<RawField[]>{const data=await this.invoke('eval',{script:controlsScript,timeoutMs:5000});const raw=typeof data.result==='string'?JSON.parse(data.result):data.result;invariant(Array.isArray(raw),'browser_protocol_error','Browser control observation is invalid.');return raw;}
 async observe():Promise<Observation>{
  const data=await this.invoke('get_url'),url=String(data.url||''),current=new URL(url),initial=new URL(this.initialUrl);
  invariant(current.origin===this.origin&&current.pathname.replace(/\/apply\/?$/,'')===initial.pathname.replace(/\/apply\/?$/,''),'browser_navigation_changed','The browser left the approved opening. Continue manually or close it.');
  const snapshot=await this.invoke('snapshot',{interactive:true,compact:true});void snapshot;
  const raw=await this.controls(),fields:Field[]=raw.filter(f=>usableControl(f)&&f.type!=='hidden').map(({value,visible,index,...f})=>{void visible;void index;return {...f,frame:0,origin:this.origin,signature:hash({tag:f.tag,type:f.type,name:f.name,label:f.label,options:f.options}),valueHash:hash(value)};});
  this.observation={id:crypto.randomUUID(),url:current.href,origin:this.origin,fields,issues:['iframe_and_custom_widgets_manual_only','network_locked_until_manual_handoff'],observedAt:new Date().toISOString()};return this.observation;
 }
 async target(field:Field,observationId:string){
  invariant(this.observation?.id===observationId&&Date.now()-Date.parse(this.observation.observedAt)<120000,'browser_observation_stale','Re-inspect before filling.',409);
  const data=await this.invoke('get_url'),current=new URL(String(data.url)),initial=new URL(this.initialUrl);invariant(current.origin===this.origin&&current.pathname.replace(/\/apply\/?$/,'')===initial.pathname.replace(/\/apply\/?$/,''),'browser_origin_changed','The browser left the approved opening.');
  const raw=(await this.controls()).filter(f=>f.id===field.id);invariant(raw.length===1,'browser_control_stale','The control was replaced. Re-inspect.',409);
  const f=raw[0];invariant(usableControl(f)&&!f.disabled&&hash({tag:f.tag,type:f.type,name:f.name,label:f.label,options:f.options})===field.signature&&hash(f.value)===field.valueHash,'browser_control_stale','The control or your value changed. Re-inspect instead of overwriting.',409);
  if(!this.locked)await this.lockNetwork();return '[data-maxim-field="'+uuid.parse(field.id)+'"]';
 }
 async fill(field:Field,observationId:string,value:unknown){
  fieldAction(field,value);const selector=await this.target(field,observationId);
  if(field.tag==='select')await this.invoke('select',{selector,values:[String(value)]});
  else if(['checkbox','radio'].includes(field.type))await this.invoke(value?'check':'uncheck',{selector});
  else await this.invoke('fill',{selector,text:String(value)});
  return {blockedEffects:0,observation:await this.observe(),transmission:'network_blocked_pending_manual_handoff'};
 }
 async attach(field:Field,observationId:string,buffer:Buffer){
  invariant(field.type==='file'&&/\b(resume|cv|curriculum vitae)\b/i.test(field.label+' '+field.name),'browser_not_file','Only a recognized resume upload may receive the approved PDF.');const selector=await this.target(field,observationId);
  const file=path.join(this.directory,'approved-packet.pdf');await fs.writeFile(file,buffer,{mode:0o600});
  await this.invoke('upload',{selector,files:[file]});
  return {blockedEffects:0,observation:await this.observe(),transmission:'network_blocked_pending_manual_handoff'};
 }
 async handoff(){await this.invoke('eval',{script:releaseScript,timeoutMs:5000});await this.invoke('network_unroute',{url:'*'});this.locked=false;}
 async close(){await this.invoke('close');this.observation=null;await fs.unlink(path.join(this.directory,'approved-packet.pdf')).catch(()=>{});}
}
