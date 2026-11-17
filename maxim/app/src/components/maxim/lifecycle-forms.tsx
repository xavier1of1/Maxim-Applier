'use client';
import {useState} from 'react';
import {Button} from '@astryxdesign/core/Button';
import {TextArea} from '@astryxdesign/core/TextArea';
import {TextInput} from '@astryxdesign/core/TextInput';
import {NumberInput} from '@astryxdesign/core/NumberInput';
import {Selector} from '@astryxdesign/core/Selector';
import {FilePlus2,Save} from 'lucide-react';
import {Banner,Glyph} from './shared';
import type {Evaluation,Fact,LifecycleApplication,LifecycleData} from './lifecycle-types';
export type LifecycleMutate=(endpoint:string,action:string,payload:unknown)=>Promise<boolean>;

export function PostingPolicyForm({app,review,blocked,mutate}:{app:LifecycleApplication;review?:LifecycleData['reviews'][number];blocked:boolean;mutate:LifecycleMutate}){
 const s=review?.salary,[mode,setMode]=useState(s?.flat!==undefined?'flat':s?.min!==undefined?'range':'unknown');
 const [flat,setFlat]=useState<number|null>(s?.flat??null),[min,setMin]=useState<number|null>(s?.min??null),[max,setMax]=useState<number|null>(s?.max??null);
 const [currency,setCurrency]=useState(s?.currency||'USD'),[period,setPeriod]=useState(s?.period||'annual'),[quote,setQuote]=useState(review?.source_quote||''),[maryland,setMaryland]=useState(review?.allow_maryland||false),[why,setWhy]=useState(review?.override_reason||''),[signals,setSignals]=useState<string[]>(review?.priority_signals||[]);
 async function savePolicy(){
  const salary=mode==='unknown'?null:{...(mode==='flat'?{flat}:{min,max}),currency,period};
  await mutate('applications','set_job_policy',{jobId:app.job_id,expectedJobRevision:app.job_revision,expectedPolicyRevision:review?.revision||0,salary,sourceQuote:quote,allowMaryland:maryland,overrideReason:why,prioritySignals:signals});
 }
 return <details className="lifecycle-details"><summary>Review posting policy</summary><form className="dialog-form" onSubmit={e=>{e.preventDefault();void savePolicy();}}>
  <Selector label="Posted salary" value={mode} onChange={setMode} options={[{value:'unknown',label:'Unknown'},{value:'flat',label:'Flat amount'},{value:'range',label:'Posted range'}]}/>
  {mode==='flat'&&<NumberInput label="Posted salary amount" value={flat} onChange={setFlat} min={1} max={10000000} hasClear isDisabled={blocked}/>}
  {mode==='range'&&<div className="form-grid"><NumberInput label="Posted range minimum" value={min} onChange={setMin} min={1} max={10000000} hasClear isDisabled={blocked}/><NumberInput label="Posted range maximum" value={max} onChange={setMax} min={1} max={10000000} hasClear isDisabled={blocked}/></div>}
  {mode!=='unknown'&&<div className="form-grid"><Selector label="Currency" value={currency} onChange={setCurrency} options={['USD','CAD','EUR','GBP'].map(value=>({value,label:value}))}/><Selector label="Pay interval" value={period} onChange={setPeriod} options={['annual','hour','month','unknown'].map(value=>({value,label:value}))}/></div>}
  <TextArea label="Exact posting quote" value={quote} onChange={setQuote} rows={3} isRequired isDisabled={blocked}/>
  <label className="binary-option"><input type="checkbox" checked={maryland} onChange={e=>setMaryland(e.target.checked)} disabled={blocked}/>Explicit Maryland location override</label>
  {maryland&&<TextInput label="Location override reason" value={why} onChange={setWhy} isRequired isDisabled={blocked}/>}
  <fieldset className="source-choice"><legend>Verified priority signals</legend>{[{value:'connection',label:'Meaningful connection'},{value:'vt_alumni',label:'Virginia Tech alumni'},{value:'recruiter',label:'Recruiter'},{value:'founder',label:'Founder / startup'},{value:'target_company',label:'Target company'}].map(s=><label className="binary-option" key={s.value}><input type="checkbox" checked={signals.includes(s.value)} disabled={blocked} onChange={e=>setSignals(v=>e.target.checked?[...v,s.value]:v.filter(x=>x!==s.value))}/>{s.label}</label>)}</fieldset>
  <Button label="Save policy review" type="submit" icon={<Glyph icon={Save}/>} isDisabled={blocked||quote.trim().length<3||maryland&&why.trim().length<3||mode==='flat'&&!flat||mode==='range'&&(!min||!max)}/>
 </form></details>;
}
export function PacketEvidenceForm({app,evaluation,facts,blocked,mutate}:{app:LifecycleApplication;evaluation:Evaluation;facts:Fact[];blocked:boolean;mutate:LifecycleMutate}){
 const [selected,setSelected]=useState<string[]>(facts.filter(f=>f.sensitivity==='standard'&&/^(candidate\.(name|location)|projects\.|experience\.|skills\.|education\.|positioning\.)/.test(f.field_key)).slice(0,100).map(f=>f.id)),[privateAllowed,setPrivateAllowed]=useState(false),[tailored,setTailored]=useState(false);
 const available=facts.filter(f=>f.sensitivity!=='sensitive');
 return <details className="lifecycle-details"><summary>Prepare PDF packet</summary><form className="dialog-form" onSubmit={e=>{e.preventDefault();void mutate('packets','build_packet',{applicationId:app.id,evaluationId:evaluation.id,expectedApplicationRevision:app.revision,facts:available.filter(f=>selected.includes(f.id)).map(f=>({id:f.id,revision:f.revision})),allowPrivate:privateAllowed,tailoredSelection:tailored});}}>
  {available.length>100&&<Banner tone="warning">Select at most 100 facts for this packet. All approved facts remain in Candidate.</Banner>}
  <label className="binary-option"><input type="checkbox" checked={privateAllowed} disabled={blocked} onChange={e=>{const checked=e.target.checked;setPrivateAllowed(checked);if(!checked)setSelected(ids=>ids.filter(id=>available.find(f=>f.id===id)?.sensitivity==='standard'));}}/>Include selected private facts in the local PDF</label>
  <fieldset className="packet-fact-selection"><legend>Approved resume evidence · {selected.length} selected</legend>{available.map(f=><label className="evidence-choice" key={f.id}><input type="checkbox" checked={selected.includes(f.id)} disabled={blocked||f.sensitivity!=='standard'&&!privateAllowed||selected.length>=100&&!selected.includes(f.id)} onChange={e=>setSelected(ids=>e.target.checked?[...ids,f.id]:ids.filter(id=>id!==f.id))}/><span><strong>{f.field_key} · revision {f.revision}</strong><span>{typeof f.value==='string'?f.value:JSON.stringify(f.value)}</span></span></label>)}</fieldset>
  <label className="binary-option"><input type="checkbox" checked={tailored} onChange={e=>setTailored(e.target.checked)} disabled={blocked}/>I selected this evidence specifically for this role.</label>
  <Button label="Generate PDF packet" type="submit" variant="primary" icon={<Glyph icon={FilePlus2}/>} isDisabled={blocked||!selected.length||!available.some(f=>selected.includes(f.id)&&f.field_key==='candidate.name')}/>
 </form></details>;
}

export function PostingDetailsForm({app,blocked,mutate}:{app:LifecycleApplication;blocked:boolean;mutate:LifecycleMutate}){
 const [description,setDescription]=useState(app.description||''),[location,setLocation]=useState(app.location||''),[url,setUrl]=useState(app.url||''),[reason,setReason]=useState('');
 if(app.opening_key)return null;
 return <details className="lifecycle-details"><summary>Correct manual posting details</summary><form className="dialog-form" onSubmit={e=>{e.preventDefault();void mutate('applications','update_posting_details',{jobId:app.job_id,expectedJobRevision:app.job_revision,description,location,url:url||null,reason});}}>
  <TextArea label="Full job description" value={description} onChange={setDescription} rows={7} isRequired isDisabled={blocked}/>
  <TextInput label="Posting location" value={location} onChange={setLocation} isDisabled={blocked}/>
  <TextInput label="Posting URL" value={url} onChange={setUrl} isDisabled={blocked||Boolean(app.url)} type="url"/>
  <TextInput label="Correction reason" value={reason} onChange={setReason} isRequired isDisabled={blocked}/>
  <Button label="Save posting correction" type="submit" icon={<Glyph icon={Save}/>} isDisabled={blocked||description.trim().length<50||reason.trim().length<3}/>
 </form></details>;
}
