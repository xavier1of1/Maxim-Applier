'use client';
import {useEffect,useRef,useState} from 'react';
import {Button} from '@astryxdesign/core/Button';
import {Selector} from '@astryxdesign/core/Selector';
import {TextInput} from '@astryxdesign/core/TextInput';
import {TextArea} from '@astryxdesign/core/TextArea';
import {Dialog,DialogHeader} from '@astryxdesign/core/Dialog';
import {ArrowLeft,ArrowRight,Check,Download,RefreshCw,Upload} from 'lucide-react';
import {errorMessage,type WorkspaceApi} from './api';
import {Banner,Glyph,Pill,ToolButton,formatDate} from './shared';

type Import={id:string;revision:number;status:string;contentHash:string;created_at:string;report:{unresolved:number;issues:unknown[];counts:Record<string,number>}};
type RecordRow={id:string;source_key:string;raw_fields:unknown;normalized:{company?:string;title?:string;rawStatus?:string;suggestedJobIds?:string[];priorMap?:{job_id:string}};conflicts:string[];resolution:unknown};
type View={imports:Import[];records:RecordRow[];importId:string;offset:number;total:number;nextOffset:number|null};
type Authority={authority:{owner:string;revision:number;transition_id:string|null};transitions:{id:string;status:string;created_at:string;manifest:{projectionHash:string;counts:Record<string,number>}}[];marker:{applicationAsOf?:string}};

export function LegacyMigrationView({api,disabled,refresh}:{api:WorkspaceApi;disabled:boolean;refresh:()=>Promise<void>;asOf:string}){
 const [data,setData]=useState<View|null>(null),[authority,setAuthority]=useState<Authority|null>(null),[selected,setSelected]=useState(''),[offset,setOffset]=useState(0),[error,setError]=useState(''),[busy,setBusy]=useState(false),[confirmed,setConfirmed]=useState(false),[issues,setIssues]=useState(false),[reason,setReason]=useState(''),[record,setRecord]=useState<RecordRow|null>(null),[transition,setTransition]=useState('');
 const sequence=useRef(0),active=useRef(false),attempts=useRef(new Map<string,string>());
 async function load(){
  const ticket=++sequence.current;
  try{const [d,a]=await Promise.all([api.get<View>('/api/legacy?offset='+offset+(selected?'&import='+selected:'')),api.get<Authority>('/api/applications/authority')]);if(ticket===sequence.current){setData(d);setAuthority(a);}}
  catch(e){if(ticket===sequence.current)setError(errorMessage(e));}
 }
 useEffect(()=>{void load();return()=>{sequence.current++;};},[selected,offset]);
 async function mutate(endpoint:string,body:Record<string,unknown>){
  if(disabled||active.current)return false;
  active.current=true;setBusy(true);setError('');
  const key=JSON.stringify({endpoint,body}),id=attempts.current.get(key)||crypto.randomUUID();attempts.current.set(key,id);
  try{const r=await api.post<{result:{id:string}}>('/api/'+endpoint,{commandId:id,...body});attempts.current.delete(key);if(body.action==='stage_native'){setSelected(r.result.id);setOffset(0);}await load();await refresh();setConfirmed(false);return true;}
  catch(e){setError(errorMessage(e));await load();return false;}
  finally{active.current=false;setBusy(false);}
 }
 const imp=data?.imports.find(i=>i.id===data.importId),owner=authority?.authority.owner,locked=disabled||busy,why=reason.trim().length>=3;
 const t=authority?.transitions.find(t=>t.id===(transition||authority.authority.transition_id));
 async function cutover(action:string){
  if(!authority)return;
  await mutate('applications/cutover',{action,expectedRevision:authority.authority.revision,confirmed:true,reason,...(action==='prepare'?{importId:imp?.id}:{transitionId:t?.id,...(action==='activate'?{projectionHash:t?.manifest.projectionHash}:{})})});
 }
 return <section className="knowledge-section migration-view" aria-label="Legacy migration">
  <div className="fact-title"><h3>Application ownership</h3><Pill tone={owner==='canonical'?'green':'amber'}>{owner||'Unavailable'}</Pill><ToolButton label="Refresh migration" icon={RefreshCw} onClick={()=>void load()} disabled={locked}/></div>
  {error&&<Banner onDismiss={()=>setError('')}>{error}</Banner>}
  {authority&&<p className="small muted">Revision {authority.authority.revision} · projection {authority.marker.applicationAsOf?formatDate(authority.marker.applicationAsOf,true):'not published'}</p>}
  <label className="binary-option"><input type="checkbox" checked={confirmed} onChange={e=>setConfirmed(e.target.checked)} disabled={locked}/>I reviewed and authorize the selected local operation.</label>
  <Button label="Capture native trackers for review" icon={<Glyph icon={Upload}/>} isDisabled={locked||!confirmed||owner!=='legacy'} onClick={()=>void mutate('legacy/commands',{action:'stage_native',payload:{confirmedLocalRead:true}})}/>
  {data&&<><Selector label="Reviewed source capture" value={data.importId||''} onChange={id=>{setSelected(id);setOffset(0);setIssues(false);setConfirmed(false);}} width="100%" options={data.imports.map(i=>({value:i.id,label:formatDate(i.created_at,true)+' / '+i.status+' / '+i.contentHash.slice(0,12)}))}/>
   {imp&&<><dl className="packet-binding"><dt>Source SHA-256</dt><dd><code>{imp.contentHash}</code></dd><dt>Records / unresolved</dt><dd>{data.total} / {imp.report.unresolved}</dd></dl>
    <a href={'/api/legacy/export/'+imp.id} className="text-link"><Download size={14}/> Raw capture JSON</a>
    <details><summary>Raw source issues ({imp.report.issues.length})</summary><pre className="posting-evidence">{JSON.stringify(imp.report.issues,null,2)}</pre></details>
    <div className="table-scroll"><table className="migration-table"><thead><tr><th>Source identity</th><th>Normalized role</th><th>Raw status</th><th>Review</th></tr></thead><tbody>{data.records.map(r=><tr key={r.id}><td><code>{r.source_key}</code></td><td>{r.normalized.company||'Missing company'}<br/>{r.normalized.title||'Missing role'}</td><td>{r.normalized.rawStatus||'Unknown'}{r.conflicts.length>0&&<Pill tone="amber">{r.conflicts.length} issues</Pill>}</td><td><Button label={r.resolution?'Reviewed':'Review record'} size="sm" onClick={()=>{setError('');setRecord(r);}} isDisabled={locked||imp.status==='imported'||owner!=='legacy'}/></td></tr>)}</tbody></table></div>
    <div className="inline-actions"><ToolButton label="Previous records" icon={ArrowLeft} onClick={()=>setOffset(Math.max(0,offset-50))} disabled={locked||offset===0}/><span className="small">{data.total?offset+1:0}–{offset+data.records.length} of {data.total}</span><ToolButton label="Next records" icon={ArrowRight} onClick={()=>setOffset(data.nextOffset!)} disabled={locked||data.nextOffset===null}/></div>
    <label className="binary-option"><input type="checkbox" checked={issues} onChange={e=>setIssues(e.target.checked)} disabled={locked}/>I reviewed the raw-only source issues.</label>
    <TextArea label="Migration / ownership reason" value={reason} onChange={setReason} rows={2} isDisabled={locked}/>
    <div className="inline-actions"><Button label="Commit reviewed import" icon={<Glyph icon={Check}/>} isDisabled={locked||!why||!confirmed||imp.status==='imported'||imp.report.unresolved>0||imp.report.issues.length>0&&!issues||owner!=='legacy'} onClick={()=>void mutate('legacy/commands',{action:'commit_import',payload:{importId:imp.id,expectedRevision:imp.revision,contentHash:imp.contentHash,confirmed:true,acknowledgeRawIssues:issues,reason}})}/>
     <Button label="Prepare ownership switch" isDisabled={locked||!confirmed||!why||owner!=='legacy'||imp.status!=='imported'} onClick={()=>void cutover('prepare')}/></div>
   </>}
  </>}
  {authority&&authority.transitions.length>0&&<><Selector label="Ownership transition" value={t?.id||''} onChange={id=>{setTransition(id);setConfirmed(false);}} width="100%" options={authority.transitions.map(t=>({value:t.id,label:t.status+' / '+formatDate(t.created_at,true)}))}/>
   {t&&<><dl className="packet-binding"><dt>Reviewed projection SHA-256</dt><dd><code>{t.manifest.projectionHash}</code></dd></dl><pre className="posting-evidence">{JSON.stringify(t.manifest.counts,null,2)}</pre>
    {!imp&&<TextArea label="Migration / ownership reason" value={reason} onChange={setReason} rows={2} isDisabled={locked}/>}
    <div className="inline-actions"><Button label="Activate canonical applications" variant="primary" isDisabled={locked||!why||!confirmed||owner!=='staging'||t.id!==authority.authority.transition_id} onClick={()=>void cutover('activate')}/>
     <Button label="Recover publication" isDisabled={locked||!why||!confirmed||t.id!==authority.authority.transition_id} onClick={()=>void cutover('recover')}/>
     <Button label="Roll back ownership" variant="destructive" isDisabled={locked||!why||!confirmed||owner!=='canonical'||t.id!==authority.authority.transition_id} onClick={()=>void cutover('rollback')}/></div>
   </>}
  </>}
  {record&&imp&&<RecordDialog key={record.id} row={record} busy={busy} error={error} onClose={()=>{if(!busy)setRecord(null);}} onSubmit={async p=>{if(await mutate('legacy/commands',{action:'resolve_record',payload:{...p,recordId:record.id,importId:imp.id,expectedRevision:imp.revision}}))setRecord(null);}}/>}
 </section>;
}
function RecordDialog({row,busy,error,onClose,onSubmit}:{row:RecordRow;busy:boolean;error:string;onClose:()=>void;onSubmit:(p:Record<string,unknown>)=>Promise<void>}){
 const prior=row.normalized.priorMap?.job_id;
 const [mode,setMode]=useState(prior?'link_existing':'preserve_only'),[job,setJob]=useState(prior||row.normalized.suggestedJobIds?.[0]||''),[company,setCompany]=useState(row.normalized.company||''),[title,setTitle]=useState(row.normalized.title||''),[outcome,setOutcome]=useState('unknown'),[reason,setReason]=useState('');
 return <Dialog isOpen onOpenChange={v=>{if(!v&&!busy)onClose();}} purpose="form" width={720}><DialogHeader title="Reconcile legacy record" onOpenChange={onClose}/><form className="dialog-form" onSubmit={e=>{e.preventDefault();void onSubmit({resolution:mode,...(mode==='link_existing'?{jobId:job}:{}),company:company||undefined,title:title||undefined,outcome,reason});}}>
  {error&&<Banner>{error}</Banner>}
  <code className="source-identity">{row.source_key}</code>
  <details open><summary>Exact raw fields</summary><pre className="posting-evidence">{JSON.stringify(row.raw_fields,null,2)}</pre></details>
  <details><summary>Normalization and conflicts</summary><pre className="posting-evidence">{JSON.stringify({normalized:row.normalized,conflicts:row.conflicts},null,2)}</pre></details>
  <Selector label="Resolution" value={mode} onChange={setMode} options={[{value:'preserve_only',label:'Preserve raw only'},{value:'link_existing',label:'Link exact existing opening'},...(!prior?[{value:'new_opening',label:'Create distinct opening'}]:[])]}/>
  {mode==='link_existing'&&<TextInput label="Exact existing job UUID" value={job} onChange={setJob} isRequired isDisabled={busy}/>}
  {mode==='new_opening'&&<><TextInput label="Reviewed company" value={company} onChange={setCompany} isRequired isDisabled={busy}/><TextInput label="Reviewed role" value={title} onChange={setTitle} isRequired isDisabled={busy}/></>}
  {mode!=='preserve_only'&&<Selector label="Reviewed historical outcome" value={outcome} onChange={setOutcome} options={['unknown','not_submitted','submitted','responded','interviewing','offer','rejected','withdrawn'].map(value=>({value,label:value.replaceAll('_',' ')}))}/>}
  <TextArea label="Resolution reason" value={reason} onChange={setReason} rows={2} isRequired isDisabled={busy}/>
  <div className="dialog-actions"><Button label="Cancel" onClick={onClose} isDisabled={busy}/><Button label="Record reviewed resolution" type="submit" variant="primary" isDisabled={busy||reason.trim().length<3||mode==='link_existing'&&!/^[a-f0-9-]{36}$/i.test(job)||mode==='new_opening'&&(!company||!title)}/></div>
 </form></Dialog>;
}
