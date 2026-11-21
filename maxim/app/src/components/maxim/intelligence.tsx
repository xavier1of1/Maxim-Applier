'use client';
import {useCallback,useEffect,useState} from 'react';
import {useSearchParams} from 'next/navigation';
import {Button} from '@astryxdesign/core/Button';
import {TextInput} from '@astryxdesign/core/TextInput';
import {Selector} from '@astryxdesign/core/Selector';
import {Dialog,DialogHeader} from '@astryxdesign/core/Dialog';
import {Archive,ArchiveRestore,ArrowLeft,ArrowRight,Check,Clock,Pause,Play,RefreshCw,Save,Search,Trash2,X} from 'lucide-react';
import {Banner,EmptyState,Glyph,Pill,ToolButton,formatDate} from './shared';
import {errorMessage,type WorkspaceApi} from './api';
import {useBoundedRefresh} from './use-bounded-refresh';
import type {Navigation} from './types';
import type {IntelligencePolicy} from '@/server/intelligence-policy';

type Data={policy:{value:IntelligencePolicy;revision:number;active:boolean};capacity:{active:number;protected:number;limit:number;available:boolean};budget:{requests:number;cents:number;tokens:number};reservation:{tokens:number;cents:number};model:string;sources:{id:string;name:string;provider:string;enabled:boolean;industry:string|null;revision:number}[];
 cycles:{id:string;work_status:string;error_code:string|null;created_at:string;receipt:{selected?:unknown[];holds?:string[]}}[];
 reservations:{id:string;status:string;reserved_cents:number;charged_cents:number|null}[];proposals:{id:string;expected_revision:number;changes:Partial<IntelligencePolicy>;reason:string}[];
 preview:{selected:{id:string;reasons:Record<string,boolean>;evidenceTerms:string[]}[];held:{id:string;reason:string}[];jobs:{id:string;company:string;title:string}[];evidenceAvailable:boolean}};
type Cleanup={fingerprint:string;busy:boolean;jobs:{id:string;company:string;title:string}[];runs:number};
const fields:[keyof IntelligencePolicy,string,number,number,number?][]=[
 ['maxActiveJobs','Active lead limit',20,2000],['scanIntervalMinutes','Scan interval (minutes)',30,10080],['maxMatches','Matches per scan',1,500],
 ['scoreIntervalMinutes','Scoring interval (minutes)',15,10080],['evaluationsPerCycle','Evaluations per cycle',1,20],['evaluationsPerDay','Evaluations per day',1,100],
 ['maxAgeDays','Maximum posting age (days)',1,90],['dailyBudgetCents','Daily allowance (USD cents)',0,10000],['dailyTokenBudget','Daily automatic tokens',1000,20000000],
 ['inputUsdPerMillion','Input price (USD / million tokens)',0,1000,0.001],['outputUsdPerMillion','Output price (USD / million tokens)',0,1000,0.001],
 ['minEvidenceMatches','Minimum approved skill matches',1,10],['idleArchiveDays','Posting / idle retention (days)',1,365],['rawRetentionDays','Raw scan cache retention (days)',1,90],
];
export function IntelligenceSettings({api,disabled,asOf,isOwner,refresh,navigate}:{api:WorkspaceApi;disabled:boolean;asOf:string;isOwner:boolean;refresh:()=>Promise<void>;navigate:(n:Navigation)=>void}){
 const setup=useSearchParams().get('setup');
 const [data,setData]=useState<Data|null>(null),[draft,setDraft]=useState<IntelligencePolicy|null>(null),[error,setError]=useState(''),[notice,setNotice]=useState(''),[busy,setBusy]=useState(false),[ack,setAck]=useState(false),[preview,setPreview]=useState<Cleanup|null>(null);
 const [baseRevision,setBaseRevision]=useState(0);
 const [proposalAck,setProposalAck]=useState<string|null>(null);
 const [termsText,setTermsText]=useState(''),[excludedText,setExcludedText]=useState('');
 const resetDraft=useCallback((p:Data['policy'])=>{setDraft(p.value);setBaseRevision(p.revision);setTermsText(p.value.terms.join(', '));setExcludedText(p.value.excludedTitleTerms.join(', '));setAck(false);},[]);
 const load=useCallback(async()=>{try{const r=await api.get<Data>('/api/intelligence');setData(r);setError('');return r;}catch(e){setError(errorMessage(e));}},[api]);
 useEffect(()=>{void load().then(r=>{if(r)resetDraft(r.policy);});},[load,resetDraft]);
 useEffect(()=>{void load();},[asOf,load]);
 useEffect(()=>{if(data&&['scoring','scoring-proposals'].includes(setup||''))document.getElementById(setup==='scoring-proposals'?'scoring-proposals':'scoring-setup')?.scrollIntoView({block:'start'});},[Boolean(data),setup]);
 const poll=useCallback(async()=>{await load();},[load]);
 useBoundedRefresh(Boolean(data?.cycles.some(c=>['queued','leased'].includes(c.work_status))),poll);
 const change=<K extends keyof IntelligencePolicy>(key:K,value:IntelligencePolicy[K])=>{setDraft(d=>d?{...d,[key]:value}:d);setNotice('');};
 async function act(action:string,payload:unknown,retention=false){
  if(busy||disabled||!isOwner)return;setBusy(true);setError('');setNotice('');
  try{await api.post('/api/intelligence/'+(retention?'retention':'commands'),{commandId:crypto.randomUUID(),action,payload});setPreview(null);setProposalAck(null);const r=await load();if(r)resetDraft(r.policy);setNotice(action==='pause'?'Scheduled work paused. A request already dispatched may still be charged.':'Saved.');await refresh();}
  catch(e){setError(errorMessage(e));}finally{setBusy(false);}
 }
 if(!data||!draft)return <section className="settings-section">{error?<Banner>{error}<ToolButton label="Retry discovery settings" icon={RefreshCw} onClick={()=>void load().then(r=>{if(r)resetDraft(r.policy);})}/></Banner>:<p role="status">Loading discovery settings</p>}</section>;
 const locked=disabled||busy||!isOwner,automated=draft.autoScan||draft.autoScore||draft.cleanupEnabled;
 return <section id="scoring-setup" className="settings-section intelligence-settings">
  <div className="settings-section-title"><Clock size={19}/><h2>Discovery intelligence</h2><Pill tone={data.policy.active?'green':'amber'}>{data.policy.active?'Configured':'Setup required'}</Pill></div>
  {error&&<Banner>{error}</Banner>}{notice&&<Banner tone="success">{notice}</Banner>}
  <dl className="connection-limits"><div><dt>Active leads / capacity</dt><dd>{data.capacity.active} / {data.capacity.limit} ({data.capacity.protected} protected)</dd></div><div><dt>Automatic evaluations today</dt><dd>{data.budget.requests} / {data.policy.value.evaluationsPerDay}</dd></div><div><dt>Reserved + settled cost</dt><dd>${(data.budget.cents/100).toFixed(2)} / ${(data.policy.value.dailyBudgetCents/100).toFixed(2)}</dd></div><div><dt>Conservative request reservation</dt><dd>${(data.reservation.cents/100).toFixed(2)}; {data.reservation.tokens.toLocaleString()} tokens</dd></div></dl>
  {!data.capacity.available&&<Banner tone="warning">Lead capacity reached. Saved records and application evidence are protected.</Banner>}
  {baseRevision!==data.policy.revision&&<Banner tone="warning">Settings changed in another action. <button className="text-link" onClick={()=>resetDraft(data.policy)}>Reload current settings</button></Banner>}
  <form onSubmit={e=>{e.preventDefault();void act('save',{expectedRevision:baseRevision,changes:{...draft,terms:termsText.split(',').map(s=>s.trim()).filter(Boolean),excludedTitleTerms:excludedText.split(',').map(s=>s.trim()).filter(Boolean)},acknowledgeAutomation:ack});}}>
   <div className="inline-actions"><Button label="Score all scanned roles" icon={<Glyph icon={Play}/>} variant="secondary" isDisabled={locked} onClick={()=>{change('scoringScope','all_scanned');change('autoScore',true);setAck(false);setNotice('All scanned active roles selected. Review model prices, daily request/token/cost limits, approve and save below. Nothing has started yet.');}}/></div>
   <Selector label="Scoring scope" value={draft.scoringScope} onChange={v=>change('scoringScope',v as IntelligencePolicy['scoringScope'])} isDisabled={locked} options={[{value:'shortlist',label:'Fresh evidence-matched shortlist'},{value:'all_scanned',label:'All scanned active roles without a current score'}]}/>
   {draft.scoringScope==='all_scanned'&&<Banner tone="info">Scoring includes old, unknown-date and low-priority postings, without relaxing application policy. Current scores are reused. Archived, submitted, incomplete and previously failed/held roles need separate review. This also covers future scans until paused; daily limits still apply.</Banner>}
   <div className="intelligence-toggles">{([['autoScan','Scheduled public-board scans'],['autoScore','Bounded automatic Career-Ops evaluations'],['cleanupEnabled','Daily unprotected lead compaction'],['allowUnknownDates','Admit unknown posting dates']]as const).map(([key,label])=><label key={key}><input type="checkbox" checked={draft[key]} disabled={locked} onChange={e=>change(key,e.target.checked)}/>{label}</label>)}</div>
   <div className="intelligence-grid">{fields.slice(0,11).map(([key,label,min,max,step])=><label key={key}>{label}<input type="number" min={min} max={max} step={step||1} value={Number(draft[key])} onChange={e=>change(key,Number(e.target.value))} disabled={locked} required/></label>)}</div>
   <TextInput label="Pricing reviewed for model ID" value={draft.pricingModel} onChange={v=>change('pricingModel',v)} isDisabled={locked} placeholder={data.model}/>
   <a className="text-link small" href="https://developers.openai.com/api/docs/pricing" target="_blank" rel="noreferrer">OpenAI pricing</a>
   <TextInput label="Target title terms (comma separated)" value={termsText} onChange={v=>{setTermsText(v);setNotice('');}} isDisabled={locked}/>
  <Selector label="Sources per scan" value={String(draft.sourcesPerCycle)} onChange={v=>change('sourcesPerCycle',Number(v))} options={[1,2,3].map(n=>({value:String(n),label:String(n)}))} isDisabled={locked}/>
  <fieldset disabled={locked}><legend>Scheduled source rotation pool</legend><div className="intelligence-toggles source-pool">{data.sources.filter(s=>s.enabled&&s.provider!=='manual').map(s=><label key={s.id}><input type="checkbox" checked={draft.sourceIds.includes(s.id)} onChange={e=>change('sourceIds',e.target.checked?[...draft.sourceIds,s.id]:draft.sourceIds.filter(id=>id!==s.id))}/>{s.name} <span className="muted small">{s.provider}</span></label>)}</div>{!data.sources.some(s=>s.enabled&&s.provider!=='manual')&&<Button label="Select public sources" icon={<Glyph icon={Search}/>} variant="ghost" onClick={()=>navigate({view:'discovery'})}/>}</fieldset>
   <details><summary>Evidence and retention</summary><div className="intelligence-grid">{fields.slice(11).map(([key,label,min,max])=><label key={key}>{label}<input type="number" min={min} max={max} value={Number(draft[key])} onChange={e=>change(key,Number(e.target.value))} disabled={locked}/></label>)}</div><TextInput label="Excluded title terms (comma separated)" value={excludedText} onChange={setExcludedText} isDisabled={locked}/><TextInput label="Policy timezone" value={draft.timezone} onChange={v=>change('timezone',v)} isDisabled={locked}/></details>
   {automated&&<label className="consent-line"><input type="checkbox" checked={ack} disabled={locked} onChange={e=>setAck(e.target.checked)}/>I approve these scheduled requests, automatic spending limits and selected cleanup permissions.</label>}
   <div className="inline-actions"><Button label="Save discovery settings" type="submit" icon={<Glyph icon={Save}/>} variant="primary" isDisabled={locked||(automated&&!ack)}/><Button label="Pause automation" icon={<Glyph icon={Pause}/>} onClick={()=>void act('pause',{})} isDisabled={locked}/><Button label="Run enabled cycle" icon={<Glyph icon={Play}/>} onClick={()=>void act('run',{})} isDisabled={locked||!data.policy.active}/></div>
  </form>
  <div className="section-divider"/>
  <h3>Scoring preview</h3>
  {draft.scoringScope==='shortlist'&&!data.preview.evidenceAvailable&&<Banner tone="warning">No current model-permitted skill evidence. <button className="text-link" onClick={()=>navigate({view:'candidate'})}>Candidate review</button></Banner>}
  <div className="intelligence-preview">{data.preview.selected.map(s=>{const j=data.preview.jobs.find(j=>j.id===s.id);return <div className="intelligence-preview-row" key={s.id}><button className="text-link" onClick={()=>navigate({view:'jobs',job:s.id})}>{j?.company} / {j?.title}</button><span className="muted small">{s.evidenceTerms.join(', ')}; {Object.keys(s.reasons).filter(k=>s.reasons[k]).join(', ')||'eligible evidence match'}</span></div>;})}</div>
  <details><summary>{data.preview.held.length} held from automatic scoring</summary><div className="intelligence-preview">{data.preview.held.slice(0,25).map(s=>{const j=data.preview.jobs.find(j=>j.id===s.id);return <div className="intelligence-preview-row" key={s.id}><button className="text-link" onClick={()=>navigate({view:'jobs',job:s.id})}>{j?.company} / {j?.title}</button><span className="small muted">{s.reason.replaceAll('_',' ')}</span></div>;})}</div></details>
  <h3>Recent cycles</h3>{!data.cycles.length?<p className="muted small">No cycles recorded.</p>:data.cycles.slice(0,5).map(c=><div className="intelligence-preview-row" key={c.id}><span>{formatDate(c.created_at,true)} / {c.work_status}</span><span className="muted small">{c.receipt.selected?.length||0} queued; {c.error_code||c.receipt.holds?.join(', ').replaceAll('_',' ')||'no holds'}</span></div>)}
  {data.reservations.some(r=>r.status==='uncertain')&&<Banner tone="warning">An interrupted request has uncertain usage. Its allowance remains reserved; no automatic retry will be sent.</Banner>}
  <div id="scoring-proposals">{data.proposals.map(p=>{
   const needsApproval=data.policy.value.autoScan||data.policy.value.autoScore||data.policy.value.cleanupEnabled||p.changes.autoScan||p.changes.autoScore||p.changes.cleanupEnabled;
   return <div id={'settings-proposal-'+p.id} className="settings-proposal" key={p.id}><h3>Agent settings proposal</h3><p>{p.reason}</p>
    <dl>{Object.entries(p.changes).map(([key,value])=><div key={key}><dt>{key}</dt><dd>{JSON.stringify(value)}</dd></div>)}</dl>
    {needsApproval&&<label className="consent-line"><input type="checkbox" checked={proposalAck===p.id} disabled={locked||p.expected_revision!==data.policy.revision} onChange={e=>setProposalAck(e.target.checked?p.id:null)}/>I approve the proposed settings and automation limits.</label>}
    <div className="inline-actions"><Button label="Approve settings proposal" icon={<Glyph icon={Check}/>} isDisabled={locked||p.expected_revision!==data.policy.revision||Boolean(needsApproval&&proposalAck!==p.id)} onClick={()=>void act('approve_proposal',{id:p.id,acknowledgeAutomation:proposalAck===p.id})}/><Button label="Reject settings proposal" icon={<Glyph icon={X}/>} isDisabled={locked} onClick={()=>void act('reject_proposal',{id:p.id})}/></div>
   </div>;
  })}</div>
  <h3>Compact history</h3><div className="inline-actions"><Button label="Preview cleanup" icon={<Glyph icon={Archive}/>} isDisabled={locked||!data.policy.active} onClick={()=>{void api.get<Cleanup>('/api/intelligence/cleanup').then(setPreview).catch(e=>setError(errorMessage(e)));}}/><Button label="Open archive" icon={<Glyph icon={ArchiveRestore}/>} onClick={()=>navigate({view:'archive'})}/></div>
  <details><summary>Owner-confirmed source industries</summary><div className="intelligence-preview">{data.sources.map(s=><SourceIndustry key={s.id} source={s} api={api} disabled={locked} reload={poll}/>)}</div></details>
  <Dialog isOpen={Boolean(preview)} onOpenChange={v=>{if(!v)setPreview(null);}} width={600} purpose="form"><DialogHeader title="Review compact history" onOpenChange={()=>setPreview(null)}/><div className="dialog-form">{preview&&<><p>{preview.jobs.length} unprotected leads; {preview.runs} expired raw scan caches.</p>{preview.busy&&<Banner tone="warning">Active application work prevents cleanup.</Banner>}<ul>{preview.jobs.slice(0,10).map(j=><li key={j.id}>{j.company} / {j.title}</li>)}</ul><p className="small muted">Retained: identity, dates, location, qualifications, historical score and provenance. Full descriptions and unreferenced reports are removed. Saved jobs, notes, references and application evidence are protected.</p><Button label="Confirm compaction" icon={<Glyph icon={Trash2}/>} variant="destructive" isDisabled={locked||preview.busy||(!preview.jobs.length&&!preview.runs)} onClick={()=>void act('compact',{fingerprint:preview.fingerprint,confirmed:true},true)}/></>}</div></Dialog>
 </section>;
}
function SourceIndustry({source:s,api,disabled,reload}:{source:Data['sources'][number];api:WorkspaceApi;disabled:boolean;reload:()=>Promise<void>}){
 const [value,setValue]=useState(s.industry||''),[error,setError]=useState(''),[busy,setBusy]=useState(false);
 useEffect(()=>setValue(s.industry||''),[s.industry]);
 return <div><div className="source-industry"><TextInput label={s.name+' industry'} value={value} onChange={setValue} isDisabled={disabled||busy}/><ToolButton label={'Save '+s.name+' industry'} icon={Save} disabled={disabled||busy||value===(s.industry||'')} onClick={()=>{setBusy(true);void api.post('/api/discovery/commands',{commandId:crypto.randomUUID(),action:'set_source_industry',payload:{sourceId:s.id,expectedRevision:s.revision,industry:value}}).then(reload).catch(e=>setError(errorMessage(e))).finally(()=>setBusy(false));}}/></div>{error&&<Banner>{error}</Banner>}</div>;
}

type ArchiveData={jobs:{job_id:string;title:string;company:string;location:string|null;posted_at:string|null;archived_at:string;qualifications:string;score:number|null;tier:string|null;industry:string|null;role_lane:string|null;source:string|null;reason:string}[];total:number;more:boolean};
export function ArchiveView({api,disabled,asOf,refresh,isOwner,navigate}:{api:WorkspaceApi;disabled:boolean;asOf:string;refresh:()=>Promise<void>;isOwner:boolean;navigate:(n:Navigation)=>void}){
 const [data,setData]=useState<ArchiveData|null>(null),[q,setQ]=useState(''),[offset,setOffset]=useState(0),[error,setError]=useState(''),[busy,setBusy]=useState(false);
 const load=useCallback(async()=>{try{setData(await api.get('/api/archive?offset='+offset+'&q='+encodeURIComponent(q)));setError('');}catch(e){setError(errorMessage(e));}},[api,offset,q]);
 useEffect(()=>{const timer=setTimeout(()=>void load(),200);return()=>clearTimeout(timer);},[load,asOf]);
 async function restore(id:string){setBusy(true);try{await api.post('/api/intelligence/retention',{commandId:crypto.randomUUID(),action:'restore',payload:{jobId:id}});await refresh();navigate({view:'jobs',job:id});}catch(e){setError(errorMessage(e));}finally{setBusy(false);}}
 return <div className="knowledge-view">{error&&<Banner>{error}<ToolButton label="Retry archive" icon={RefreshCw} onClick={()=>void load()}/></Banner>}<div className="discovery-toolbar"><TextInput label="Search compact history" value={q} onChange={v=>{setQ(v);setOffset(0);}} startIcon={Search} hasClear/><span>{data?.total||0} archived jobs</span><ToolButton label="Previous archive page" icon={ArrowLeft} disabled={!offset} onClick={()=>setOffset(Math.max(0,offset-50))}/><ToolButton label="Next archive page" icon={ArrowRight} disabled={!data?.more} onClick={()=>setOffset(offset+50)}/></div>
  {!data?<p role="status">Loading compact history</p>:!data.jobs.length?<EmptyState icon={Archive} title="No compact history"/>:<div className="archive-table-wrap"><table className="archive-table"><thead><tr><th>Company / role</th><th>Posted / location</th><th>Historical fit</th><th>Qualifications</th><th>Archived</th><th/></tr></thead><tbody>{data.jobs.map(j=><tr key={j.job_id}><td><strong>{j.company}</strong><br/>{j.title}<br/><span className="small muted">{j.industry||'Unknown industry'} / {j.role_lane||'Unclassified'}</span></td><td>{j.posted_at?formatDate(j.posted_at):'Date unknown'}<br/>{j.location||'Location unknown'}</td><td>{j.score==null?'Not evaluated':Number(j.score).toFixed(1)+' / 5 '+(j.tier||'')}<br/><span className="small muted">Historical only</span></td><td><details><summary>Source qualifications</summary><p className="archive-qualifications">{j.qualifications||'Not available in source'}</p></details></td><td>{formatDate(j.archived_at)}<br/>{j.reason}</td><td><ToolButton label={'Restore '+j.company+' role'} icon={ArchiveRestore} disabled={disabled||busy||!isOwner} onClick={()=>void restore(j.job_id)}/></td></tr>)}</tbody></table></div>}
 </div>;
}
