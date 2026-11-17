'use client';
import {useCallback,useEffect,useRef,useState,type FormEvent} from 'react';
import {Button} from '@astryxdesign/core/Button';
import {TextInput} from '@astryxdesign/core/TextInput';
import {TextArea} from '@astryxdesign/core/TextArea';
import {NumberInput} from '@astryxdesign/core/NumberInput';
import {Selector} from '@astryxdesign/core/Selector';
import {Dialog,DialogHeader} from '@astryxdesign/core/Dialog';
import {Check,CheckCheck,FileText,Upload,Plus,RefreshCw,Trash2,Pencil,ShieldCheck,Download,X,RotateCcw,UserCheck,FolderSync,Square} from 'lucide-react';
import {type WorkspaceApi,errorMessage} from './api';
import {Banner,EmptyState,Glyph,Pill,ToolButton,formatDate} from './shared';
import type {Navigation} from './types';

type Fact={id:string;field_key:string;value:unknown;revision:number;source_id:string;sensitivity:string;status?:string};
type Proposal={id:string;source_id:string;source_revision:number;field_key:string;value:unknown;quote:string;revision:number;expected_fact_revision:number;current_fact_revision:number|null;current_value:unknown};
type Source={id:string;artifact_id:string|null;name:string;revision:number;format:string;status:string;model_consent:boolean;raw_available:boolean;extraction_error:string|null;retention_days:number;deleted_at:string|null};
type CandidateData={candidate:{id:string;revision:number;ownership:string};facts:Fact[];withdrawnFacts:Fact[];sources:Source[];proposals:Proposal[];work:{id:string;source_id:string|null;status:string;attempts:number;error_code:string|null}[];worker:{available:boolean};asOf:string};
type Authority={candidate:{revision:number;ownership:string};transitions:{id:string;status:string;candidate_revision:number;manifest:unknown}[];projection:{candidate?:string;candidateRevision?:number}|null};
type Preview={revision:number;files:Record<string,string>;factCount:number;disclosedCount:number;transitionId:string;mode:'activate'|'rollback'};
const display=(value:unknown)=>typeof value==='string'?value:JSON.stringify(value);
const hasConflict=(p:Proposal)=>p.expected_fact_revision!==(p.current_fact_revision||0)||
 p.current_fact_revision!==null&&JSON.stringify(p.value)!==JSON.stringify(p.current_value);
const fields=[
 ['candidate.name','Full name'],['candidate.email','Email'],['candidate.phone','Phone'],['candidate.location','Current location'],
 ['candidate.linkedin','LinkedIn'],['candidate.github','GitHub'],['candidate.portfolio','Portfolio'],
 ['positioning.headline','Professional headline'],['preferences.roles','Target roles'],['preferences.locations','Target locations'],
 ['authorization.us_citizen','U.S. citizen'],['authorization.requires_sponsorship','Requires sponsorship'],
 ['authorization.active_clearance','Active clearance'],['authorization.eligible_to_obtain_clearance','Eligible to obtain clearance'],
 ['authorization.willing_to_obtain_clearance','Willing to obtain clearance'],['skills.languages','Languages and tools'],['custom','Custom field'],
].map(([value,label])=>({value,label}));
const label=(key:string)=>fields.find(f=>f.value===key)?.label||key;
export function CandidateView({api,disabled,refresh,navigate,sourceId,asOf,isOwner}:{
 api:WorkspaceApi;disabled:boolean;refresh:()=>Promise<void>;navigate:(value:Navigation)=>void;sourceId:string|null;asOf:string;isOwner:boolean;
}){
 const [data,setData]=useState<CandidateData|null>(null),[authority,setAuthority]=useState<Authority|null>(null);
 const [readError,setReadError]=useState(''),[error,setError]=useState(''),[busy,setBusy]=useState('');
 const [tab,setTab]=useState('review'),[manual,setManual]=useState<Fact|'new'|null>(null),[review,setReview]=useState<Proposal|null>(null);
 const [sourceText,setSourceText]=useState(''),[preview,setPreview]=useState<Preview|null>(null),[approved,setApproved]=useState(false);
 const [remove,setRemove]=useState<Source|null>(null),[classification,setClassification]=useState('personal'),[consent,setConsent]=useState(false);
 const [disclose,setDisclose]=useState<Source|null>(null);
 const [retention,setRetention]=useState('30'),[pulse,setPulse]=useState(0);
 const input=useRef<HTMLInputElement>(null),sequence=useRef(0);
 const load=useCallback(async()=>{
  const request=++sequence.current;
  try{
   const next=await api.get<CandidateData>('/api/candidate'),owner=await api.get<Authority>('/api/candidate/authority');
   if(request===sequence.current){setData(next);setAuthority(owner);setReadError('');}
  }catch(e){if(request===sequence.current)setReadError(errorMessage(e));}
 },[api]);
 useEffect(()=>{void load();return()=>{sequence.current++;};},[load,asOf]);
 const pending=data?.sources.filter(s=>['queued','running'].includes(s.status)).map(s=>s.id+':'+s.status).join(',')||'';
 useEffect(()=>{
  if(!pending)return;
  let count=0,timer:ReturnType<typeof setTimeout>,cancelled=false;
  const poll=async()=>{if(cancelled||count++>=90)return;await load();if(!cancelled)timer=setTimeout(poll,2000);};
  timer=setTimeout(poll,2000);return()=>{cancelled=true;clearTimeout(timer);};
 },[pending,load,pulse]);
 useEffect(()=>{
  if(!sourceId){setSourceText('');return;}
  const controller=new AbortController();
  void api.get<{source:{extracted_text:string|null;name:string}}>('/api/sources/'+sourceId,controller.signal)
   .then(result=>setSourceText(result.source.extracted_text||'No extracted text is currently retained.'))
   .catch(e=>{if(!controller.signal.aborted)setError(errorMessage(e));});
  return()=>controller.abort();
 },[sourceId,api,data?.asOf]);
 const blocked=disabled||Boolean(readError)||Boolean(busy);
 const act=async(name:string,operation:()=>Promise<unknown>)=>{
  if(blocked)return;setBusy(name);setError('');
  try{await operation();await load();await refresh();}
  catch(e){setError(errorMessage(e));await load();}
  finally{setBusy('');}
 };
 const command=(action:string,payload:unknown)=>api.post('/api/candidate/commands',{commandId:crypto.randomUUID(),action,payload});
 async function upload(file:File|undefined){
  if(!file||blocked)return;
  if(!retention.trim()||!Number.isInteger(Number(retention))||Number(retention)<1||Number(retention)>365){setError('Choose raw retention from 1 to 365 days.');return;}
  const form=new FormData();form.set('commandId',crypto.randomUUID());form.set('file',file);
  form.set('classification',classification);form.set('modelConsent',String(consent));form.set('retentionDays',retention);
  await act('upload',async()=>{await api.upload(form,'/api/sources');setTab('sources');setPulse(p=>p+1);});
  if(input.current)input.current.value='';
 }
 async function prepare(){
  await act('prepare',async()=>{
   const next=await api.get<Omit<Preview,'transitionId'|'mode'>>('/api/candidate/projection');
   const result=await api.post<{result:{id:string}}>('/api/candidate/cutover',{commandId:crypto.randomUUID(),action:'prepare',expectedRevision:next.revision});
   setPreview({...next,transitionId:result.result.id,mode:'activate'});setApproved(false);
  });
 }
 if(!data)return <div className="knowledge-view">{readError?<EmptyState icon={UserCheck} title="Candidate unavailable" detail={readError}
  action={<Button label="Retry" onClick={()=>void load()} icon={<Glyph icon={RefreshCw}/>}/>}/>:<p role="status">Loading candidate knowledge</p>}</div>;
 const currentSource=data.sources.find(s=>s.id===sourceId);
 const owner=authority?.candidate.ownership||data.candidate.ownership;
 const active=authority?.transitions.find(t=>t.status==='active'),staging=authority?.transitions.find(t=>t.status==='staging');
 return <div className="knowledge-view">
  {readError&&<Banner>{readError} Showing last loaded knowledge. <button className="text-link" onClick={()=>void load()}>Retry</button></Banner>}
  {error&&<Banner onDismiss={()=>setError('')}>{error}</Banner>}
  <div className="knowledge-summary"><div><span>Confirmed fields</span><strong>{data.facts.length}</strong></div>
   <div><span>Pending review</span><strong>{data.proposals.length}</strong></div><div><span>Sources</span><strong>{data.sources.filter(s=>!s.deleted_at).length}</strong></div>
   <div><span>Authority</span><Pill tone={owner==='canonical'?'green':'amber'}>{owner==='canonical'?'Canonical':'Staged / legacy active'}</Pill></div></div>
  <div className="knowledge-toolbar"><Selector label="Knowledge view" isLabelHidden value={tab} onChange={setTab} width={210} options={[
   {value:'review',label:'Review proposals'},{value:'facts',label:'Confirmed knowledge'},{value:'sources',label:'Sources'},{value:'authority',label:'Career-Ops authority'}]}/>
   <div className="inline-actions"><Button label="Add fact" icon={<Glyph icon={Plus}/>} onClick={()=>setManual('new')} isDisabled={blocked}/>
    <ToolButton label="Refresh candidate" icon={RefreshCw} onClick={()=>{setPulse(p=>p+1);void load();}} busy={Boolean(busy)} disabled={disabled}/></div></div>
  {tab==='review'&&<section aria-label="Candidate proposals" className="knowledge-section">
   {data.proposals.length?data.proposals.map(p=><article className="fact-proposal" key={p.id}>
    <div className="fact-title"><strong>{label(p.field_key)}</strong><Pill tone={hasConflict(p)?'coral':'amber'}>{hasConflict(p)?'Conflict':'Proposed'}</Pill></div>
    <p className="fact-value">{display(p.value)}</p><blockquote>{p.quote}</blockquote>
    <div className="fact-meta"><span>{data.sources.find(s=>s.id===p.source_id)?.name} / revision {p.source_revision}</span>
     <Button label="Review fact" size="sm" variant="secondary" onClick={()=>{setApproved(false);setReview(p);}} isDisabled={blocked}/></div>
   </article>):<EmptyState icon={CheckCheck} title="No pending fact reviews" detail={data.sources.length?'Current source proposals have been reviewed.':'No sources have been added.'}
    action={<Button label="Add source" icon={<Glyph icon={Upload}/>} onClick={()=>setTab('sources')}/>}/>}
  </section>}
  {tab==='facts'&&<section className="knowledge-section" aria-label="Confirmed candidate facts">
   {data.facts.length?<div className="fact-table">{data.facts.map(f=><div className="confirmed-fact" key={f.id}>
    <div><strong>{label(f.field_key)}</strong><span className="small muted">{f.field_key} / rev {f.revision}</span></div>
    <p className="fact-value">{display(f.value)}</p><div className="inline-actions"><Pill tone={f.sensitivity==='standard'?'green':'amber'}>{f.sensitivity}</Pill>
     <ToolButton label={'Correct '+label(f.field_key)} icon={Pencil} onClick={()=>setManual(f)} disabled={blocked}/>
     <ToolButton label={'Withdraw '+label(f.field_key)} icon={X} onClick={()=>void act('withdraw',()=>command('withdraw_fact',{factId:f.id,expectedRevision:f.revision,reason:'Explicit user withdrawal'}))} disabled={blocked}/></div>
   </div>)}</div>:<EmptyState icon={UserCheck} title="No confirmed fields" action={<Button label="Add fact" onClick={()=>setManual('new')} icon={<Glyph icon={Plus}/>}/>}/>}
   {data.withdrawnFacts.length>0&&<details className="withdrawn-facts"><summary>Withdrawn fields ({data.withdrawnFacts.length})</summary>
    {data.withdrawnFacts.map(f=><div className="fact-meta" key={f.id}><span>{label(f.field_key)} / rev {f.revision}</span><Button label="Review correction" variant="ghost" onClick={()=>setManual(f)}/></div>)}</details>}
  </section>}
  {tab==='sources'&&<section className="knowledge-section" aria-label="Candidate sources">
   <div className="intake-band"><div><h3>Source intake</h3><span className="small muted">PDF, DOCX, MD, TXT / 10 MB / 30 PDF pages</span></div>
    <div className="intake-options"><Selector label="Source classification" value={classification} onChange={setClassification} options={[{value:'personal',label:'Personal candidate material'},{value:'public',label:'Authorized public material'},{value:'restricted',label:'Restricted employer material'}]}/>
     <NumberInput label="Raw retention (days)" value={retention===''?null:Number(retention)} onChange={v=>setRetention(v===null?'':String(v))} hasClear min={1} max={365} isIntegerOnly width={150}/>
     <label className="binary-option"><input type="checkbox" checked={consent} onChange={e=>setConsent(e.target.checked)}/>Allow minimized, redacted model interpretation</label>
     <Button label="Upload source" icon={<Glyph icon={Upload}/>} onClick={()=>input.current?.click()} isDisabled={blocked} isLoading={busy==='upload'}/>
     <input className="visually-hidden" ref={input} type="file" accept=".pdf,.docx,.md,.txt" aria-label="Upload candidate source" onChange={e=>void upload(e.target.files?.[0])}/></div></div>
   {!data.worker.available&&pending&&<Banner tone="warning">Worker unavailable. Source work remains queued.</Banner>}
   <div className="source-workbench"><div className="source-list">
    {data.sources.map(s=><article className={'source-row'+(sourceId===s.id?' selected':'')} key={s.id}>
     <button className="text-link" type="button" onClick={()=>navigate({source:s.id})}><FileText size={15}/>{s.name}</button>
     <div className="fact-meta"><Pill tone={s.status==='approved'?'green':s.status==='failed'?'coral':'neutral'}>{s.status.replaceAll('_',' ')}</Pill><span>rev {s.revision}</span></div>
     {s.extraction_error&&<p className="small muted">{s.extraction_error.replaceAll('_',' ')}</p>}
     {!s.deleted_at&&<div className="source-actions">
      {s.raw_available&&s.artifact_id&&<a href={'/api/artifacts/'+s.artifact_id} download aria-label={'Download '+s.name} title="Download source"><Download size={15}/></a>}
      <ToolButton label={s.model_consent?'Revoke model consent':'Allow model consent'} icon={ShieldCheck} disabled={blocked}
       onClick={()=>s.model_consent?void act('consent',()=>command('source_consent',{sourceId:s.id,expectedRevision:s.revision,allow:false})):setDisclose(s)}/>
      {s.status==='failed'&&<ToolButton label={'Retry '+s.name} icon={RotateCcw} disabled={blocked} onClick={()=>void act('retry',()=>command('retry_source',{sourceId:s.id,expectedRevision:s.revision}))}/>}
      {data.work.filter(w=>w.source_id===s.id&&['queued','leased'].includes(w.status)).map(w=><ToolButton key={w.id} label={'Cancel '+s.name} icon={Square} disabled={blocked} onClick={()=>void act('cancel',()=>command('cancel_work',{workId:w.id}))}/>)}
      <ToolButton label={'Delete '+s.name} icon={Trash2} onClick={()=>setRemove(s)} disabled={blocked}/></div>}
    </article>)}
    {!data.sources.length&&<EmptyState compact icon={FileText} title="No sources yet"/>}</div>
    <div className="source-preview"><h3>{currentSource?.name||'Source preview'}</h3>{sourceId?<pre>{sourceText}</pre>:<EmptyState compact icon={FileText} title="No source selected"/>}</div></div>
  </section>}
  {tab==='authority'&&<section className="knowledge-section" aria-label="Career-Ops candidate authority">
   <h3>Candidate ownership</h3><div className="fact-meta"><Pill tone={owner==='canonical'?'green':'amber'}>{owner}</Pill><span>Candidate revision {data.candidate.revision}</span></div>
   <div className="authority-actions"><Button label="Import native sources" icon={<Glyph icon={FolderSync}/>} isDisabled={blocked||!isOwner} onClick={()=>void act('import',()=>api.post('/api/candidate/import-legacy',{commandId:crypto.randomUUID()}))}/>
    {owner!=='canonical'&&<Button label="Review cutover" variant="primary" icon={<Glyph icon={ShieldCheck}/>} isDisabled={blocked||!isOwner||!data.facts.length} onClick={()=>void prepare()}/>}
    {(active||staging)&&<Button label="Recover projections" icon={<Glyph icon={RefreshCw}/>} isDisabled={blocked||!isOwner}
     onClick={()=>void act('recover',()=>api.post('/api/candidate/cutover',{commandId:crypto.randomUUID(),action:'recover',transitionId:(active||staging)!.id,expectedRevision:data.candidate.revision}))}/>}
    {active&&owner==='canonical'&&<Button label="Review rollback" variant="secondary" icon={<Glyph icon={RotateCcw}/>} isDisabled={blocked||!isOwner} onClick={()=>{setApproved(false);setPreview({revision:data.candidate.revision,transitionId:active.id,files:{},factCount:data.facts.length,disclosedCount:0,mode:'rollback'});}}/>}</div>
   <div className="authority-status"><ShieldCheck size={18}/><span>{owner==='canonical'?'Native candidate files are generated projections.':'Native files remain active; confirmed workspace facts are staged.'}</span></div>
   <dl className="workspace-properties"><div><dt>Projection revision</dt><dd>{authority?.projection?.candidateRevision??'Not active'}</dd></div><div><dt>Worker</dt><dd>{data.worker.available?'Available':'Unavailable'}</dd></div></dl>
  </section>}
  {manual&&<ManualFactDialog key={manual==='new'?'new':manual.id} entry={manual} data={data} api={api} onClose={()=>setManual(null)}
   onSaved={async()=>{await load();await refresh();setManual(null);setTab('facts');}}/>}
  <Dialog isOpen={Boolean(review)} onOpenChange={v=>{if(!v&&!busy)setReview(null);}} purpose="form" width={660}>
   <DialogHeader title="Review candidate fact" onOpenChange={()=>setReview(null)}/>
   <div className="dialog-form">{error&&<Banner>{error}</Banner>}
    <div className="fact-title"><h3>{review&&label(review.field_key)}</h3><Pill tone="amber">Unapproved proposal</Pill></div>
    <div className="note-comparison"><h3>Source quotation</h3><pre>{review?.quote}</pre></div>
    <div className="note-comparison note-after"><h3>Proposed value</h3><pre>{review&&display(review.value)}</pre></div>
    {review&&review.current_fact_revision!==null&&<div className="note-comparison"><h3>Current value / rev {review.current_fact_revision}</h3><pre>{display(review.current_value)}</pre></div>}
    {review&&hasConflict(review)&&<label className="binary-option"><input type="checkbox" checked={approved} onChange={e=>setApproved(e.target.checked)}/>I reviewed the conflict and intend to replace the current value.</label>}
    <div className="dialog-actions"><Button label="Reject fact" variant="secondary" icon={<Glyph icon={X}/>} isDisabled={blocked} onClick={()=>review&&void act('reject',async()=>{await command('review_fact',{proposalId:review.id,expectedRevision:review.revision,expectedFactRevision:review.current_fact_revision||0,decision:'reject',reason:'Reviewed source; rejected proposal'});setReview(null);})}/>
     <Button label={review&&hasConflict(review)?'Replace confirmed value':'Confirm fact'} variant="primary" icon={<Glyph icon={Check}/>}
      isDisabled={blocked||Boolean(review&&hasConflict(review)&&!approved)}
      onClick={()=>review&&void act('approve',async()=>{await command('review_fact',{proposalId:review.id,expectedRevision:review.revision,expectedFactRevision:review.current_fact_revision||0,decision:hasConflict(review)?'replace':'approve',reason:'Explicitly reviewed source quotation and current value'});setReview(null);})}/></div>
   </div>
  </Dialog>
  <Dialog isOpen={Boolean(remove)} onOpenChange={v=>{if(!v&&!busy)setRemove(null);}} purpose="form" width={540}>
   <DialogHeader title="Delete candidate source?" onOpenChange={()=>setRemove(null)}/>
   <div className="dialog-form">{error&&<Banner>{error}</Banner>}<p>{remove?.name}</p>
    <p className="muted">Current source text, proposals and dependent facts will be withdrawn and erased. Existing private backups follow their separate retention policy.</p>
    <div className="dialog-actions"><Button label="Cancel" onClick={()=>setRemove(null)} isDisabled={blocked}/>
     <Button label="Delete source" variant="destructive" icon={<Glyph icon={Trash2}/>} isDisabled={blocked} onClick={()=>remove&&void act('delete',async()=>{await command('delete_source',{sourceId:remove.id,expectedRevision:remove.revision,reason:'Explicit user source erasure'});setRemove(null);navigate({source:null});})}/></div>
   </div>
  </Dialog>
  <Dialog isOpen={Boolean(disclose)} onOpenChange={v=>{if(!v&&!busy)setDisclose(null);}} purpose="form" width={540}>
   <DialogHeader title="Allow source disclosure?" onOpenChange={()=>setDisclose(null)}/>
   <div className="dialog-form">{error&&<Banner>{error}</Banner>}<p>{disclose?.name}</p>
    <p className="muted">Minimized, redacted text may be sent to your configured model for proposals. Confirmed standard facts from this source may enter future model context and Career-Ops projections. Private and sensitive fields remain withheld.</p>
    <div className="dialog-actions"><Button label="Cancel" onClick={()=>setDisclose(null)} isDisabled={blocked}/>
     <Button label="Allow disclosure" variant="primary" icon={<Glyph icon={ShieldCheck}/>} isDisabled={blocked} onClick={()=>disclose&&void act('consent',async()=>{await command('source_consent',{sourceId:disclose.id,expectedRevision:disclose.revision,allow:true});setDisclose(null);})}/></div>
   </div>
  </Dialog>
  <Dialog isOpen={Boolean(preview)} onOpenChange={v=>{if(!v&&!busy)setPreview(null);}} purpose="form" width={760}>
   <DialogHeader title={preview?.mode==='rollback'?'Review candidate rollback':'Review candidate cutover'} onOpenChange={()=>setPreview(null)}/>
   <div className="dialog-form">{error&&<Banner>{error}</Banner>}
    <div className="fact-meta"><span>Candidate revision {preview?.revision}</span><span>{preview?.factCount} confirmed fields</span></div>
    {preview?.mode==='rollback'?<Banner tone="warning">File ownership returns with the latest permitted projection. All acknowledged facts and original file snapshots remain in protected storage.</Banner>:
     <Banner tone="info">Only reviewed, model-disclosable standard fields enter these native projections. {preview?.disclosedCount} fields are included.</Banner>}
    {preview&&Object.entries(preview.files).map(([name,content])=><details className="projection-file" key={name}><summary>{name}</summary><pre>{content}</pre></details>)}
    <label className="binary-option"><input type="checkbox" checked={approved} onChange={e=>setApproved(e.target.checked)}/>I reviewed this ownership change and its exact candidate revision.</label>
    <div className="dialog-actions"><Button label="Cancel" onClick={()=>setPreview(null)} isDisabled={blocked}/>
     <Button label={preview?.mode==='rollback'?'Confirm rollback':'Activate reviewed candidate'} variant="primary" icon={<Glyph icon={ShieldCheck}/>} isDisabled={blocked||!approved}
      onClick={()=>preview&&void act('cutover',async()=>{await api.post('/api/candidate/cutover',{commandId:crypto.randomUUID(),action:preview.mode,transitionId:preview.transitionId,expectedRevision:preview.revision});setPreview(null);})}/></div>
   </div>
  </Dialog>
 </div>;
}
function ManualFactDialog({entry,data,api,onClose,onSaved}:{entry:Fact|'new';data:CandidateData;api:WorkspaceApi;onClose:()=>void;onSaved:()=>Promise<void>}){
 const old=entry==='new'?null:entry;
 const [field,setField]=useState(old?.field_key||'candidate.name');
 const [custom,setCustom]=useState(old&&!fields.some(f=>f.value===old.field_key)?old.field_key:'');
 const [kind,setKind]=useState(old?typeof old.value==='boolean'?'boolean':typeof old.value==='number'?'number':Array.isArray(old.value)?'list':'text':'text');
 const [value,setValue]=useState(old?Array.isArray(old.value)?old.value.join('\n'):old.value===null?'':String(old.value):'');
 const [why,setWhy]=useState(old?'':'Explicit candidate declaration'),[allowed,setAllowed]=useState(false),[error,setError]=useState(''),[busy,setBusy]=useState(false);
 const attempt=useRef<{payload:string;id:string}|null>(null);
 const key=field==='custom'?custom:field;
 async function save(event:FormEvent){
  event.preventDefault();if(busy)return;
  let parsed:unknown=value;
  if(kind==='boolean'){if(!['true','false'].includes(value)){setError('Choose an explicit Yes or No value.');return;}parsed=value==='true';}
  if(kind==='number'){if(!value.trim()){setError('Enter a number.');return;}parsed=Number(value);}
  if(kind==='list')parsed=value.split('\n').map(v=>v.trim()).filter(Boolean);
  const prior=[...data.facts,...data.withdrawnFacts].find(f=>f.field_key===key);
  const payload={fieldKey:key,value:parsed,expectedFactRevision:old?.revision||prior?.revision||0,modelConsent:allowed,reason:why};
  const text=JSON.stringify(payload);if(attempt.current?.payload!==text)attempt.current={payload:text,id:crypto.randomUUID()};
  setBusy(true);setError('');
  try{await api.post('/api/candidate/commands',{commandId:attempt.current.id,action:'manual_fact',payload});await onSaved();}
  catch(e){setError(errorMessage(e));}finally{setBusy(false);}
 }
 return <Dialog isOpen onOpenChange={v=>{if(!v&&!busy)onClose();}} purpose="form" width={600}>
  <DialogHeader title={old?'Correct candidate fact':'Add candidate fact'} onOpenChange={busy?undefined:onClose}/>
  <form className="dialog-form" onSubmit={save}>{error&&<Banner>{error}</Banner>}
   <Selector label="Field" value={fields.some(f=>f.value===field)?field:'custom'} isDisabled={Boolean(old)||busy} options={fields} onChange={next=>{
    setField(next);setValue('');
    setKind(next.startsWith('authorization.')?'boolean':next==='preferences.roles'||next==='preferences.locations'||next==='skills.languages'?'list':'text');
   }}/>
   {(field==='custom'||old&&!fields.some(f=>f.value===field))&&<TextInput label="Field key" value={old?field:custom} onChange={setCustom} isRequired isDisabled={Boolean(old)||busy}/>}
   <Selector label="Value type" value={kind} onChange={v=>{setKind(v);setValue('');}} isDisabled={busy} options={[{value:'text',label:'Text'},{value:'boolean',label:'Yes / No'},{value:'number',label:'Number'},{value:'list',label:'List'}]}/>
   {kind==='boolean'?<Selector label="Confirmed value" value={value} onChange={setValue} isDisabled={busy} options={[{value:'',label:'Unknown / choose explicitly'},{value:'true',label:'Yes'},{value:'false',label:'No'}]}/>:
    kind==='number'?<NumberInput label="Confirmed value" value={value===''?null:Number(value)} onChange={v=>setValue(v===null?'':String(v))} hasClear min={0} isRequired isDisabled={busy}/>:
    <TextArea label={kind==='list'?'Confirmed values (one per line)':'Confirmed value'} rows={4} value={value} onChange={setValue} isRequired isDisabled={busy}/>}
   <TextInput label={old?'Correction reason':'Declaration reason'} value={why} onChange={setWhy} isRequired isDisabled={busy}/>
   <label className="binary-option"><input type="checkbox" checked={allowed} onChange={e=>setAllowed(e.target.checked)} disabled={busy}/>Allow this source for future minimized model context</label>
   <div className="dialog-actions"><Button label="Cancel" onClick={onClose} isDisabled={busy}/><Button label={old?'Confirm correction':'Confirm declaration'} type="submit" variant="primary" icon={<Glyph icon={Check}/>} isLoading={busy}/></div>
  </form>
 </Dialog>;
}
