'use client';
import {useCallback,useEffect,useRef,useState,type FormEvent} from 'react';
import {Button} from '@astryxdesign/core/Button';
import {TextInput} from '@astryxdesign/core/TextInput';
import {NumberInput} from '@astryxdesign/core/NumberInput';
import {Mail,RefreshCw,ExternalLink,Unlink,Check,Trash2,Link as LinkIcon} from 'lucide-react';
import {type WorkspaceApi,errorMessage} from './api';
import {Banner,EmptyState,Pill,ToolButton,formatDate} from './shared';
import {useBoundedRefresh} from './use-bounded-refresh';

type Account={id:string;revision:number;expected_email:string;email:string|null;status:string;enabled:boolean;thread_ids:string[];lookback_days:number;retention_days:number;retain_body:boolean;model_disclosure:boolean;last_success_at:string|null;stale:boolean;error_code:string|null;next_retry_at:string|null};
type Observation={id:string;thread_id:string;source_url:string;received_at:string;direction:string;headers:Record<string,string>;body:string|null;withdrawn:boolean;suggestion:{kind:string;applicationId?:string}};
type Link={id:string;observation_id:string;application_id:string;revision:number;withdrawn_at:string|null};
type Task={id:string;link_id:string;observation_id:string;application_id:string;revision:number;status:string;resolution:string|null};
type Application={id:string;revision:number;job_revision:number;company:string;title:string;outcome:string};
type Data={account:Account|null;observations:Observation[];links:Link[];tasks:Task[];applications:Application[];work:{id:string;status:string;error_code:string|null;lease_expired:boolean}[];revocations:{id:string;error_code:string|null}[];more:boolean;offset:number;partial:Record<string,boolean>};
export function GmailView({api,disabled=false,asOf='',navigate}:{api:WorkspaceApi;disabled?:boolean;asOf?:string;navigate?:(n:{view:string;application:string})=>void}){
 const [data,setData]=useState<Data|null>(null),[error,setError]=useState(''),[readError,setReadError]=useState(''),[busy,setBusy]=useState(false),[offset,setOffset]=useState(0);
 const [consent,setConsent]=useState(false),[email,setEmail]=useState(''),[threads,setThreads]=useState(''),[days,setDays]=useState(7),[retention,setRetention]=useState(7),[retain,setRetain]=useState(false),[disclose,setDisclose]=useState(false),[accepted,setAccepted]=useState(false);
 const [selected,setSelected]=useState<Record<string,string>>({}),[reason,setReason]=useState(''),[replies,setReplies]=useState<Record<string,string>>({});
 const sequence=useRef(0),active=useRef(false),attempt=useRef<{key:string;id:string}|null>(null);
 const load=useCallback(async()=>{const n=++sequence.current;try{const v=await api.get<Data>('/api/gmail?offset='+offset);if(sequence.current===n){setData(v);setReadError('');}}catch(e){if(sequence.current===n)setReadError(errorMessage(e));}},[api,offset]);
 useEffect(()=>{void load();return()=>{sequence.current++;};},[load,asOf]);
 const running=data?.work.some(w=>['queued','leased'].includes(w.status));
 useBoundedRefresh(Boolean(running),load);
 const blocked=disabled||busy||Boolean(readError),a=data?.account;
 async function action(name:string,payload:unknown){
  if(active.current||blocked)return;active.current=true;setBusy(true);setError('');
  const key=JSON.stringify({name,payload});if(attempt.current?.key!==key)attempt.current={key,id:crypto.randomUUID()};
  try{await api.post('/api/gmail/commands',{commandId:attempt.current.id,action:name,payload});attempt.current=null;await load();if(name==='consent')setConsent(false);}
  catch(e){setError(errorMessage(e));}finally{active.current=false;setBusy(false);}
 }
 function editConsent(){setEmail(a?.expected_email||'');setThreads(a?.thread_ids.join(', ')||'');setDays(a?.lookback_days||7);setRetention(a?.retention_days||7);setRetain(a?.retain_body||false);setDisclose(a?.model_disclosure||false);setAccepted(false);setConsent(true);}
 async function save(e:FormEvent){e.preventDefault();await action('consent',{expectedRevision:a?.revision||0,email,threadIds:threads.split(/[\s,]+/).filter(Boolean),lookbackDays:days,retentionDays:retention,retainBody:retain,modelDisclosure:disclose,broadReadAccepted:accepted,selectionApproved:accepted});}
 async function connect(){
  if(!a||blocked)return;setBusy(true);setError('');
  try{const r=await api.post<{result:{url:string}}>('/api/gmail/oauth',{expectedRevision:a.revision});window.location.assign(r.result.url);}catch(e){setError(errorMessage(e));setBusy(false);}
 }
 const appName=(id:string)=>{const app=data?.applications.find(x=>x.id===id);return app?app.company+' - '+app.title:id;};
 const button=(label:string,fn:()=>void,disabledExtra=false)=><Button label={label} variant="secondary" isDisabled={blocked||disabledExtra} onClick={fn}/>;
 return <section className="knowledge-view gmail-view" aria-label="Gmail evidence" style={{minWidth:0,overflowWrap:'anywhere'}}>
  <style jsx>{`
   .gmail-view {display:flex;flex-direction:column;gap:16px;padding-top:20px}
   .gmail-view h1 {font-size:18px}.gmail-view h2 {font-size:15px}
   .view-header {display:flex;align-items:center;justify-content:space-between;gap:12px}
   .view-header p {font-size:12px;color:var(--ui-muted)}
   .row-actions {display:flex;align-items:center;flex-wrap:wrap;gap:8px;min-width:0}
   .section-stack,.form-stack {display:flex;flex-direction:column;gap:12px;min-width:0}
   .form-stack {padding:20px 0;border-block:1px solid var(--ui-line)}
   .list-row {display:flex;align-items:center;flex-wrap:wrap;gap:10px;padding:12px 0;border-bottom:1px solid var(--ui-line)}
   .gmail-view select {max-width:100%;min-width:0;padding:8px;border:1px solid var(--ui-line);border-radius:4px;background:white;font-size:12px}
   .gmail-view label {font-size:12px;line-height:1.7}
   .gmail-view input[type=checkbox] {accent-color:var(--ui-green);width:16px;height:16px;vertical-align:middle;margin-right:8px}
   .gmail-view article {font-size:12px}.gmail-view pre {max-height:320px;overflow:auto}
  `}</style>
  <header className="view-header"><div><h1>Gmail</h1><p>{a?.email||a?.expected_email||'No connected account'}</p></div><ToolButton label="Refresh Gmail evidence" icon={RefreshCw} onClick={()=>void load()} disabled={busy}/></header>
  {readError&&<Banner>{readError} Last-loaded evidence may be stale.</Banner>}{error&&<Banner onDismiss={()=>setError('')}>{error}</Banner>}
  {Boolean(data?.revocations.length)&&<Banner tone="warning">Google grant revocation is pending. Disconnect again to retry; reconnect is blocked until cleanup finishes.</Banner>}
  {data?.work[0]?.lease_expired&&<Banner tone="warning">The Gmail worker lease expired. This step has not been acknowledged; recovery is pending.</Banner>}
  {data?.work[0]?.status==='failed'&&<Banner tone="warning">Gmail work failed: {data.work[0].error_code||'worker unavailable'}.</Banner>}
  {!data&&!readError&&<p role="status">Loading Gmail evidence</p>}
  {a&&<div className="section-stack">
   <div className="row-actions"><Pill tone={a.enabled?'green':'amber'}>{a.status}</Pill>{a.stale&&<Pill tone="amber">Stale</Pill>}<span>Last successful check: {a.last_success_at?formatDate(a.last_success_at,true):'Never'}</span></div>
   {a.error_code&&<Banner tone="warning">{a.error_code.replaceAll('_',' ')}{a.next_retry_at?' - retry after '+formatDate(a.next_retry_at,true):''}</Banner>}
   <div className="row-actions">{button('Consent settings',editConsent,['authorizing','revoking'].includes(a.status))}
    {a.enabled&&button('Check selected threads',()=>void action('sync',{expectedRevision:a.revision}),running)}
    {!a.enabled&&['disconnected','revoked','error'].includes(a.status)&&button('Connect Google account',()=>void connect())}
    {a.enabled&&button('Reset bounded backfill',()=>{if(window.confirm('Reset the history cursor and re-read only selected threads within the consented lookback?'))void action('reset_checkpoint',{expectedRevision:a.revision});},running)}
    <ToolButton label={a.status==='revoking'?'Retry Google revocation':'Disconnect and revoke Google access'} icon={Unlink} disabled={blocked||(a.status==='revoked'&&!data?.revocations.length)} onClick={()=>{if(window.confirm('Stop all Gmail reads immediately and queue Google grant revocation?'))void action('disconnect',{expectedRevision:a.revision});}}/>
    <ToolButton label="Purge retained mail content" icon={Trash2} disabled={blocked} onClick={()=>{if(window.confirm('Permanently remove retained headers and bodies and withdraw their links/tasks?'))void action('purge_content',{expectedRevision:a.revision});}}/>
   </div>
  </div>}
  {!a&&data&&<EmptyState icon={Mail} title="No Gmail consent" action={button('Review account consent',editConsent)}/>}
  {consent&&<form className="form-stack" onSubmit={save}>
   <h2>Account Consent</h2>
   <TextInput label="Email address" type="email" value={email} isRequired isDisabled={Boolean(a)||blocked} onChange={setEmail}/>
   <TextInput label="Selected Gmail thread IDs" value={threads} isRequired isDisabled={blocked} onChange={setThreads}/>
   <div className="row-actions"><NumberInput label="Lookback days" min={1} max={30} value={days} onChange={setDays} isDisabled={blocked}/><NumberInput label="Retention days" min={1} max={30} value={retention} onChange={setRetention} isDisabled={blocked}/></div>
   <label><input type="checkbox" checked={retain} onChange={e=>{setRetain(e.target.checked);if(!e.target.checked)setDisclose(false);}}/>Retain plain-text bodies locally</label>
   <label><input type="checkbox" checked={disclose} disabled={!retain} onChange={e=>setDisclose(e.target.checked)}/>Allow bounded retained body excerpts in model requests</label>
   <label><input type="checkbox" checked={accepted} required onChange={e=>setAccepted(e.target.checked)}/>I authorize read-only access to this account. Google's grant can read the whole mailbox; Maxim will fetch content only for up to five selected threads. Incremental history reads mailbox-wide message/thread IDs. Headers and optional bodies expire after the selected retention. No attachments, sending, modifications or calendar access.</label>
   <div className="row-actions"><Button type="submit" label="Record consent" isDisabled={blocked||!accepted}/>{button('Close',()=>setConsent(false))}</div>
  </form>}
  {data&&<>
   <h2>Needs Response</h2>
   {!data.tasks.some(t=>t.status==='open')&&<p>No open response tasks.</p>}
   {data.tasks.filter(t=>t.status==='open').map(t=><div key={t.id} className="list-row"><div><strong>{appName(t.application_id)}</strong><p>{t.status}</p></div>
    <select aria-label={'Reply evidence for '+t.id} value={replies[t.id]||''} onChange={e=>setReplies({...replies,[t.id]:e.target.value})}><option value="">Manual resolution</option>{data.observations.filter(o=>o.direction==='outgoing'&&!o.withdrawn).map(o=><option key={o.id} value={o.id}>{o.headers.subject||o.id}</option>)}</select>
    <ToolButton label="Resolve response task" icon={Check} disabled={blocked||reason.trim().length<3} onClick={()=>void action('resolve_task',{taskId:t.id,expectedRevision:t.revision,reason,...(replies[t.id]?{replyObservationId:replies[t.id]}:{})})}/>
    {navigate&&button('Application',()=>navigate({view:'applications',application:t.application_id}))}
   </div>)}
   <TextInput label="Review reason" value={reason} onChange={value=>setReason(value.slice(0,500))} isDisabled={blocked}/>
   <h2>Evidence</h2>
   {!data.observations.length&&<p>{a?.enabled?'No observed evidence in this selection.':'Mail content is hidden while disconnected.'}</p>}
   {data.observations.map(o=>{const l=data.links.find(x=>x.observation_id===o.id&&!x.withdrawn_at),chosen=selected[o.id]||o.suggestion.applicationId||'',app=data.applications.find(x=>x.id===chosen),task=data.tasks.find(t=>t.observation_id===o.id);return <article key={o.id} className="section-stack" style={{borderTop:'1px solid var(--border-color, #ddd)',padding:'16px 0',minWidth:0}}>
    <div className="row-actions"><strong>{o.headers.subject||'Retained evidence record'}</strong><Pill>{o.direction}</Pill><Pill>{o.withdrawn?'Withdrawn':l?'Human linked':o.suggestion.kind==='identifier'?'Identifier suggestion':'Unassigned'}</Pill><a href={o.source_url} target="_blank" rel="noreferrer" aria-label="Open source thread"><ExternalLink size={16}/></a></div>
    <p>{o.headers.from} {formatDate(o.received_at,true)}</p>{o.body&&<details><summary>Retained body</summary><pre style={{whiteSpace:'pre-wrap',overflowWrap:'anywhere',fontFamily:'inherit'}}>{o.body}</pre></details>}
    {!o.withdrawn&&<div className="row-actions">{l?<><span>{appName(l.application_id)}</span><ToolButton label="Withdraw incorrect link" icon={Unlink} disabled={blocked||reason.trim().length<3} onClick={()=>void action('withdraw_link',{linkId:l.id,expectedRevision:l.revision,reason})}/>
     {!task&&o.direction==='incoming'&&button('Needs response',()=>{const target=data.applications.find(x=>x.id===l.application_id);if(target)void action('create_task',{linkId:l.id,expectedRevision:l.revision,expectedApplicationRevision:target.revision,reason});},reason.trim().length<3)}
     {data.tasks.filter(t=>(t.status==='resolved'||t.status==='withdrawn'&&t.resolution==='link_withdrawn')&&t.link_id!==l.id&&t.observation_id===o.id).map(t=><span key={t.id}>{button('Correct task '+t.id.slice(0,8),()=>{const target=data.applications.find(x=>x.id===l.application_id);if(target)void action('correct_task',{taskId:t.id,expectedRevision:t.revision,linkId:l.id,expectedLinkRevision:l.revision,expectedApplicationRevision:target.revision,reason});},reason.trim().length<3)}</span>)}
     </>:<><select aria-label={'Application for '+o.id} value={chosen} onChange={e=>setSelected({...selected,[o.id]:e.target.value})} style={{maxWidth:'100%'}}><option value="">Unassigned</option>{data.applications.map(x=><option key={x.id} value={x.id}>{x.company} - {x.title}</option>)}</select><ToolButton label="Confirm application link" icon={LinkIcon} disabled={blocked||!app||reason.trim().length<3} onClick={()=>{if(app)void action('confirm_link',{observationId:o.id,applicationId:app.id,expectedApplicationRevision:app.revision,expectedJobRevision:app.job_revision,reason});}}/></>}
    </div>}
   </article>;})}
   <div className="row-actions">{button('Previous',()=>setOffset(Math.max(0,offset-50)),offset===0)}{button('Next',()=>setOffset(offset+50),!data.more)}</div>
   {Object.values(data.partial).some(Boolean)&&<Banner tone="warning">Some historical records are outside this bounded view.</Banner>}
   <details><summary>Task history</summary>{data.tasks.filter(t=>t.status!=='open').map(t=><p key={t.id}>{appName(t.application_id)}: {t.status} ({t.resolution})</p>)}</details>
  </>}
 </section>;
}
