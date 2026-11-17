'use client';
import {useCallback,useEffect,useRef,useState} from 'react';
import {Button} from '@astryxdesign/core/Button';
import {Selector} from '@astryxdesign/core/Selector';
import {Check,Download,FileCheck2,Play,RefreshCw,Send,ShieldCheck,Undo2,X,ArrowLeft,ArrowRight,ExternalLink} from 'lucide-react';
import {type WorkspaceApi,errorMessage} from './api';
import {Banner,EmptyState,Glyph,Pill,ToolButton,formatDate} from './shared';
import {LifecycleActionDialog} from './lifecycle-action';
import {PacketEvidenceForm,PostingPolicyForm,PostingDetailsForm} from './lifecycle-forms';
import type {Fact,LifecycleAction,LifecycleData,Packet} from './lifecycle-types';
import {LegacyMigrationView} from './migration';

export function ApplicationWorkbench({api,disabled,refresh,asOf,selectedId,onSelect,hasModel,isOwner}:{api:WorkspaceApi;disabled:boolean;refresh:()=>Promise<void>;asOf:string;selectedId:string|null;onSelect:(id:string)=>void;hasModel:boolean;isOwner:boolean}){
 const [data,setData]=useState<LifecycleData|null>(null),[facts,setFacts]=useState<Fact[]>([]),[error,setError]=useState(''),[readError,setReadError]=useState(''),[busy,setBusy]=useState(false),[tab,setTab]=useState('lifecycle');
 const [action,setAction]=useState<LifecycleAction|null>(null),[inspected,setInspected]=useState<Packet|null>(null);
 const [offset,setOffset]=useState(0);
 const sequence=useRef(0),active=useRef(false),attempts=useRef(new Map<string,string>());
 const load=useCallback(async()=>{const n=++sequence.current;try{
  const d=await api.get<LifecycleData>('/api/applications?offset='+offset+(selectedId?'&application='+selectedId:'')),c=await api.get<{facts:Fact[]}>('/api/candidate');
  if(n===sequence.current){setData(d);setFacts(c.facts);setReadError('');}
 }catch(e){if(n===sequence.current)setReadError(errorMessage(e));}},[api,offset,selectedId]);
 useEffect(()=>{void load();return()=>{sequence.current++;};},[load,asOf]);
 const running=Boolean(data?.work.some(w=>['queued','leased'].includes(w.status)&&['evaluate_job','build_packet'].includes(w.kind)));
 useEffect(()=>{if(!running)return;let cancelled=false,timer:ReturnType<typeof setTimeout>|undefined,release:(()=>void)|undefined;
  void(async()=>{for(let i=0;i<60&&!cancelled;i++){await new Promise<void>(r=>{release=r;timer=setTimeout(r,2000);});if(!cancelled&&!document.hidden&&navigator.onLine)await load();}})();
  return()=>{cancelled=true;if(timer)clearTimeout(timer);release?.();};
 },[load,running]);
 const blocked=disabled||Boolean(readError)||busy;
 async function mutate(endpoint:string,name:string,payload:unknown){
  if(blocked||active.current)return false;active.current=true;setBusy(true);setError('');
  const key=JSON.stringify({endpoint,name,payload}),id=attempts.current.get(key)||crypto.randomUUID();attempts.current.set(key,id);let acknowledged=false;
  try{await api.post('/api/'+endpoint+'/commands',{commandId:id,action:name,payload});acknowledged=true;attempts.current.delete(key);await load();await refresh();return true;}
  catch(e){setError((acknowledged?'Action recorded, but refresh failed. ':'')+errorMessage(e));await load();return false;}
  finally{active.current=false;setBusy(false);}
 }
 if(!data)return <section className="knowledge-view lifecycle-workbench" aria-label="Application workspace">{readError?<EmptyState icon={FileCheck2} title="Applications unavailable" detail={readError} action={<Button label="Retry" icon={<Glyph icon={RefreshCw}/>} onClick={()=>void load()}/>}/>:<p role="status">Loading application workspace</p>}</section>;
 const app=selectedId?data.applications.find(a=>a.id===selectedId):data.applications[0];
 const evaluations=app?data.evaluations.filter(e=>e.job_id===app.job_id):[],latest=evaluations[0],current=evaluations.find(e=>e.current);
 const packets=app?data.packets.filter(p=>p.application_id===app.id):[],approved=packets.find(p=>p.status==='approved'&&p.current),draft=packets.find(p=>p.status==='draft'&&p.current);
 const frozen=data.authority.owner==='staging'||data.authority.owner==='legacy'&&Boolean(data.authority.transition_id),locked=blocked||frozen;
 const review=data.reviews.find(r=>r.job_id===app?.job_id),override=data.overrides.some(o=>o.application_id===app?.id&&o.evaluation_id===current?.id&&!o.revoked_at);
 const work=data.work.filter(w=>w.application_id===app?.id||evaluations.some(e=>e.id===w.evaluation_id)),pending=work.some(w=>['queued','leased'].includes(w.status));
 const open=(kind:LifecycleAction,packet?:Packet)=>{setError('');setAction(kind);setInspected(packet||approved||null);};
 return <section className="knowledge-view lifecycle-workbench" aria-label="Application workspace">
  <div className="knowledge-toolbar"><Selector label="Application workspace view" isLabelHidden value={tab} onChange={setTab} width={220} options={[{value:'lifecycle',label:'Application lifecycle'},...(isOwner?[{value:'migration',label:'Legacy migration'}]:[])]}/><ToolButton label="Refresh applications" icon={RefreshCw} onClick={()=>void load()} disabled={disabled}/></div>
  {readError&&<Banner>{readError} Showing last loaded records.</Banner>}{error&&<Banner onDismiss={()=>setError('')}>{error}</Banner>}
  <div className="inline-actions"><ToolButton label="Previous applications" icon={ArrowLeft} disabled={blocked||offset===0} onClick={()=>{setOffset(Math.max(0,offset-50));onSelect('');}}/><span className="small muted">{data.applications.length?'Applications '+(offset+1)+'-'+(offset+Math.min(50,data.applications.length)):'No applications'}</span><ToolButton label="Next applications" icon={ArrowRight} disabled={blocked||data.nextOffset===null} onClick={()=>{setOffset(data.nextOffset!);onSelect('');}}/></div>
  {data.partial&&<Banner tone="warning">Application pages contain 50 records; history is limited to the recent 200 selected-page records.</Banner>}
  {tab==='migration'?<LegacyMigrationView api={api} disabled={blocked} refresh={refresh} asOf={asOf}/>:!app?<EmptyState icon={Send} title="No application intents" detail="No submission is recorded."/>:<>
   <div className="lifecycle-selector"><Selector label="Application" value={app.id} onChange={id=>{setAction(null);onSelect(id);}} width="100%" options={data.applications.map(a=>({value:a.id,label:a.company+' / '+a.title}))}/></div>
   {frozen&&<Banner tone="warning">{data.authority.owner==='staging'?'Application ownership is staged. Finish or recover the reviewed migration.':'Legacy writers own applications after rollback. Review a new migration before editing here.'}</Banner>}
   {data.authority.owner==='legacy'&&!data.authority.transition_id&&<Banner tone="info">This workspace is isolated from the legacy tracker. Application authority has not been switched.</Banner>}
   <div className="knowledge-summary lifecycle-summary"><div><span>Career-Ops score</span><strong>{current?.score?current.score+'/5':'Unknown'}</strong></div><div><span>Maxim tier</span><strong>{current?.tier||'Unknown'}</strong></div><div><span>Workflow</span><strong>{app.workflow.replaceAll('_',' ')}</strong></div><div><span>Outcome</span><strong>{app.outcome.replaceAll('_',' ')}</strong></div></div>
   <section className="knowledge-section" aria-label="Career-Ops evaluation">
    <div className="fact-title"><h3>Career-Ops evaluation</h3><Pill tone={current?'green':'amber'}>{current?'Current':latest?latest.status.replaceAll('_',' '):'Not evaluated'}</Pill></div>
    {data.candidate.ownership!=='canonical'&&<Banner tone="warning">Review and activate Candidate knowledge before evaluation.</Banner>}
    {!hasModel&&<Banner tone="info">Evaluation model is not configured in Settings.</Banner>}
    {!app.description||app.description.length<50?<Banner tone="warning">A full job description is required before evaluation.</Banner>:<details className="lifecycle-details"><summary>Posting evidence</summary><pre className="posting-evidence">{app.description}</pre></details>}
    <div className="inline-actions"><Button label="Evaluate with Career-Ops" variant="primary" icon={<Glyph icon={FileCheck2}/>} isDisabled={locked||pending||!hasModel||data.candidate.ownership!=='canonical'||app.description.length<50||app.status==='archived'} onClick={()=>void mutate('evaluations','start_evaluation',{jobId:app.job_id,expectedJobRevision:app.job_revision,expectedCandidateRevision:data.candidate.revision})}/>
     {latest&&['queued','running'].includes(latest.status)&&<ToolButton label="Cancel evaluation" icon={X} disabled={locked} onClick={()=>void mutate('evaluations','cancel_evaluation',{evaluationId:latest.id,expectedRevision:latest.revision})}/>}
     {latest?.report_artifact_id&&<a className="text-link" href={'/api/artifacts/'+latest.report_artifact_id} target="_blank" rel="noreferrer"><Download size={14}/> Full report</a>}
    </div>
    {latest?.error_code&&<Banner tone="warning">Evaluation held: {latest.error_code.replaceAll('_',' ')}</Banner>}
    {latest?.explanation&&<details className="lifecycle-details"><summary>Evaluation explanation</summary><pre className="posting-evidence">{latest.explanation}</pre></details>}
    {current&&<div className="lifecycle-policy"><Pill tone={current.policy.eligibility==='eligible'?'green':'amber'}>{current.policy.eligibility||'Review required'}</Pill><span className="small muted">Liveness: {current.liveness}</span><ul>{current.policy.flags?.map((f,i)=><li key={i}>{f.reason}</li>)}</ul></div>}
    <PostingDetailsForm key={app.id+':'+app.job_revision} app={app} blocked={locked} mutate={mutate}/>
    <PostingPolicyForm key={app.id+':'+(review?.revision||0)+':'+app.job_revision} app={app} review={review} blocked={locked} mutate={mutate}/>
    {current?.tier==='T1'&&<Button label={override?'Revoke T1 override':'Record strategic override'} icon={<Glyph icon={override?Undo2:ShieldCheck}/>} onClick={()=>open(override?'revoke_override':'override')} isDisabled={locked}/>}
    {current&&Number(current.score)>=3&&<PacketEvidenceForm key={app.id+':'+current.id+':'+data.candidate.revision} app={app} evaluation={current} facts={facts} blocked={locked||pending||app.status==='archived'} mutate={mutate}/>}
   </section>
   <section className="knowledge-section" aria-label="Application packets"><div className="fact-title"><h3>Application packet</h3><Pill tone={approved?'green':'amber'}>{approved?'Approved':draft?'Draft review required':'Not ready'}</Pill></div>
    {!packets.length&&<p className="small muted">No report/PDF packet is approved.</p>}
    {packets.map(p=><article className="packet-row" key={p.id}><div className="fact-title"><strong>{formatDate(p.created_at,true)}</strong><Pill tone={p.status==='approved'&&p.current?'green':'amber'}>{!p.current?'Stale':p.status}</Pill></div><p className="small muted">{p.untailored?'Untailored resume':'Reviewed fact selection'} · candidate revision {p.candidate_revision} · posting revision {p.job_revision}</p><div className="inline-actions">
     <a href={'/api/artifacts/'+p.report_artifact_id} target="_blank" rel="noreferrer" className="text-link"><Download size={14}/> Report</a><a href={'/api/artifacts/'+p.pdf_artifact_id} target="_blank" rel="noreferrer" className="text-link"><Download size={14}/> PDF</a>
     {p.status==='draft'&&<Button label="Review packet" size="sm" icon={<Glyph icon={Check}/>} onClick={()=>open('approve',p)} isDisabled={locked||!p.current}/>}
     {p.status==='approved'&&<ToolButton label="Revoke packet" icon={Undo2} onClick={()=>open('revoke',p)} disabled={locked}/>}
    </div></article>)}
   </section>
   <section className="knowledge-section" aria-label="Manual application progress"><h3>Application progress</h3><div className="inline-actions">
    {app.url&&<a href={app.url} target="_blank" rel="noreferrer" className="text-link"><ExternalLink size={14}/> Open posting</a>}
    <Button label="Record manual start" icon={<Glyph icon={Play}/>} onClick={()=>open('started')} isDisabled={locked||!approved||app.status==='archived'||app.outcome!=='not_submitted'}/>
    <Button label="Record form review" icon={<Glyph icon={Check}/>} onClick={()=>open('reviewed')} isDisabled={locked||!approved||app.status==='archived'||app.outcome!=='not_submitted'}/>
    <Button label="Record submission" icon={<Glyph icon={Send}/>} onClick={()=>open('submission')} isDisabled={locked}/>
    <Button label="Record outcome" onClick={()=>open('outcome')} isDisabled={locked}/>
   </div><dl className="packet-binding"><dt>Filled form</dt><dd>{app.filled_at?formatDate(app.filled_at,true):'Not recorded'}</dd><dt>Reviewed</dt><dd>{app.reviewed_at?formatDate(app.reviewed_at,true):'Not recorded'}</dd><dt>Submitted</dt><dd>{app.applied_at?formatDate(app.applied_at,true):'Not recorded'}</dd></dl></section>
   {work.length>0&&<details className="lifecycle-details"><summary>Durable work</summary>{work.map(w=><p className="small" key={w.id}>{w.kind.replaceAll('_',' ')} · {w.result?.status||w.status}{(w.error_code||w.result?.error)&&' · '+(w.error_code||w.result?.error)?.replaceAll('_',' ')}</p>)}</details>}
   <details className="lifecycle-details"><summary>Application history</summary>{data.actions.filter(a=>a.application_id===app.id).map(a=><div className="application-history-row" key={a.id}><strong>{a.event_type.replaceAll('_',' ')}</strong><span>{formatDate(a.created_at,true)}</span><p>{a.reason}</p><details><summary>Action-time evidence</summary><pre className="posting-evidence">{JSON.stringify(a.snapshot,null,2)}</pre></details></div>)}</details>
   {action&&<LifecycleActionDialog key={action+':'+(inspected?.id||app.id)} kind={action} app={app} evaluation={current} packet={inspected||undefined} duplicate={data.duplicates[app.id]} busy={busy} error={error} onClose={()=>setAction(null)} onSubmit={mutate}/>}
  </>}
 </section>;
}
