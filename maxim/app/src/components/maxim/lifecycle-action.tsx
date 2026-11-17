'use client';
import {useState} from 'react';
import {Button} from '@astryxdesign/core/Button';
import {TextArea} from '@astryxdesign/core/TextArea';
import {Selector} from '@astryxdesign/core/Selector';
import {Dialog,DialogHeader} from '@astryxdesign/core/Dialog';
import {Check,Download,Send} from 'lucide-react';
import {Banner,Glyph,Pill} from './shared';
import type {Evaluation,LifecycleAction,LifecycleApplication,Packet} from './lifecycle-types';

const titles:Record<LifecycleAction,string>={approve:'Approve exact packet',revoke:'Revoke packet',started:'Record manual start',reviewed:'Record form review',submission:'Record completed submission',outcome:'Record application outcome',override:'Strategic T1 override',revoke_override:'Revoke strategic override'};
export function LifecycleActionDialog({kind,app,evaluation,packet,duplicate,busy,error,onClose,onSubmit}:{kind:LifecycleAction;app:LifecycleApplication;evaluation?:Evaluation;packet?:Packet;duplicate?:{risk:string;warning:string|null};busy:boolean;error?:string;onClose:()=>void;onSubmit:(endpoint:string,action:string,payload:unknown)=>Promise<boolean>}){
 const [reason,setReason]=useState(''),[confirmed,setConfirmed]=useState(false),[untailored,setUntailored]=useState(false),[duplicates,setDuplicates]=useState(false);
 const [external,setExternal]=useState(!packet||packet.status!=='approved'||!packet.current),[filled,setFilled]=useState(false),[correction,setCorrection]=useState(false),[outcome,setOutcome]=useState('responded');
 const warning=Boolean(duplicate?.risk&&duplicate.risk!=='none'||kind==='submission'&&app.outcome==='submitted');
 const requiresConfirmation=kind==='approve'||kind==='submission';
 const allowed=reason.trim().length>=3&&(!requiresConfirmation||confirmed)&&(kind!=='approve'||!packet?.untailored||untailored)&&(!['approve','submission'].includes(kind)||!warning||duplicates);
 async function recordDecision(){
  let endpoint='applications',action='',payload:Record<string,unknown>={applicationId:app.id,expectedRevision:app.revision,reason};
  if(kind==='approve'){endpoint='packets';action='approve_packet';payload={packetId:packet!.id,expectedRevision:packet!.revision,contentHash:packet!.content_hash,confirmed,confirmedUntailored:untailored,duplicateReviewed:duplicates,reason};}
  if(kind==='revoke'){endpoint='packets';action='revoke_packet';payload={packetId:packet!.id,expectedRevision:packet!.revision,reason};}
  if(kind==='started'||kind==='reviewed'){action=kind==='started'?'mark_started':'mark_reviewed';payload={...payload,packetId:packet!.id,filledManually:kind==='reviewed'&&filled};}
  if(kind==='submission'){action='record_submission';payload={...payload,external,confirmed,duplicateReviewed:duplicates,...(!external?{packetId:packet!.id}:{})};}
  if(kind==='outcome'){action='record_outcome';payload={...payload,outcome,correction};}
  if(kind==='override'||kind==='revoke_override'){action=kind==='override'?'strategic_override':'revoke_override';payload={...payload,evaluationId:evaluation!.id};}
  if(await onSubmit(endpoint,action,payload))onClose();
 }
 return <Dialog isOpen onOpenChange={value=>{if(!value&&!busy)onClose();}} purpose="form" width={620}>
  <DialogHeader title={titles[kind]} onOpenChange={()=>{if(!busy)onClose();}}/>
  <form className="dialog-form" onSubmit={e=>{e.preventDefault();void recordDecision();}}>
   {error&&<Banner>{error}</Banner>}
   <div className="fact-title"><strong>{app.company} / {app.title}</strong><Pill tone="amber">{app.outcome.replaceAll('_',' ')}</Pill></div>
   {kind==='approve'&&packet&&<>
    <div className="inline-actions"><a className="text-link" href={'/api/artifacts/'+packet.report_artifact_id} target="_blank" rel="noreferrer"><Download size={14}/> Report</a><a className="text-link" href={'/api/artifacts/'+packet.pdf_artifact_id} target="_blank" rel="noreferrer"><Download size={14}/> PDF</a></div>
    <dl className="packet-binding"><dt>Candidate / posting revision</dt><dd>{packet.candidate_revision} / {packet.job_revision}</dd><dt>Packet SHA-256</dt><dd><code>{packet.content_hash}</code></dd><dt>Report SHA-256</dt><dd><code>{packet.report_hash}</code></dd><dt>PDF SHA-256</dt><dd><code>{packet.pdf_hash}</code></dd></dl>
    <details><summary>Selected evidence</summary><ul>{packet.evidence.map(f=><li key={f.id}>{f.field_key} · revision {f.revision}</li>)}</ul></details>
    <label className="binary-option"><input type="checkbox" checked={confirmed} onChange={e=>setConfirmed(e.target.checked)} disabled={busy}/>I reviewed this exact report, PDF and selected evidence.</label>
    {packet.untailored&&<label className="binary-option"><input type="checkbox" checked={untailored} onChange={e=>setUntailored(e.target.checked)} disabled={busy}/>I approve using this untailored resume.</label>}
   </>}
   {kind==='submission'&&<>
    <Selector label="Submission evidence" value={external?'external':'packet'} onChange={v=>setExternal(v==='external')} options={[{value:'external',label:'External manual submission'},...(packet?.status==='approved'&&packet.current?[{value:'packet',label:'Reviewed approved packet'}]:[])]}/>
    <label className="binary-option"><input type="checkbox" checked={confirmed} onChange={e=>setConfirmed(e.target.checked)} disabled={busy}/>The application has already been submitted manually.</label>
   </>}
   {kind==='reviewed'&&<label className="binary-option"><input type="checkbox" checked={filled} onChange={e=>setFilled(e.target.checked)} disabled={busy}/>I manually filled and reviewed the form.</label>}
   {kind==='outcome'&&<><Selector label="Outcome" value={outcome} onChange={setOutcome} options={['responded','interviewing','offer','rejected','withdrawn','unknown','not_submitted'].map(value=>({value,label:value.replaceAll('_',' ')}))}/><label className="binary-option"><input type="checkbox" checked={correction} onChange={e=>setCorrection(e.target.checked)} disabled={busy}/>This corrects a previously recorded outcome.</label></>}
   {warning&&['approve','submission'].includes(kind)&&<><Banner tone="warning">{duplicate?.warning||'This application already has a submission history.'}</Banner><label className="binary-option"><input type="checkbox" checked={duplicates} onChange={e=>setDuplicates(e.target.checked)} disabled={busy}/>I reviewed the duplicate or reapplication history.</label></>}
   <TextArea label="Reason / evidence" value={reason} onChange={setReason} rows={3} isRequired isDisabled={busy}/>
   <div className="dialog-actions"><Button label="Cancel" onClick={onClose} isDisabled={busy}/><Button label={kind==='submission'?'Record completed submission':kind==='approve'?'Approve packet':'Record decision'} type="submit" variant={kind==='revoke'||kind==='revoke_override'?'destructive':'primary'} icon={<Glyph icon={kind==='submission'?Send:Check}/>} isDisabled={busy||!allowed} isLoading={busy}/></div>
  </form>
 </Dialog>;
}
