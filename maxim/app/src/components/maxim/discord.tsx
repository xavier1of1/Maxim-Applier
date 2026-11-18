'use client';
import {useCallback,useEffect,useRef,useState} from 'react';
import {Button} from '@astryxdesign/core/Button';
import {Bell,Calendar,Eye,RefreshCw,Save,Send,ShieldCheck,X} from 'lucide-react';
import {type WorkspaceApi,errorMessage} from './api';
import {Banner,Glyph,Pill,ToolButton,formatDate} from './shared';

const labels={application_review:'Application review',weekly_review:'Weekly review',resume_review:'Saturday resume/PDF review',high_fit:'Fresh T2+ openings',needs_response:'Needs Response',networking_review:'Networking review',recruiter_reminder:'Manual recruiter reminders'};
type Kind=keyof typeof labels;
type Schedule={id:string;kind:'application_review'|'weekly_review'|'resume_review';enabled:boolean;timezone:string;anchor_date:string;local_time:string;next_due_at:string};
type Notice={id:string;kind:Kind;status:string;attempts:number;available_at:string;accepted_at:string|null;error_code:string|null;payload:{content:string}};
type Data={settings:{revision:number;destinationRevision:number;configured:boolean;enabled:boolean;state:string;contents:Kind[]};schedules:Schedule[];notifications:Notice[];attempts:{notification_id:string;attempt:number;status:string;http_status:number|null;error_code:string|null;retry_at:string|null}[];partial:boolean;counts:Record<string,number>;producers:{s7:boolean;s9:boolean};asOf:string};
type Preview={eligible:boolean;reason:string;payload:{content:string}};
export function DiscordView({api,disabled=false,asOf=''}:{api:WorkspaceApi;disabled?:boolean;asOf?:string}) {
 const [data,setData]=useState<Data|null>(null),[error,setError]=useState(''),[readError,setReadError]=useState(''),[busy,setBusy]=useState(false);
 const [webhook,setWebhook]=useState(''),[channel,setChannel]=useState(''),[existing,setExisting]=useState(false),[confirm,setConfirm]=useState(false),[enabled,setEnabled]=useState(false),[contents,setContents]=useState<Kind[]>([]);
 const [kind,setKind]=useState<Kind>('weekly_review'),[entity,setEntity]=useState(''),[preview,setPreview]=useState<Preview|null>(null);
 const [schedule,setSchedule]=useState({kind:'weekly_review' as Schedule['kind'],timezone:'America/New_York',anchorDate:'',localTime:'09:00',enabled:false});
 const active=useRef(false),sequence=useRef(0),pending=useRef(new Map<string,string>());
 const load=useCallback(async()=>{const n=++sequence.current;try{const r=await api.get<Data>('/api/discord');if(n===sequence.current){setData(r);setEnabled(r.settings.enabled);setContents(r.settings.contents);setConfirm(false);setReadError('');setSchedule(current=>{const saved=r.schedules.find(s=>s.kind===current.kind);return saved?{kind:saved.kind,timezone:saved.timezone,anchorDate:saved.anchor_date,localTime:saved.local_time,enabled:saved.enabled}:current;});}}catch(e){if(n===sequence.current)setReadError(errorMessage(e));}},[api]);
 useEffect(()=>{void load();return()=>{sequence.current++;};},[load,asOf]);
 const blocked=disabled||busy||Boolean(readError),s=data?.settings;
 async function act(action:string,payload:unknown) {
  if(blocked||active.current)return false;active.current=true;setBusy(true);setError('');
  const key=action==='configure_destination'?action:JSON.stringify({action,payload});
  const commandId=pending.current.get(key)||crypto.randomUUID();pending.current.set(key,commandId);
  try{await api.post('/api/discord/commands',{commandId,action,payload});pending.current.delete(key);await load();return true;}
  catch(e){setError(errorMessage(e));await load();return false;}finally{active.current=false;setBusy(false);}
 }
 async function plan(){
  if(blocked||active.current)return;active.current=true;setBusy(true);setError('');
  try{const r=await api.post<{result:Preview}>('/api/discord/plan',{kind,...(kind==='high_fit'?{entityId:entity}:{})});setPreview(r.result);}catch(e){setError(errorMessage(e));}finally{active.current=false;setBusy(false);}
 }
 if(!data||!s)return <section className="knowledge-view" aria-label="Discord delivery">{readError?<Banner>{readError}<ToolButton label="Refresh Discord" icon={RefreshCw} onClick={()=>void load()}/></Banner>:<p role="status">Loading Discord delivery</p>}</section>;
 const inputStyle={width:'100%',minWidth:0,padding:8,border:'1px solid #9ca3af',borderRadius:4,background:'var(--surface, white)',color:'inherit'};
 const gridStyle={display:'grid',gridTemplateColumns:'repeat(auto-fit, minmax(min(100%, 220px), 1fr))',gap:16} as const;
 return <div className="knowledge-view" style={{minWidth:0,overflowWrap:'anywhere'}}>
  {readError&&<Banner>{readError} Showing last loaded delivery state.</Banner>}{error&&<Banner onDismiss={()=>setError('')}>{error}</Banner>}
  <div className="knowledge-toolbar"><h3>Discord delivery</h3><div className="inline-actions"><Pill tone={s.enabled?'green':'amber'}>{s.state}</Pill><ToolButton label="Refresh Discord" icon={RefreshCw} onClick={()=>void load()} disabled={disabled||busy}/></div></div>
  <dl style={gridStyle}><div><dt>Confirmed submissions</dt><dd>{data.counts.submitted}</dd></div><div><dt>Unresolved applications</dt><dd>{data.counts.applicationReview}</dd></div><div><dt>As of</dt><dd>{formatDate(data.asOf,true)}</dd></div></dl>
  <section className="knowledge-section" aria-label="Private destination"><h4>Existing maxim applier destination</h4>
   <form style={gridStyle} autoComplete="off" onSubmit={e=>{e.preventDefault();void act('configure_destination',{expectedRevision:s.revision,webhook,channelId:channel,confirmedExisting:true}).finally(()=>{setWebhook('');setChannel('');setExisting(false);});}}>
    <label>Private webhook<input style={inputStyle} type="password" autoComplete="new-password" value={webhook} disabled={blocked} onChange={e=>{setWebhook(e.target.value);pending.current.delete('configure_destination');}} required/></label>
    <label>Existing channel ID<input style={inputStyle} inputMode="numeric" value={channel} disabled={blocked} onChange={e=>{setChannel(e.target.value);pending.current.delete('configure_destination');}} required/></label>
    <label className="binary-option"><input type="checkbox" checked={existing} disabled={blocked} onChange={e=>setExisting(e.target.checked)}/>I confirmed this is the existing private destination</label>
    <Button label={s.configured?'Replace destination':'Save destination'} icon={<Glyph icon={ShieldCheck}/>} type="submit" isDisabled={blocked||!existing||!webhook||!channel}/>
   </form>
  </section>
  <section className="knowledge-section" aria-label="Delivery consent"><h4>Delivery consent</h4>
   <fieldset disabled={blocked||!s.configured}><legend>Approved contents</legend><div style={gridStyle}>{(Object.keys(labels) as Kind[]).map(k=><label className="binary-option" key={k}><input type="checkbox" checked={contents.includes(k)} disabled={k==='needs_response'&&!data.producers.s7||['networking_review','recruiter_reminder'].includes(k)&&!data.producers.s9} onChange={e=>setContents(c=>e.target.checked?[...c,k]:c.filter(x=>x!==k))}/>{labels[k]}{k==='needs_response'&&!data.producers.s7?' (S7 unavailable)':(['networking_review','recruiter_reminder'].includes(k)&&!data.producers.s9?' (S9 unavailable)':'')}</label>)}</div>
    <label className="binary-option"><input type="checkbox" checked={enabled} onChange={e=>setEnabled(e.target.checked)}/>Enable delivery</label>
    <label className="binary-option"><input type="checkbox" checked={confirm} onChange={e=>setConfirm(e.target.checked)}/>I approve these contents for the confirmed destination</label>
   </fieldset>
   <Button label="Save consent" icon={<Glyph icon={Save}/>} isDisabled={blocked||!s.configured||!confirm||(enabled&&!contents.length)} onClick={()=>void act('set_consent',{expectedRevision:s.revision,destinationRevision:s.destinationRevision,enabled,contents,confirmDestination:true})}/>
  </section>
  <section className="knowledge-section" aria-label="Delivery plan"><h4>Plan and dry-run</h4><div style={gridStyle}>
   <label>Notification<select style={inputStyle} value={kind} disabled={blocked} onChange={e=>{setKind(e.target.value as Kind);setPreview(null);}}>{(Object.keys(labels) as Kind[]).map(k=><option value={k} key={k}>{labels[k]}</option>)}</select></label>
   {kind==='high_fit'&&<label>Opening UUID<input style={inputStyle} value={entity} disabled={blocked} onChange={e=>{setEntity(e.target.value);setPreview(null);}}/></label>}
   <Button label="Preview only" icon={<Glyph icon={Eye}/>} isDisabled={blocked} onClick={()=>void plan()}/>
  </div>{preview&&<div role="status"><p>{preview.payload.content}</p><Pill tone={preview.eligible?'green':'amber'}>{preview.eligible?'Eligible':preview.reason.replaceAll('_',' ')}</Pill></div>}
   <Button label="Queue this notification" icon={<Glyph icon={Send}/>} isDisabled={blocked||!s.enabled||!s.contents.includes(kind)||!preview?.eligible} onClick={()=>void act('enqueue_now',{kind,...(kind==='high_fit'?{entityId:entity}:{})})}/>
  </section>
  <section className="knowledge-section" aria-label="Durable schedules"><h4>Schedules</h4><form style={gridStyle} onSubmit={e=>{e.preventDefault();void act('save_schedule',{...schedule,expectedRevision:s.revision});}}>
   <label>Schedule<select style={inputStyle} value={schedule.kind} disabled={blocked} onChange={e=>{const k=e.target.value as Schedule['kind'],r=data.schedules.find(s=>s.kind===k);setSchedule({kind:k,timezone:r?.timezone||'America/New_York',anchorDate:r?.anchor_date||'',localTime:r?.local_time||'09:00',enabled:r?.enabled||false});}}><option value="application_review">Daily application batch</option><option value="weekly_review">Weekly review</option><option value="resume_review">Every 21 days, Saturday</option></select></label>
   <label>IANA timezone<input style={inputStyle} value={schedule.timezone} required disabled={blocked} onChange={e=>setSchedule(s=>({...s,timezone:e.target.value}))}/></label>
   <label>Anchor date<input style={inputStyle} type="date" value={schedule.anchorDate} required disabled={blocked} onChange={e=>setSchedule(s=>({...s,anchorDate:e.target.value}))}/></label>
   <label>Local time<input style={inputStyle} type="time" value={schedule.localTime} required disabled={blocked} onChange={e=>setSchedule(s=>({...s,localTime:e.target.value}))}/></label>
   <label className="binary-option"><input type="checkbox" checked={schedule.enabled} disabled={blocked} onChange={e=>setSchedule(s=>({...s,enabled:e.target.checked}))}/>Schedule enabled</label>
   <Button label="Save schedule" type="submit" icon={<Glyph icon={Calendar}/>} isDisabled={blocked}/>
  </form>{data.schedules.map(r=><p key={r.id}>{labels[r.kind]}: {r.enabled?'enabled':'disabled'}; {r.timezone} {r.local_time}; next {formatDate(r.next_due_at,true)}</p>)}</section>
  <section className="knowledge-section" aria-label="Delivery history"><h4>Delivery history</h4>{data.partial&&<Banner tone="info">Most recent 100 notifications.</Banner>}
   {!data.notifications.length?<p>No planned deliveries.</p>:data.notifications.map(n=><article key={n.id} style={{borderBottom:'1px solid #cbd5e1',padding:'12px 0'}}><div className="fact-title"><Bell size={16}/><strong>{labels[n.kind]}</strong><Pill tone={n.status==='accepted'?'green':'amber'}>{n.status}</Pill></div>
    <p>{n.payload.content}</p><p className="small">Attempts {n.attempts}/5{n.status==='retry'?`; retry after ${formatDate(n.available_at,true)}`:''}{n.accepted_at?`; HTTP accepted ${formatDate(n.accepted_at,true)}`:''}{n.error_code?`; ${n.error_code.replaceAll('_',' ')}`:''}</p>
    {n.status==='uncertain'&&<div className="inline-actions"><Button label="Retry; may duplicate" icon={<Glyph icon={RefreshCw}/>} isDisabled={blocked||!s.enabled||n.attempts>=5} onClick={()=>void act('resolve_uncertain',{notificationId:n.id,decision:'retry',acknowledgeDuplicateRisk:true})}/><Button label="Do not retry" icon={<Glyph icon={X}/>} isDisabled={blocked} onClick={()=>void act('resolve_uncertain',{notificationId:n.id,decision:'cancel',acknowledgeDuplicateRisk:true})}/></div>}
    {n.status==='failed'&&n.attempts<5&&<Button label="Retry rejected delivery" icon={<Glyph icon={RefreshCw}/>} isDisabled={blocked||!s.enabled} onClick={()=>void act('retry_failed',{notificationId:n.id,acknowledgeDuplicateRisk:true})}/>}
    <details><summary>Attempt history</summary>{data.attempts.filter(a=>a.notification_id===n.id).map(a=><p className="small" key={a.attempt}>{a.attempt}: {a.status}{a.http_status?` (HTTP ${a.http_status})`:''}; {(a.error_code||'').replaceAll('_',' ')}{a.retry_at?`; ${formatDate(a.retry_at,true)}`:''}</p>)}</details>
   </article>)}
  </section>
 </div>;
}
