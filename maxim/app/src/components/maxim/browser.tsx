'use client';
import {useCallback,useEffect,useRef,useState} from 'react';
import {Button} from '@astryxdesign/core/Button';
import {Selector} from '@astryxdesign/core/Selector';
import {Dialog,DialogHeader} from '@astryxdesign/core/Dialog';
import {Monitor,RefreshCw,Pause,Play,Upload,ArrowRight,X,Check,BookOpen} from 'lucide-react';
import {type WorkspaceApi,errorMessage} from './api';
import {Banner,EmptyState,Glyph,Pill,ToolButton} from './shared';
import type {Navigation} from './types';
import type {Field,Observation} from '../../server/browser/policy';
import {useBoundedRefresh} from './use-bounded-refresh';

type Fact={id:string;value:string|boolean;revision:number;field_key:string;sensitivity:string};
type Session={id:string;application_id:string;packet_id:string;revision:number;status:string;company:string;title:string;private_consent:boolean;last_error:string|null;pdf_hash:string;observation:Partial<Observation>;progress:Record<string,{status:string;label:string}>;choices:{fieldId:string;policy:{kind:string};facts:Fact[]}[]};
type Data={sessions:Session[];actions:{session_id:string;status:string;kind:string;result:Record<string,unknown>}[]};
type Apps={applications:{id:string;company:string;title:string;revision:number;outcome:string;status:string}[];packets:{id:string;application_id:string;current:boolean;status:string}[]};
export function BrowserView({api,disabled,refresh,navigate}:{api:WorkspaceApi;disabled:boolean;refresh:()=>Promise<void>;navigate:(n:Navigation)=>void}){
 const [data,setData]=useState<Data|null>(null),[apps,setApps]=useState<Apps|null>(null),[error,setError]=useState(''),[busy,setBusy]=useState(false),[application,setApplication]=useState('');
 const [consent,setConsent]=useState(false),[privateConsent,setPrivateConsent]=useState(false),[handoff,setHandoff]=useState(false),[review,setReview]=useState<{field:Field;fact:Fact}|null>(null);
 const [memory,setMemory]=useState<{field:Field;candidates:{id:string;revision:number;text:string;type:string;match:string}[]}|null>(null);
 const active=useRef(false),[readError,setReadError]=useState('');
 const load=useCallback(async()=>{try{const d=await api.get<Data>('/api/browser');const a=await api.get<Apps>('/api/applications');setData(d);setApps(a);setReadError('');}catch(e){setReadError(errorMessage(e));}},[api]);
 useEffect(()=>{void load();},[load]);
 const pending=data?.actions.some(a=>['queued','running'].includes(a.status));
 useBoundedRefresh(Boolean(pending),load);
 async function act(action:string,payload:unknown){if(disabled||active.current)return;active.current=true;setBusy(true);setError('');try{await api.post('/api/browser/commands',{commandId:crypto.randomUUID(),action,payload});await load();await refresh();}catch(e){setError(errorMessage(e));await load();}finally{active.current=false;setBusy(false);}}
 const blocked=disabled||busy||pending||Boolean(readError);
 const session=data?.sessions.find(s=>!['closed','failed'].includes(s.status));
 const options=(apps?.applications||[]).filter(a=>a.outcome==='not_submitted'&&a.status!=='archived'&&apps?.packets.some(p=>p.application_id===a.id&&p.status==='approved'&&p.current));
 const chosen=options.find(a=>a.id===application)||options[0];
 if(!data)return <div className="knowledge-view">{readError?<Banner>{readError}</Banner>:<p role="status">Loading application assistance</p>}</div>;
 async function question(field:Field){try{const r=await api.post('/api/answers/commands',{commandId:crypto.randomUUID(),action:'save_question',payload:{text:field.label,company:session!.company,roleLane:'unspecified',answerType:field.tag==='select'?'choice':'text',options:field.options.map(o=>o.value).filter(Boolean).slice(0,30),tags:[]}});void r;navigate({view:'answers'});}catch(e){setError(errorMessage(e));}}
 const questionInput=(field:Field)=>({text:field.label,company:session!.company,roleLane:'unspecified',answerType:field.tag==='select'?'choice':'text',options:field.options.map(o=>o.value).filter(Boolean).slice(0,30),tags:[]});
 async function recall(field:Field){if(active.current)return;setError('');setBusy(true);active.current=true;try{const r=await api.post<{candidates:{id:string;revision:number;text:string;type:string;match:string}[]}>('/api/answers/recall',{...questionInput(field),includePrivate:session!.private_consent});setMemory({field,candidates:r.candidates.filter(a=>a.type==='answer')});}catch(e){setError(errorMessage(e));}finally{active.current=false;setBusy(false);}}
 async function useAnswer(answer:{id:string;revision:number},field:Field){if(active.current)return;active.current=true;setBusy(true);let confirmed:{id:string;revision:number}|null=null;
  try{const q=await api.post<{result:{id:string}}>('/api/answers/commands',{commandId:crypto.randomUUID(),action:'save_question',payload:questionInput(field)});
   const prepared=await api.post<{result:{id:string;revision:number;snapshot:{contentHash:string}}}>('/api/answers/commands',{commandId:crypto.randomUUID(),action:'prepare_reuse',payload:{answerId:answer.id,expectedRevision:answer.revision,questionId:q.result.id}});
   confirmed=(await api.post<{result:{id:string;revision:number}}>('/api/answers/commands',{commandId:crypto.randomUUID(),action:'confirm_reuse',payload:{useId:prepared.result.id,expectedRevision:prepared.result.revision,contentHash:prepared.result.snapshot.contentHash,reviewed:true}})).result;
  }catch(e){setError(errorMessage(e));}finally{active.current=false;setBusy(false);}
  if(confirmed){setMemory(null);await act('fill',{sessionId:session!.id,expectedRevision:session!.revision,observationId:session!.observation.id,fieldId:field.id,evidence:{kind:'answer_use',id:confirmed.id,revision:confirmed.revision}});}
 }
 return <div className="knowledge-view">{readError&&<Banner>{readError}</Banner>}{error&&<Banner onDismiss={()=>setError('')}>{error}</Banner>}
  <div className="knowledge-toolbar"><h3>Application Assistance</h3><ToolButton label="Refresh assistance" icon={RefreshCw} onClick={()=>void load()} disabled={disabled}/></div>
  {!session?<section className="knowledge-section">{!chosen?<EmptyState icon={Monitor} title="No approved application packet" action={<Button label="Applications" icon={<Glyph icon={ArrowRight}/>} onClick={()=>navigate({view:'applications'})}/>}/>:<>
   <Selector label="Application" value={chosen.id} onChange={setApplication} width="100%" options={options.map(a=>({value:a.id,label:a.company+' - '+a.title}))}/>
   <label className="binary-option"><input type="checkbox" checked={consent} onChange={e=>setConsent(e.target.checked)} disabled={blocked}/>I authorize this dedicated application session. The employer may retain data released during manual review.</label>
   <label className="binary-option"><input type="checkbox" checked={privateConsent} onChange={e=>setPrivateConsent(e.target.checked)} disabled={blocked}/>Allow my approved private contact/work-authorization facts in this form.</label>
   <Button label="Open application browser" variant="primary" icon={<Glyph icon={Monitor}/>} isDisabled={blocked||!consent} onClick={()=>void act('open',{applicationId:chosen.id,packetId:apps!.packets.find(p=>p.application_id===chosen.id&&p.status==='approved'&&p.current)!.id,expectedApplicationRevision:chosen.revision,autosaveConsent:true,privateConsent})}/>
  </>}</section>:<>
   <section className="knowledge-section"><div className="fact-title"><h3>{session.company}</h3><Pill tone={session.status==='manual_handoff'?'green':'amber'}>{session.status.replaceAll('_',' ')}</Pill></div><p>{session.title}</p>
    {session.last_error&&<Banner tone="warning">{session.last_error.replaceAll('_',' ')}. Re-inspect before another action.</Banner>}
    <div className="inline-actions"><ToolButton label="Re-inspect current page" icon={RefreshCw} disabled={blocked||session.status==='manual_handoff'} onClick={()=>void act('observe',{sessionId:session.id,expectedRevision:session.revision})}/>
     <Button label="Fill approved fields and PDF" size="sm" icon={<Glyph icon={Check}/>} isDisabled={blocked||!['observed','review_ready'].includes(session.status)} onClick={()=>void act('fill_known',{sessionId:session.id,expectedRevision:session.revision})}/>
     <ToolButton label={session.status==='paused'?'Resume assistance':'Pause assistance'} icon={session.status==='paused'?Play:Pause} disabled={blocked||session.status==='manual_handoff'} onClick={()=>void act(session.status==='paused'?'resume':'pause',{sessionId:session.id,expectedRevision:session.revision})}/>
     <ToolButton label="Close dedicated browser" icon={X} disabled={blocked} onClick={()=>void act('close',{sessionId:session.id,expectedRevision:session.revision})}/></div>
    <p className="small muted">PDF SHA-256: {session.pdf_hash}</p><Pill>Submission not performed by Maxim</Pill>
   </section>
   <section className="knowledge-section" aria-label="Application field review">{!(session.observation.fields||[]).length?<EmptyState icon={Monitor} title={pending?'Inspecting application':'No supported controls observed'}/>:session.observation.fields!.map(field=>{const choice=session.choices.find(c=>c.fieldId===field.id),fact=choice?.facts[0],progress=session.progress[field.signature],manual=['credential','self_id','attestation'].includes(choice?.policy.kind||'');return <article className="fact-row" key={field.id}><div className="fact-title"><strong>{field.label}</strong><Pill tone={progress?'green':'amber'}>{progress?.status.replaceAll('_',' ')|| (manual?'manual only':field.required?'required':'optional')}</Pill></div>
    <div className="inline-actions">{field.type==='file'?<Button label="Attach approved PDF" size="sm" icon={<Glyph icon={Upload}/>} isDisabled={blocked||!['observed','review_ready'].includes(session.status)} onClick={()=>void act('attach_packet',{sessionId:session.id,expectedRevision:session.revision,observationId:session.observation.id,fieldId:field.id})}/>:fact&&!manual?<Button label="Review approved value" size="sm" icon={<Glyph icon={Check}/>} isDisabled={blocked||session.status==='manual_handoff'} onClick={()=>setReview({field,fact})}/>:!manual&&!['submit','button','reset','password','hidden'].includes(field.type)?<Button label="Save question" size="sm" icon={<Glyph icon={BookOpen}/>} isDisabled={blocked||session.status==='manual_handoff'} onClick={()=>void question(field)}/>:null}</div>
    {!fact&&!manual&&!['file','submit','button','reset','password','hidden'].includes(field.type)&&<Button label="Find approved answer" size="sm" icon={<Glyph icon={BookOpen}/>} isDisabled={blocked||session.status==='manual_handoff'} onClick={()=>void recall(field)}/>}
   </article>;})}</section>
   {session.status!=='manual_handoff'&&<section className="knowledge-section"><Button label="Review and take manual control" variant="primary" icon={<Glyph icon={ArrowRight}/>} isDisabled={blocked||!['observed','review_ready'].includes(session.status)} onClick={()=>setHandoff(true)}/></section>}
  </>}
  <Dialog isOpen={Boolean(review)} onOpenChange={open=>{if(!open)setReview(null);}} purpose="form" width={500}><DialogHeader title="Review field value" onOpenChange={()=>setReview(null)}/><div className="dialog-form">{review&&<><strong>{review.field.label}</strong><p className="fact-value">{String(review.fact.value)}</p><p className="small muted">{review.fact.field_key} · revision {review.fact.revision} · {review.fact.sensitivity}</p><Button label="Fill this value" icon={<Glyph icon={Check}/>} variant="primary" isDisabled={blocked} onClick={()=>{const value=review;setReview(null);void act('fill',{sessionId:session!.id,expectedRevision:session!.revision,observationId:session!.observation.id,fieldId:value.field.id,evidence:{kind:'fact',id:value.fact.id,revision:value.fact.revision}});}}/></>}</div></Dialog>
  <Dialog isOpen={handoff} onOpenChange={setHandoff} purpose="form" width={500}><DialogHeader title="Manual application review" onOpenChange={()=>setHandoff(false)}/><div className="dialog-form"><p>Review every field and the attached PDF in the visible browser. Taking manual control releases network and submission guards; the employer may save entered data. Maxim will no longer fill this session.</p><p>Only you submit. Record submission in Applications afterward.</p><Button label="Take manual control" variant="primary" icon={<Glyph icon={ArrowRight}/>} isDisabled={blocked} onClick={()=>{setHandoff(false);void act('handoff',{sessionId:session!.id,expectedRevision:session!.revision,manualOnly:true});}}/></div></Dialog>
  <Dialog isOpen={Boolean(memory)} onOpenChange={open=>{if(!open)setMemory(null);}} purpose="form" width={500}><DialogHeader title="Review reusable answer" onOpenChange={()=>setMemory(null)}/><div className="dialog-form">{memory&&<><strong>{memory.field.label}</strong>{!memory.candidates.length?<EmptyState icon={BookOpen} title="No compatible approved answer" action={<Button label="Save question" icon={<Glyph icon={BookOpen}/>} onClick={()=>void question(memory.field)}/>}/>:memory.candidates.map(answer=><section key={answer.id}><p className="fact-value">{answer.text}</p><Pill>{answer.match.replaceAll('_',' ')}</Pill><Button label="Confirm and fill this answer" variant="primary" icon={<Glyph icon={Check}/>} isDisabled={blocked} onClick={()=>void useAnswer(answer,memory.field)}/></section>)}</>}</div></Dialog>
 </div>;
}
