'use client';
import {useCallback,useEffect,useRef,useState} from 'react';
import {Button} from '@astryxdesign/core/Button';
import {TextArea} from '@astryxdesign/core/TextArea';
import {NumberInput} from '@astryxdesign/core/NumberInput';
import {Selector} from '@astryxdesign/core/Selector';
import {MessageSquare,Play,RefreshCw,Save,Square,Trash2} from 'lucide-react';
import {type WorkspaceApi,errorMessage} from './api';
import {Banner,EmptyState,Glyph,Pill,ToolButton,formatDate} from './shared';
import {useBoundedRefresh} from './use-bounded-refresh';

type Mode='project_defense'|'behavioral'|'system_design';
type Role={id:string;revision:number;company:string;title:string};
type Session={id:string;job_id:string;revision:number;mode:Mode;status:string;candidate_revision:number;job_revision:number;expires_at:string;created_at:string;snapshot?:{prompts:string[];facts:{id:string;revision:number;field_key:string;value:unknown;source_id:string;source_revision:number}[];evidenceCoverage:{sourceStatus:string;available:number;selected:number};role:Role&{descriptionOmitted:boolean};communityIntel:{text:string;label:string}|null}};
type Attempt={id:string;text:string;hypothetical:boolean;local_checks:string[];status:string;error_code:string|null;accounting:{estimatedInputTokens:number;outputReserve:number;exactProviderBilling:boolean}|null;usage:{prompt_tokens:number;completion_tokens:number}|null;feedback:{label:string;observations:{claim:string;assessment:string;factIds:string[]}[];rubric:{dimension:string;feedback:string}[];followUpQuestions:string[]}|null};
type Data={sessions:Session[];partial:boolean;session:Session|null;attempts:Attempt[];candidate:{revision:number;ownership:string};roles:Role[];rolesPartial:boolean;modelConfigured:boolean;transportAvailable:boolean;prompts:Record<Mode,string[]>};
const modes=[{value:'project_defense',label:'Project defense'},{value:'behavioral',label:'Behavioral / STAR'},{value:'system_design',label:'System design'}];
const running=(a:Attempt)=>['queued','running'].includes(a.status);
const retryable=(a:Attempt)=>['saved','failed','cancelled','interrupted','model_unconfigured'].includes(a.status);

export function InterviewView({api,disabled,job,asOf='',refresh,onDirtyChange}:{api:WorkspaceApi;disabled:boolean;job:Role|null;asOf?:string;refresh?:()=>Promise<void>;onDirtyChange?:(dirty:boolean)=>void}){
 const [data,setData]=useState<Data|null>(null),[readError,setReadError]=useState(''),[error,setError]=useState(''),[busy,setBusy]=useState(false);
 const [mode,setMode]=useState<Mode>('project_defense'),[days,setDays]=useState<number|null>(30),[intel,setIntel]=useState('');
 const [sessionId,setSessionId]=useState(()=>typeof window==='undefined'?'':new URL(window.location.href).searchParams.get('practice')||'');
 const [text,setText]=useState(''),[hypothetical,setHypothetical]=useState(false),[consent,setConsent]=useState(false);
 const [roleSelection,setRoleSelection]=useState<string|null>(()=>typeof window==='undefined'?null:new URL(window.location.href).searchParams.get('job'));
 const sequence=useRef(0),active=useRef(false),attempts=useRef(new Map<string,string>()),previousJob=useRef(job?.id),jobId=roleSelection??job?.id;
 const role=job?.id===jobId?job:data?.roles.find(r=>r.id===jobId)||null;
 useEffect(()=>{if(previousJob.current!==job?.id){previousJob.current=job?.id;setRoleSelection(null);setSessionId(new URL(window.location.href).searchParams.get('practice')||'');setText('');setConsent(false);}},[job?.id]);
 const load=useCallback(async()=>{
  const n=++sequence.current;
  try{
   const query=new URLSearchParams();if(jobId)query.set('job',jobId);if(sessionId)query.set('session',sessionId);
   const result=await api.get<Data>('/api/interview?'+query);
   if(n===sequence.current){setData(result);setReadError('');}
  }catch(e){if(n===sequence.current)setReadError(errorMessage(e));}
 },[api,jobId,sessionId]);
 useEffect(()=>{void load();return()=>{sequence.current++;};},[load,asOf]);
 useBoundedRefresh(Boolean(data?.attempts.some(running)),load);
 useEffect(()=>{const stop=(e:BeforeUnloadEvent)=>{if(text.trim()){e.preventDefault();e.returnValue='';}};window.addEventListener('beforeunload',stop);return()=>window.removeEventListener('beforeunload',stop);},[text]);
 useEffect(()=>{onDirtyChange?.(Boolean(text.trim()));return()=>onDirtyChange?.(false);},[text,onDirtyChange]);
 const select=(id:string)=>{
  if(text.trim()&&!window.confirm('Discard this unsaved practice attempt?'))return;
  setText('');setConsent(false);setSessionId(id);const u=new URL(window.location.href);if(id)u.searchParams.set('practice',id);else u.searchParams.delete('practice');window.history.replaceState(null,'',u);
 };
 const selectionBlocked=disabled||busy||Boolean(readError)||Boolean(data&&(data.session?.id||'')!==sessionId),blocked=selectionBlocked||!role,s=data?.session;
 const act=async(action:string,payload:unknown,after?:(r:{id:string})=>void)=>{
  if(blocked||active.current)return;active.current=true;setBusy(true);setError('');
  const key=JSON.stringify({action,payload}),commandId=attempts.current.get(key)||crypto.randomUUID();attempts.current.set(key,commandId);
  try{const r=await api.post<{result:{id:string}}>('/api/interview/commands',{commandId,action,payload});attempts.current.delete(key);after?.(r.result);await load();await refresh?.();}
  catch(e){setError(errorMessage(e));await load();}finally{active.current=false;setBusy(false);}
 };
 if(!data)return <section className="knowledge-view">{readError?<EmptyState icon={MessageSquare} title="Practice unavailable" detail={readError} action={<Button label="Retry" icon={<Glyph icon={RefreshCw}/>} onClick={()=>void load()}/>}/>:<p role="status">Loading interview practice</p>}</section>;
 return <div className="knowledge-view" style={{minWidth:0,overflowWrap:'anywhere'}}>
  <header className="knowledge-toolbar"><div><h2 style={{fontSize:20,margin:0}}>Interview practice</h2>{role&&<p>{role.company} / {role.title}</p>}</div><ToolButton label="Refresh practice" icon={RefreshCw} onClick={()=>void load()} disabled={busy}/></header>
  {readError&&<Banner>{readError} Showing last loaded practice.</Banner>}{error&&<Banner onDismiss={()=>setError('')}>{error}</Banner>}
  {!data.modelConfigured&&<Banner tone="info">Model not configured. Focused prompts and saved attempts remain available; new model feedback is unavailable.</Banner>}
  {data.modelConfigured&&!data.transportAvailable&&<Banner tone="warning">External interview feedback transport awaits explicit authorization. Saved prompts and attempts remain available.</Banner>}
  {data.candidate.ownership!=='canonical'&&<Banner tone="warning">Review and activate Candidate knowledge before starting evidence-grounded practice.</Banner>}
  <section className="knowledge-section" aria-label="Practice setup" style={{display:'grid',gap:16}}>
   <Selector label="Role" value={jobId||''} isDisabled={selectionBlocked} options={[{value:'',label:'Choose a role'},...(job&&!data.roles.some(r=>r.id===job.id)?[job,...data.roles]:data.roles).map(r=>({value:r.id,label:r.company+' / '+r.title}))]} onChange={id=>{
    if(text.trim()&&!window.confirm('Discard this unsaved practice attempt?'))return;
    setRoleSelection(id);setSessionId('');setText('');setConsent(false);
    const u=new URL(window.location.href);if(id)u.searchParams.set('job',id);else u.searchParams.delete('job');u.searchParams.delete('practice');window.history.replaceState(null,'',u);
   }}/>
   {data.rolesPartial&&<p className="small muted">Recent 100 active roles shown. Open an older role from Jobs.</p>}
   {!data.roles.length&&!job&&<EmptyState icon={MessageSquare} title="No saved roles for practice" action={<a href="/maxim?view=jobs">Jobs</a>}/>}
   <div className="form-grid"><Selector label="Practice mode" value={mode} onChange={v=>setMode(v as Mode)} options={modes} isDisabled={blocked}/>
    <NumberInput label="Retention days" value={days} onChange={setDays} min={1} max={365} isIntegerOnly isDisabled={blocked}/></div>
   <details><summary>Community context</summary><TextArea label="Unverified community intel" value={intel} onChange={setIntel} maxLength={1500} rows={2} isDisabled={blocked}/></details>
   <Button label="Start practice" icon={<Glyph icon={Play}/>} isDisabled={blocked||Boolean(text.trim())||data.candidate.ownership!=='canonical'||days===null} onClick={()=>role&&void act('start_session',{jobId:role.id,expectedJobRevision:role.revision,expectedCandidateRevision:data.candidate.revision,mode,retentionDays:days,communityIntel:intel},r=>select(r.id))}/>
   {!s&&<ol style={{paddingLeft:20,display:'grid',gap:8}}>{data.prompts[mode].map(p=><li key={p}>{p}</li>)}</ol>}
  </section>
  {data.sessions.length>0&&<section className="knowledge-section"><Selector label="Saved session" value={sessionId} onChange={select} isDisabled={blocked} options={[{value:'',label:'Choose a session'},...data.sessions.map(s=>({value:s.id,label:(modes.find(m=>m.value===s.mode)?.label||s.mode)+' / '+formatDate(s.created_at,true)+' / '+s.status}))]}/>{data.partial&&<p className="small muted">Recent 50 sessions shown.</p>}</section>}
  {s&&<section className="knowledge-section" aria-label="Current practice">
   <div className="knowledge-toolbar"><Pill tone={s.status==='active'?'green':'amber'}>{s.status} / rev {s.revision}</Pill><ToolButton label="Delete practice session" icon={Trash2} disabled={blocked||s.status==='deleted'} onClick={()=>{if(window.confirm('Erase this session, all attempts and feedback?'))void act('delete_session',{sessionId:s.id,expectedRevision:s.revision});}}/></div>
   <p className="small muted">Role rev {s.job_revision} / Candidate rev {s.candidate_revision} / Expires {formatDate(s.expires_at)}</p>
   {s.status!=='active'?<Banner tone="warning">This session is no longer reusable. Start a new practice with current evidence.</Banner>:<>
    <ol style={{paddingLeft:20,display:'grid',gap:8,margin:'16px 0'}}>{s.snapshot?.prompts.map(p=><li key={p}>{p}</li>)}</ol>
    <details><summary>Approved evidence ({s.snapshot?.facts.length||0})</summary>
     {s.snapshot?.evidenceCoverage&&<p className="small muted">Selected {s.snapshot.evidenceCoverage.selected} of {s.snapshot.evidenceCoverage.available} usable fields in bounded context / {s.snapshot.evidenceCoverage.sourceStatus}</p>}
     {!s.snapshot?.facts.length&&<p>No approved disclosable example. Ask for one; missing experience remains unknown.</p>}
     {s.snapshot?.facts.map(f=><div key={f.id} style={{padding:'12px 0',borderBottom:'1px solid #ddd'}}><p>{typeof f.value==='string'?f.value:JSON.stringify(f.value)}</p><small>{f.field_key} / {f.id} rev {f.revision}<br/>Source {f.source_id} rev {f.source_revision}</small></div>)}
     {s.snapshot?.role.descriptionOmitted&&<p>Role description excerpt limited to 4,000 characters.</p>}
    </details>
    {s.snapshot?.communityIntel&&<aside><strong>{s.snapshot.communityIntel.label}</strong><p>{s.snapshot.communityIntel.text}</p></aside>}
    <form style={{display:'grid',gap:16,marginTop:20}} onSubmit={e=>{e.preventDefault();void act('save_attempt',{sessionId:s.id,expectedRevision:s.revision,text,hypothetical,requestFeedback:consent,modelConsent:consent},()=>{setText('');setConsent(false);});}}>
     <TextArea label="Practice response" value={text} onChange={setText} maxLength={6000} rows={6} isDisabled={blocked} isRequired/>
     <label className="binary-option"><input type="checkbox" checked={hypothetical||s.mode==='system_design'} disabled={blocked||s.mode==='system_design'} onChange={e=>setHypothetical(e.target.checked)}/>Hypothetical / mock answer, not approved experience</label>
     <label className="binary-option"><input type="checkbox" checked={consent} disabled={blocked||!data.transportAvailable} onChange={e=>setConsent(e.target.checked)}/>Send this attempt, selected role and approved evidence to the configured model for feedback</label>
     <Button label={consent?'Save and request feedback':'Save attempt'} type="submit" icon={<Glyph icon={Save}/>} isDisabled={blocked||!text.trim()} isLoading={busy}/>
    </form>
   </>}
   {data.attempts.map(a=><article key={a.id} aria-label="Saved practice attempt" style={{padding:'20px 0',borderBottom:'1px solid #ddd',minWidth:0}}>
    <div className="knowledge-toolbar"><strong>{a.hypothetical?'Hypothetical practice':'Unapproved practice'}</strong><Pill>{a.status.replaceAll('_',' ')}</Pill></div>
    <p style={{whiteSpace:'pre-wrap'}}>{a.text}</p><ul>{a.local_checks.map((c,i)=><li key={i}>{c}</li>)}</ul>
    {a.error_code&&<p role="status">{a.error_code.replaceAll('_',' ')}</p>}
    {a.feedback&&<section aria-label="Model coaching"><h3 style={{fontSize:16}}>{a.feedback.label}</h3>{a.feedback.observations.map((o,i)=><p key={i}><strong>{o.assessment.replaceAll('_',' ')}</strong>: {o.claim}{o.factIds.length>0&&<small> / {o.factIds.join(', ')}</small>}</p>)}{a.feedback.rubric.map((r,i)=><p key={i}><strong>{r.dimension}</strong>: {r.feedback}</p>)}<ul>{a.feedback.followUpQuestions.map((q,i)=><li key={i}>{q}</li>)}</ul></section>}
    {a.accounting&&<p className="small muted">Local estimated input {a.accounting.estimatedInputTokens} + output reserve {a.accounting.outputReserve}. {a.usage?`Provider reported ${a.usage.prompt_tokens} input / ${a.usage.completion_tokens} output.`:'Provider usage not reported.'}</p>}
    {running(a)&&<Button label="Stop feedback" icon={<Glyph icon={Square}/>} isDisabled={blocked} onClick={()=>void act('cancel_feedback',{sessionId:s.id,expectedRevision:s.revision,attemptId:a.id})}/>}
    {s.status==='active'&&retryable(a)&&<Button label="Request feedback" icon={<Glyph icon={MessageSquare}/>} isDisabled={blocked||!consent||!data.transportAvailable} onClick={()=>void act('request_feedback',{sessionId:s.id,expectedRevision:s.revision,attemptId:a.id,modelConsent:true})}/>}
   </article>)}
  </section>}
 </div>;
}
