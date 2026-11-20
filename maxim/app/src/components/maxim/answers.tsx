'use client';
import {useCallback,useEffect,useRef,useState,type FormEvent} from 'react';
import {Button} from '@astryxdesign/core/Button';
import {TextInput} from '@astryxdesign/core/TextInput';
import {TextArea} from '@astryxdesign/core/TextArea';
import {NumberInput} from '@astryxdesign/core/NumberInput';
import {Selector} from '@astryxdesign/core/Selector';
import {Dialog,DialogHeader} from '@astryxdesign/core/Dialog';
import {ArrowLeft,BookOpen,Check,Download,Eye,FileCheck,Plus,Pencil,RefreshCw,Search,ShieldCheck,Trash2,X} from 'lucide-react';
import {type WorkspaceApi,errorMessage} from './api';
import {Banner,EmptyState,Glyph,Pill,ToolButton,formatDate} from './shared';

type Ref={id:string;revision:number};
type Fact=Ref&{field_key:string;value:unknown};
type Context={roleLane:string;locale:string;answerType:string;options:string[]};
type Question={id:string;exact_text:string;company:string;context:Context;kind:string;tags:string[]};
type Answer={id:string;revision:number;question_id:string;question:string;company:string;context:Context;kind:string;text:string;status:string;permission:string;model_consent:boolean;sensitive_consent:boolean;sensitivity:string;content_hash:string;facts:Ref[];expired:boolean;expires_at:string};
type Use={id:string;question_id:string;revision:number;answer_revision:number;status:string;snapshot:{text?:string;company?:string;question?:string;contentHash?:string;redacted?:boolean}};
type Library={questions:Question[];answers:Answer[];uses:Use[];partial:boolean};
type Candidate={candidate:{revision:number;ownership:string};facts:Fact[]};
type Recall={state:string;reason?:string;candidates:{id:string;type:string;revision:number;text?:string;value?:unknown;match:string}[];related?:{text:string;question:string}[];partial?:boolean;omittedForBudget?:number};
const text=(v:unknown)=>typeof v==='string'?v:JSON.stringify(v);
const questionValue=(q:{text:string;company:string;roleLane:string;answerType:string;options:string;tags:string})=>({
 text:q.text,company:q.company,roleLane:q.roleLane||'unspecified',answerType:q.answerType,locale:'en-US',
 options:q.options.split('\n').map(s=>s.trim()).filter(Boolean),tags:q.tags.split(',').map(s=>s.trim()).filter(Boolean),
});
const questionForm=(q:Question)=>({text:q.exact_text,company:q.company,roleLane:q.context.roleLane,answerType:q.context.answerType,options:q.context.options.join('\n'),tags:q.tags.join(',')});
export function AnswersView({api,disabled,refresh,asOf,requestedQuestion,returnToAssistant}:{api:WorkspaceApi;disabled:boolean;refresh:()=>Promise<void>;asOf:string;requestedQuestion:string|null;returnToAssistant?:()=>void}){
 const [data,setData]=useState<Library|null>(null),[candidate,setCandidate]=useState<Candidate|null>(null),[error,setError]=useState(''),[readError,setReadError]=useState(''),[busy,setBusy]=useState('');
 const [tab,setTab]=useState('recall'),[lookup,setLookup]=useState<Recall|null>(null);
 const [includePrivate,setIncludePrivate]=useState(false);
 const [form,setForm]=useState({text:'',company:'',roleLane:'',answerType:'text',options:'',tags:''});
 const [draft,setDraft]=useState<{question:ReturnType<typeof questionValue>;entry?:Answer}|null>(null),[inspect,setInspect]=useState<Answer|null>(null),[reuse,setReuse]=useState<Use|null>(null);
 const [checked,setChecked]=useState(false),[why,setWhy]=useState('');
 const [removeQuestion,setRemoveQuestion]=useState<Question|null>(null);
 const sequence=useRef(0),active=useRef(false),attempts=useRef(new Map<string,string>()),loadedQuestion=useRef<string|null>(null);
 const load=useCallback(async()=>{
  const n=++sequence.current;
  try{const library=await api.get<Library>('/api/answers'+(requestedQuestion?'?question='+encodeURIComponent(requestedQuestion):'')),person=await api.get<Candidate>('/api/candidate');
   if(n===sequence.current){
    setData(library);setCandidate(person);setReadError('');
    const target=library.questions.find(q=>q.id===requestedQuestion);
    if(target&&loadedQuestion.current!==target.id){loadedQuestion.current=target.id;setForm(questionForm(target));}
   }}
  catch(e){if(n===sequence.current)setReadError(errorMessage(e));}
 },[api,requestedQuestion]);
 useEffect(()=>{void load();return()=>{sequence.current++;};},[load,asOf]);
 const blocked=disabled||Boolean(readError)||Boolean(busy);
 const command=async(action:string,payload:unknown)=>{
  const key=JSON.stringify({action,payload}),commandId=attempts.current.get(key)||crypto.randomUUID();attempts.current.set(key,commandId);
  const r=await api.post<{result:unknown}>('/api/answers/commands',{commandId,action,payload});attempts.current.delete(key);return r.result;
 };
 const act=async(label:string,fn:()=>Promise<void>)=>{
  if(blocked||active.current)return;active.current=true;setBusy(label);setError('');
  try{await fn();await load();await refresh();}catch(e){setError(errorMessage(e));await load();}finally{active.current=false;setBusy('');}
 };
 const open=(a:Answer)=>{setChecked(false);setWhy('');setInspect(a);};
 const edit=(a:Answer)=>{setInspect(null);setDraft({entry:a,question:{text:a.question,company:a.company,roleLane:a.context.roleLane,locale:a.context.locale,answerType:a.context.answerType,options:a.context.options,tags:data?.questions.find(q=>q.id===a.question_id)?.tags||[]}});};
 if(!data||!candidate)return <div className="knowledge-view">{readError?
  <EmptyState icon={BookOpen} title="Answer library unavailable" detail={readError}
   action={<Button label="Retry" onClick={()=>void load()} icon={<Glyph icon={RefreshCw}/>}/>}/>:
  <p role="status">Loading answer memory</p>}</div>;
 async function prepare(a:{id:string;revision:number}){
  await act('reuse',async()=>{
   const q=await command('save_question',questionValue(form)) as Question;
   const result=await command('prepare_reuse',{answerId:a.id,expectedRevision:a.revision,questionId:q.id}) as Use;
   setReuse(result);setChecked(false);
  });
 }
 return <div className="knowledge-view">
  {readError&&<Banner>{readError} Showing last loaded answers.</Banner>}{error&&<Banner onDismiss={()=>setError('')}>{error}</Banner>}
  {data.partial&&<Banner tone="warning">Recent 200 questions and answers shown. Export includes the complete authorized history.</Banner>}
  {requestedQuestion&&!data.questions.some(q=>q.id===requestedQuestion)&&<Banner tone="warning">The selected question is no longer available.</Banner>}
  {candidate.candidate.ownership!=='canonical'&&<Banner tone="info">Candidate authority is not active. Recall stays paused; recorded answers remain reviewable.</Banner>}
  <div className="knowledge-summary"><div><span>Approved</span><strong>{data.answers.filter(a=>a.status==='approved'&&!a.expired).length}</strong></div><div><span>Drafts</span><strong>{data.answers.filter(a=>a.status==='draft').length}</strong></div>
   <div><span>Questions</span><strong>{data.questions.length}</strong></div><div><span>Confirmed reuses</span><strong>{data.uses.filter(u=>u.status==='confirmed').length}</strong></div></div>
  <div className="knowledge-toolbar"><Selector label="Answer view" isLabelHidden value={tab} onChange={setTab} width={200} options={[{value:'recall',label:'Recall'},{value:'library',label:'Answer library'},{value:'uses',label:'Reuse history'}]}/>
   <div className="inline-actions">{returnToAssistant&&<Button label="Return to Apply Assistant" size="sm" icon={<Glyph icon={ArrowLeft}/>} onClick={returnToAssistant}/>}
    <a href="/api/answers/export" download title="Export answer memory" aria-label="Export answer memory" className="icon-link"><Download size={17}/></a>
    <ToolButton label="Refresh answers" icon={RefreshCw} onClick={()=>void load()} disabled={disabled}/></div></div>
  {tab==='recall'&&<section className="knowledge-section" aria-label="Answer recall">
   <form className="answer-lookup" onSubmit={e=>{e.preventDefault();void act('recall',async()=>{setLookup(await api.post<Recall>('/api/answers/recall',{...questionValue(form),includePrivate}));});}}>
    <div className="form-grid"><TextInput label="Company" value={form.company} onChange={company=>{setForm(f=>({...f,company}));setLookup(null);}} isRequired isDisabled={blocked}/>
     <TextInput label="Role lane" value={form.roleLane} onChange={roleLane=>{setForm(f=>({...f,roleLane}));setLookup(null);}} isDisabled={blocked}/></div>
    <TextArea label="Exact application question" value={form.text} onChange={value=>{setForm(f=>({...f,text:value}));setLookup(null);}} rows={3} isRequired isDisabled={blocked}/>
    <details className="answer-advanced"><summary>Question context</summary><div className="answer-context-fields">
     <Selector label="Answer type" value={form.answerType} onChange={answerType=>{setForm(f=>({...f,answerType}));setLookup(null);}} options={['text','boolean','number','choice'].map(value=>({value,label:value}))}/>
     {form.answerType==='choice'&&<TextArea label="Exact options (one per line)" value={form.options} onChange={options=>{setForm(f=>({...f,options}));setLookup(null);}} rows={3}/>}
     <TextInput label="Topic tags" value={form.tags} onChange={tags=>{setForm(f=>({...f,tags}));setLookup(null);}}/>
    </div></details>
    <label className="binary-option"><input type="checkbox" checked={includePrivate} onChange={e=>{setIncludePrivate(e.target.checked);setLookup(null);}} disabled={blocked}/>Include approved private facts in this local lookup</label>
    <div className="answer-form-actions"><Button label="Find answer" type="submit" variant="primary" icon={<Glyph icon={Search}/>} isDisabled={blocked} isLoading={busy==='recall'}/>
     <Button label="Record answer" icon={<Glyph icon={Plus}/>} isDisabled={blocked||!form.text.trim()||!form.company.trim()} onClick={()=>setDraft({question:questionValue(form)})}/></div>
   </form>
   {lookup&&<section className="recall-result" aria-label="Recall result"><div className="fact-title"><strong>{lookup.state.replaceAll('_',' ')}</strong><Pill tone={lookup.state==='ask_user'?'amber':'green'}>{lookup.reason?.replaceAll('_',' ')||'Typed candidate fact'}</Pill></div>
    {(lookup.partial||Boolean(lookup.omittedForBudget))&&<Banner tone="warning">Lookup coverage is limited. Refine the question and context.</Banner>}
    {!lookup.candidates.length&&<p className="small muted">No approved answer was returned for this lookup.</p>}
    {lookup.candidates.map((a,i)=><article className="fact-proposal" key={a.id+':'+i}><p className="fact-value">{a.text||text(a.value)}</p>
     <div className="fact-meta"><span>{a.match.replaceAll('_',' ')} / rev {a.revision}</span>{a.type==='answer'&&lookup.state==='review_answer'&&<Button label="Review reuse" size="sm" icon={<Glyph icon={FileCheck}/>} onClick={()=>void prepare(a)} isDisabled={blocked}/>}</div></article>)}
    {lookup.related?.map((a,i)=><details className="projection-file" key={i}><summary>Related history, not reusable</summary><p>{a.question}</p><pre>{a.text}</pre></details>)}
   </section>}
   {data.questions.length>0&&<div className="recent-questions"><h3>Recent questions</h3>{data.questions.slice(0,10).map(q=><div className="recent-question-row" key={q.id}>
    <button type="button" className="recent-question" onClick={()=>{setForm(questionForm(q));setLookup(null);}}>
    <span>{q.exact_text}</span><small>{q.company} / {q.context.roleLane}</small></button>
    <ToolButton label="Delete unanswered question" icon={Trash2} disabled={blocked||data.answers.some(a=>a.question_id===q.id&&a.status!=='deleted')||data.uses.some(u=>u.question_id===q.id&&['draft','confirmed'].includes(u.status))} onClick={()=>setRemoveQuestion(q)}/></div>)}</div>}
  </section>}
  {tab==='library'&&<section className="knowledge-section" aria-label="Stored answers">
   {data.answers.length?data.answers.map(a=><article className="answer-row" key={a.id}><div><strong>{a.question}</strong><span className="small muted">{a.company} / {a.context.roleLane} / rev {a.revision}</span><p className="fact-value">{a.text||'Erased answer'}</p></div>
    <div className="answer-row-status"><Pill tone={a.status==='approved'&&!a.expired?'green':a.status==='invalidated'?'coral':'amber'}>{a.expired?'expired':a.status}</Pill><span className="small muted">{a.permission.replaceAll('_',' ')}</span>
     <ToolButton label="Inspect answer" icon={Eye} onClick={()=>open(a)} disabled={blocked}/></div></article>):<EmptyState icon={BookOpen} title="No stored answers"/>}
  </section>}
  {tab==='uses'&&<section className="knowledge-section" aria-label="Answer reuse history">
   {data.uses.length?data.uses.map(u=><article className="answer-row" key={u.id}><div><strong>{u.snapshot.question||'Erased reuse'}</strong><span className="small muted">{u.snapshot.company} / answer rev {u.answer_revision}</span><p className="fact-value">{u.snapshot.text}</p></div><div className="answer-row-status"><Pill tone={u.status==='confirmed'?'green':u.status==='invalidated'?'coral':'amber'}>{u.status}</Pill>
    {u.status==='draft'&&<Button label="Review reuse" size="sm" onClick={()=>{setReuse(u);setChecked(false);}} isDisabled={blocked}/>}</div></article>):<EmptyState icon={FileCheck} title="No reuse drafts"/>}
  </section>}
  {draft&&<AnswerDraftDialog key={draft.entry?.id||'new'} api={api} question={draft.question} entry={draft.entry} candidate={candidate} onClose={()=>setDraft(null)} onSaved={async()=>{await load();await refresh();setDraft(null);setTab('library');}}/>}
  <Dialog isOpen={Boolean(removeQuestion)} onOpenChange={v=>{if(!v&&!busy)setRemoveQuestion(null);}} purpose="form" width={560}>
   <DialogHeader title="Delete unanswered question?" onOpenChange={busy?undefined:()=>setRemoveQuestion(null)}/>
   <div className="dialog-form">{error&&<Banner>{error}</Banner>}<p>{removeQuestion?.exact_text}</p><span className="small muted">{removeQuestion?.company}</span>
    <div className="dialog-actions"><Button label="Cancel" onClick={()=>setRemoveQuestion(null)} isDisabled={blocked}/>
     <Button label="Delete question" variant="destructive" icon={<Glyph icon={Trash2}/>} isDisabled={blocked} onClick={()=>removeQuestion&&void act('delete question',async()=>{await command('delete_question',{questionId:removeQuestion.id,reason:'Explicit user question erasure'});setRemoveQuestion(null);setLookup(null);})}/></div>
   </div>
  </Dialog>
  <Dialog isOpen={Boolean(inspect)} onOpenChange={v=>{if(!v&&!busy)setInspect(null);}} purpose="form" width={720}>
   <DialogHeader title="Inspect answer" onOpenChange={()=>setInspect(null)}/><div className="dialog-form">{error&&<Banner>{error}</Banner>}
    <h3>{inspect?.question}</h3><div className="fact-meta"><span>{inspect?.company} / {inspect?.context.roleLane}</span><Pill>{inspect?.status} / rev {inspect?.revision}</Pill></div>
    <pre className="answer-full-text">{inspect?.text||'Erased answer'}</pre><dl className="workspace-properties"><div><dt>Reuse</dt><dd>{inspect?.permission}</dd></div><div><dt>Sensitivity</dt><dd>{inspect?.sensitivity}</dd></div>
     <div><dt>Model disclosure</dt><dd>{inspect?.model_consent?'Allowed':'Denied'}</dd></div><div><dt>Expires</dt><dd>{inspect&&formatDate(inspect.expires_at)}</dd></div><div><dt>Evidence</dt><dd>{inspect?.facts.length?inspect.facts.map(f=>f.id+' rev '+f.revision).join('; '):'Exact user declaration'}</dd></div></dl>
    {inspect?.status==='draft'&&<label className="binary-option"><input type="checkbox" checked={checked} onChange={e=>setChecked(e.target.checked)}/>I confirm this exact answer, evidence and reuse permissions.</label>}
    {inspect&&inspect.status!=='deleted'&&<TextInput label="Revocation or deletion reason" value={why} onChange={setWhy}/>}
    <div className="dialog-actions">
     {inspect?.status==='draft'&&<Button label="Approve answer" variant="primary" icon={<Glyph icon={Check}/>} isDisabled={blocked||!checked||inspect.expired} onClick={()=>inspect&&void act('approve',async()=>{await command('approve_answer',{answerId:inspect.id,expectedRevision:inspect.revision,contentHash:inspect.content_hash,declarationConfirmed:true});setInspect(null);})}/>}
     {inspect&&inspect.status!=='deleted'&&<><Button label="Draft correction" icon={<Glyph icon={Pencil}/>} onClick={()=>edit(inspect)} isDisabled={blocked}/>
      <Button label="Revoke answer" icon={<Glyph icon={X}/>} isDisabled={blocked||why.trim().length<3||inspect.status==='revoked'} onClick={()=>void act('revoke',async()=>{await command('revoke_answer',{answerId:inspect.id,expectedRevision:inspect.revision,reason:why});setInspect(null);})}/>
      <Button label="Delete answer" variant="destructive" icon={<Glyph icon={Trash2}/>} isDisabled={blocked||why.trim().length<3} onClick={()=>void act('delete',async()=>{await command('delete_answer',{answerId:inspect.id,expectedRevision:inspect.revision,reason:why});setInspect(null);})}/></>}
    </div>
   </div>
  </Dialog>
  <Dialog isOpen={Boolean(reuse)} onOpenChange={v=>{if(!v&&!busy)setReuse(null);}} purpose="form" width={660}>
   <DialogHeader title="Review answer reuse" onOpenChange={()=>setReuse(null)}/><div className="dialog-form">{error&&<Banner>{error}</Banner>}<h3>{reuse?.snapshot.question}</h3>
    <div className="fact-meta"><span>{reuse?.snapshot.company}</span><span>Answer revision {reuse?.answer_revision}</span></div><pre className="answer-full-text">{reuse?.snapshot.text}</pre>
    <label className="binary-option"><input type="checkbox" checked={checked} onChange={e=>setChecked(e.target.checked)}/>I reviewed the exact target context and answer revision.</label>
    <div className="dialog-actions"><Button label="Cancel" onClick={()=>setReuse(null)} isDisabled={blocked}/><Button label="Confirm reuse" variant="primary" icon={<Glyph icon={Check}/>} isDisabled={blocked||!checked} onClick={()=>reuse&&void act('confirm reuse',async()=>{await command('confirm_reuse',{useId:reuse.id,expectedRevision:reuse.revision,contentHash:reuse.snapshot.contentHash,reviewed:true});setReuse(null);setTab('uses');})}/></div>
   </div>
  </Dialog>
 </div>;
}
function AnswerDraftDialog({api,question,entry,candidate,onClose,onSaved}:{api:WorkspaceApi;question:{text:string;company:string;roleLane:string;locale:string;answerType:string;options:string[];tags:string[]};entry?:Answer;candidate:Candidate;onClose:()=>void;onSaved:()=>Promise<void>}){
 const [value,setValue]=useState(entry?.text||''),[permission,setPermission]=useState(entry?.permission||'company'),[model,setModel]=useState(entry?.model_consent||false),[privateReuse,setPrivateReuse]=useState(entry?.sensitive_consent||false);
 const [refs,setRefs]=useState<Ref[]>(entry?.facts||[]),[days,setDays]=useState<number|null>(180),[error,setError]=useState(''),[busy,setBusy]=useState(false);
 const attempt=useRef<{payload:string;id:string}|null>(null),questionAttempt=useRef(crypto.randomUUID()),savedQuestion=useRef<string|null>(entry?.question_id||null);
 async function save(e:FormEvent){e.preventDefault();if(busy)return;setBusy(true);setError('');
  try{
   if(days===null||!Number.isInteger(days)||days<1||days>365)throw Error('Choose retention from 1 to 365 days.');
   if(!savedQuestion.current){const q=await api.post<{result:Question}>('/api/answers/commands',{commandId:questionAttempt.current,action:'save_question',payload:question});savedQuestion.current=q.result.id;}
   const payload={questionId:savedQuestion.current,text:value,facts:refs,permission,modelConsent:model,sensitiveConsent:privateReuse,retentionDays:days,expectedCandidateRevision:candidate.candidate.revision,...(entry?{answerId:entry.id,expectedRevision:entry.revision}:{})};
   const serialized=JSON.stringify(payload);if(attempt.current?.payload!==serialized)attempt.current={payload:serialized,id:crypto.randomUUID()};
   await api.post('/api/answers/commands',{commandId:attempt.current.id,action:'draft_answer',payload});await onSaved();
  }catch(e){setError(errorMessage(e));}finally{setBusy(false);}
 }
 return <Dialog isOpen onOpenChange={v=>{if(!v&&!busy)onClose();}} purpose="form" width={730}><DialogHeader title={entry?'Draft answer correction':'Record an answer'} onOpenChange={busy?undefined:onClose}/>
  <form className="dialog-form" onSubmit={save}>{error&&<Banner>{error}</Banner>}<h3>{question.text}</h3><span className="small muted">{question.company} / {question.roleLane}</span>
   <TextArea label="Exact answer" value={value} onChange={setValue} rows={5} isRequired isDisabled={busy}/>
   <Selector label="Reuse permission" value={permission} onChange={setPermission} isDisabled={busy} options={[{value:'company',label:'This company and compatible context'},{value:'cross_company',label:'Compatible cross-company context'},{value:'never',label:'History only, no reuse'}]}/>
   <div className="answer-consent"><label className="binary-option"><input type="checkbox" checked={model} onChange={e=>setModel(e.target.checked)} disabled={busy}/>Allow this standard answer in future model context</label>
    <label className="binary-option"><input type="checkbox" checked={privateReuse} onChange={e=>setPrivateReuse(e.target.checked)} disabled={busy}/>Allow local private answer reuse after review</label></div>
   <NumberInput label="Answer retention (days)" value={days} onChange={setDays} min={1} max={365} isIntegerOnly hasClear isDisabled={busy} width={180}/>
   <details className="answer-evidence"><summary>Supporting confirmed facts ({refs.length})</summary>{candidate.facts.map(f=><label className="evidence-choice" key={f.id}><input type="checkbox" checked={refs.some(r=>r.id===f.id)} disabled={busy} onChange={e=>setRefs(old=>e.target.checked?[...old.filter(r=>r.id!==f.id),{id:f.id,revision:f.revision}]:old.filter(r=>r.id!==f.id))}/>
    <span><strong>{f.field_key} / rev {f.revision}</strong><span>{text(f.value)}</span>{refs.some(r=>r.id===f.id&&r.revision!==f.revision)&&<b>Evidence changed. Review this selection again.</b>}</span></label>)}
    {!candidate.facts.length&&<p className="small muted">No confirmed facts. This answer records your exact declaration.</p>}</details>
   <div className="dialog-actions"><Button label="Cancel" onClick={onClose} isDisabled={busy}/><Button label="Save answer draft" type="submit" variant="primary" icon={<Glyph icon={FileCheck}/>} isLoading={busy}/></div>
  </form>
 </Dialog>;
}

