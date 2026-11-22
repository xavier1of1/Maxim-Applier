'use client';
import {useCallback,useEffect,useRef,useState,type FormEvent} from 'react';
import {Button} from '@astryxdesign/core/Button';
import {TextInput} from '@astryxdesign/core/TextInput';
import {Selector} from '@astryxdesign/core/Selector';
import {Dialog,DialogHeader} from '@astryxdesign/core/Dialog';
import {Bookmark,Check,ExternalLink,Plus,RefreshCw,Search,Undo2,X} from 'lucide-react';
import {type WorkspaceApi,errorMessage} from './api';
import {Banner,EmptyState,Glyph,Pill,ToolButton,formatDate} from './shared';
import type {Navigation} from './types';
import {locationFilters,locationMatches,rolePolicyLabel,runResultIds} from './role-triage';
import {fitLabel,roleSorts,sortRoles,type JobFit} from './role-fit';
import {MarketSetup,ProviderCatalog,type SearchProfileData,type ProfileProposal,type Capability} from './discovery-market';

type Source={id:string;name:string;provider:string;board:string;careers_url:string;revision:number;enabled:boolean;status:string;status_reason:string|null;checked_at:string|null;next_retry_at:string|null;stale:boolean};
type Run={id:string;revision:number;status:string;work_status:string;work_error:string|null;counts:Record<string,number>;terms:string[];created_at:string;filters:Record<string,unknown>;candidate_revision:number;preference_provenance:unknown[];source_snapshots:Source[]};
type Attempt={id:string;run_id:string;run_revision:number;source_id:string;status:string;error_code:string|null;fallback:string|null;page_count:number;record_count:number;coverage?:Record<string,unknown>};
type Job={id:string;company:string;title:string;location:string;revision:number;url:string;source_platform:string;application_url:string;opening_key:string;archived:boolean;discovery_state:string;posted_at:string|null;first_seen_at:string;last_seen_at:string;updated_at:string;fit?:JobFit|null;discovery_policy:{eligibility:string;flags:{flagType:string;reason:string;severity:string}[]}};
type Observation={job_id:string;run_id:string;source_id:string;identity_conflict:boolean;observed_at:string;date_basis:string};
type Data={sources:Source[];runs:Run[];attempts:Attempt[];jobs:Job[];observations:Observation[];partial:Record<string,boolean>;asOf:string;searchProfile:SearchProfileData;profileProposals:ProfileProposal[];catalog:{providers:Capability[]};capacity:{active:number;limit:number;available:boolean}};
const readable=(s:string)=>s.replaceAll('_',' ');
export function DiscoveryView({api,disabled,refresh,asOf,navigate,sort='score_desc'}:{api:WorkspaceApi;disabled:boolean;refresh:()=>Promise<void>;asOf:string;navigate:(n:Navigation)=>void;sort?:string}){
 const [data,setData]=useState<Data|null>(null),[error,setError]=useState(''),[readError,setReadError]=useState(''),[busy,setBusy]=useState(false);
 const [tab,setTab]=useState('search'),[terms,setTerms]=useState(''),[selected,setSelected]=useState<string[]>([]),[open,setOpen]=useState(false),[runId,setRunId]=useState('');
 const [location,setLocation]=useState('focus'),[matchIn,setMatchIn]=useState('title_and_description');
 const [source,setSource]=useState({name:'',provider:'greenhouse',board:'',careersUrl:''});
 const active=useRef(false),sequence=useRef(0),attempts=useRef(new Map<string,string>());
 const load=useCallback(async()=>{const n=++sequence.current;try{const r=await api.get<Data>('/api/discovery?sort='+sort);if(n===sequence.current){setData(r);setReadError('');}}catch(e){if(n===sequence.current)setReadError(errorMessage(e));}},[api,sort]);
 useEffect(()=>{void load();return()=>{sequence.current++;};},[load,asOf]);
 const running=Boolean(data?.runs.some(r=>['queued','running'].includes(r.status)&&r.work_status!=='failed')||data?.jobs.some(j=>['queued','running'].includes(j.fit?.status||'')));
 useEffect(()=>{
  if(!running)return;let cancelled=false,timer:ReturnType<typeof setTimeout>|undefined,release:(()=>void)|undefined;
  void(async()=>{for(let poll=0;poll<45&&!cancelled;poll++){
   await new Promise<void>(resolve=>{release=resolve;timer=setTimeout(resolve,2000);});
   if(!cancelled&&!document.hidden&&navigator.onLine)await load();
  }})();
  return()=>{cancelled=true;if(timer)clearTimeout(timer);release?.();};
 },[load,running]);
 const blocked=disabled||Boolean(readError)||busy;
 async function act(action:string,payload:unknown){
  if(blocked||active.current)return;active.current=true;setBusy(true);setError('');
  const key=JSON.stringify({action,payload}),commandId=attempts.current.get(key)||crypto.randomUUID();attempts.current.set(key,commandId);
  try{const response=await api.post<{result:{id?:string;sources?:Source[]}}>('/api/discovery/commands',{commandId,action,payload});attempts.current.delete(key);
   if(action==='start_search'&&response.result.id)setRunId(response.result.id);
   if(action==='enable_source_pack'&&response.result.sources)setSelected(response.result.sources.filter(s=>s.enabled).map(s=>s.id).slice(0,10));
   await load();await refresh();return true;}
  catch(e){setError(errorMessage(e));await load();return false;}finally{active.current=false;setBusy(false);}
 }
 async function add(e:FormEvent){e.preventDefault();if(await act('add_source',{name:source.name,provider:source.provider,board:source.board,...(source.careersUrl?{careersUrl:source.careersUrl}:{})})){setOpen(false);setSource({name:'',provider:'greenhouse',board:'',careersUrl:''});}}
 if(!data)return <div className="knowledge-view">{readError?<EmptyState icon={Search} title="Discovery unavailable" detail={readError} action={<Button label="Retry" icon={<Glyph icon={RefreshCw}/>} onClick={()=>void load()}/>}/>:<p role="status">Loading discovery</p>}</div>;
 const currentRun=data.runs.find(r=>r.id===runId)||data.runs[0];
 const selectedRunIds=runResultIds(data.observations,currentRun?.id);
 const runView=tab==='search'||tab==='history';
 const scoped=data.jobs.filter(j=>tab==='saved'?j.discovery_state==='saved':tab==='dismissed'?j.discovery_state==='dismissed':selectedRunIds.has(j.id)&&!j.archived);
 const visible=sortRoles(runView?scoped.filter(j=>locationMatches(j,location)):scoped,sort);
 const employerCount=new Set(visible.map(j=>j.company)).size;
 const enabled=data.sources.filter(s=>s.enabled&&s.provider!=='manual');
 const ready=selected.filter(id=>enabled.some(s=>s.id===id));
 return <div className="knowledge-view">
  {readError&&<Banner>{readError} Showing last loaded discovery.</Banner>}{error&&<Banner onDismiss={()=>setError('')}>{error}</Banner>}
  {Object.values(data.partial).some(Boolean)&&<Banner tone="warning">This view is limited to recent records. Earlier history remains stored.</Banner>}
  {!data.capacity.available&&<Banner tone="warning">Active leads: {data.capacity.active} / {data.capacity.limit}. New openings are held. <button className="text-link" onClick={()=>navigate({view:'settings',setup:'scoring'})}>Review limits</button></Banner>}
  <div className="knowledge-toolbar"><Selector label="Discovery view" isLabelHidden value={tab} onChange={setTab} width={200} options={[{value:'search',label:'Search'},{value:'history',label:'Past searches'},{value:'saved',label:'Saved'},{value:'dismissed',label:'Dismissed'},{value:'sources',label:'Source health'},{value:'catalog',label:'Provider catalog (153)'}]}/>
   <div className="inline-actions"><Button label="Add source" size="sm" icon={<Glyph icon={Plus}/>} onClick={()=>setOpen(true)} isDisabled={blocked}/><ToolButton label="Refresh discovery" icon={RefreshCw} onClick={()=>void load()} disabled={disabled}/></div></div>
  {tab==='search'&&<MarketSetup key={(data.searchProfile.current?.revision||0)+':'+data.searchProfile.candidateRevision} profile={data.searchProfile} proposals={data.profileProposals} blocked={blocked} act={act}/>}
  {tab==='search'&&<section className="knowledge-section" aria-label="Start job search"><form className="answer-lookup market-search-form" onSubmit={e=>{e.preventDefault();void act('start_search',{sourceIds:ready,matchIn,terms:terms.split(',').map(t=>t.trim()).filter(Boolean)});}}>
   <TextInput label="Role terms" value={terms} onChange={setTerms} isDisabled={blocked}/>
   <Selector label="Match role terms in" value={matchIn} onChange={setMatchIn} options={[{value:'title',label:'Titles'},{value:'title_and_description',label:'Titles and descriptions'}]}/>
   <details open={enabled.length<=3}><summary>Selected public boards ({ready.length}/10)</summary><fieldset className="source-choice"><legend>Source selection</legend>{enabled.map(s=><label className="binary-option" key={s.id}><input type="checkbox" checked={ready.includes(s.id)} disabled={blocked||ready.length>=10&&!ready.includes(s.id)} onChange={e=>setSelected(ids=>e.target.checked?[...ids,s.id]:ids.filter(id=>id!==s.id))}/>{s.name}<span className="muted small">{s.provider}</span></label>)}{!enabled.length&&<p className="muted">No enabled public feeds.</p>}</fieldset></details>
   <Button label="Search jobs" type="submit" variant="primary" icon={<Glyph icon={Search}/>} isDisabled={blocked||!ready.length||ready.length>10} isLoading={busy}/>
  </form></section>}
  {(tab==='history'||tab==='search')&&currentRun&&<section className="knowledge-section" aria-label="Search history">
   <div className="knowledge-toolbar"><Selector label="Search run" value={currentRun.id} onChange={setRunId} width="100%" options={data.runs.map(r=>({value:r.id,label:formatDate(r.created_at,true)+' - '+r.terms.join(', ')+' - '+readable(r.status)}))}/></div>
   <div className="fact-title"><Pill tone={currentRun.status==='completed'?'green':'amber'}>{readable(currentRun.work_status==='failed'?'worker failed':currentRun.status)}</Pill><span className="small muted">{currentRun.counts.matched??0} matches · {currentRun.counts.created??0} new openings</span></div>
   <dl className="market-coverage">{[['Sources',currentRun.counts.sourceCount],['Employers',currentRun.counts.uniqueEmployers],['Returned jobs',currentRun.counts.returned],['Requests',currentRun.counts.requests],['Uninspected jobs',currentRun.counts.uninspected],['Uninspected tenants',currentRun.counts.uninspectedTenants],['Incomplete JDs',currentRun.counts.missingDescriptions]].filter(([,value])=>value!==undefined).map(([label,value])=><div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>
   <details><summary>Query and coverage lineage</summary><pre className="discovery-lineage">{JSON.stringify({id:currentRun.id,revision:currentRun.revision,terms:currentRun.terms,filters:currentRun.filters,candidateRevision:currentRun.candidate_revision,preferenceProvenance:currentRun.preference_provenance,sources:currentRun.source_snapshots.map(s=>({id:s.id,name:s.name,provider:s.provider,revision:s.revision})),counts:currentRun.counts,workError:currentRun.work_error},null,2)}</pre></details>
   {data.attempts.filter(a=>a.run_id===currentRun.id&&a.run_revision===currentRun.revision).map(a=><div key={a.id} className="discovery-attempt"><strong>{data.sources.find(s=>s.id===a.source_id)?.name||a.source_id}</strong><Pill tone={['success','empty_success'].includes(a.status)?'green':'amber'}>{readable(a.status)}</Pill><span className="small">{a.page_count} pages · {a.record_count} matches</span>{a.error_code&&<span className="small">{readable(a.error_code)}</span>}{a.fallback&&<p className="small muted">{a.fallback}</p>}{a.coverage&&Object.keys(a.coverage).length>0&&<details><summary>Coverage details</summary><pre className="discovery-lineage">{JSON.stringify(a.coverage,null,2)}</pre></details>}</div>)}
   <div className="inline-actions">{['queued','running'].includes(currentRun.status)&&currentRun.work_status!=='failed'?<Button label="Cancel search" icon={<Glyph icon={X}/>} onClick={()=>void act('cancel_search',{runId:currentRun.id,expectedRevision:currentRun.revision})} isDisabled={blocked}/>:['failed','partial','cancelled'].includes(currentRun.status)||currentRun.work_status==='failed'?<Button label="Retry eligible pages" icon={<Glyph icon={RefreshCw}/>} onClick={()=>void act('retry_search',{runId:currentRun.id,expectedRevision:currentRun.revision})} isDisabled={blocked}/>:null}</div>
  </section>}
  {tab==='catalog'?<ProviderCatalog providers={data.catalog.providers} sources={data.sources}/>:tab==='sources'?<section className="knowledge-section" aria-label="Source health">{!data.sources.length?<EmptyState icon={Search} title="No discovery sources" detail="No public boards have been selected."/>:data.sources.map(s=><article className="discovery-source" key={s.id}><div className="fact-title"><strong>{s.name}</strong><Pill tone={s.status==='success'&&!s.stale?'green':'amber'}>{!s.enabled?'disabled':s.stale?'stale':readable(s.status)}</Pill></div><p className="small">{s.provider} · {s.board||'manual review'} · checked {s.checked_at?formatDate(s.checked_at,true):'never'}</p>{s.status_reason&&<p className="small muted">{readable(s.status_reason)}</p>}{s.next_retry_at&&<p className="small">Retry after {formatDate(s.next_retry_at,true)}</p>}<div className="inline-actions"><a href={s.careers_url} target="_blank" rel="noreferrer" className="text-link">Open source <ExternalLink size={12}/></a><label className="binary-option"><input type="checkbox" checked={s.enabled} disabled={blocked} onChange={e=>void act('set_source_enabled',{sourceId:s.id,expectedRevision:s.revision,enabled:e.target.checked})}/>Enabled</label></div></article>)}</section>:<section className="knowledge-section" aria-label="Discovered jobs">
   {runView&&currentRun&&<div className="knowledge-toolbar"><Selector label="Filter discovery by location" isLabelHidden value={location} onChange={setLocation} options={locationFilters} width={210}/>
    <span className="small muted tabular">{visible.length} of {scoped.length} openings / {employerCount} {employerCount===1?'employer':'employers'}</span></div>}
   <Selector label="Sort discovered jobs" value={sort} onChange={value=>navigate({sort:value})} options={roleSorts}/>
   {!visible.length?<EmptyState icon={Search} title={scoped.length?'No openings in this location filter':'No matching records'} detail={tab==='saved'?'No saved openings.':tab==='dismissed'?'No dismissed openings.':undefined}
    action={runView&&scoped.length?<Button label="All locations" onClick={()=>setLocation('all')}/>:undefined}/>:visible.map(j=><article className="discovery-job" key={j.id}><div className="fact-title"><button className="text-link" type="button" onClick={()=>navigate({view:'jobs',job:j.id,filter:j.archived?'archived':'active'})}>{j.title}</button><Pill tone={rolePolicyLabel(j).tone}>{rolePolicyLabel(j).label}</Pill><Pill tone={fitLabel(j.fit).tone}>{fitLabel(j.fit).label}</Pill></div>
    <p>{j.company} <span className="muted">· {j.location||'Location unknown'}</span></p><p className="small muted">Posted {j.posted_at?formatDate(j.posted_at):'unknown'} · First seen {formatDate(j.first_seen_at,true)} · Checked {formatDate(j.last_seen_at,true)}</p>
    <details><summary>Policy and source</summary><ul>{j.discovery_policy.flags?.map((f,i)=><li key={i}>{f.reason}</li>)}</ul><p className="small">Discovery: {j.source_platform} · Original: <a className="text-link" href={j.url} target="_blank" rel="noreferrer">posting</a> · Destination: <a className="text-link" href={j.application_url} target="_blank" rel="noreferrer">application</a></p>{data.observations.some(o=>o.job_id===j.id&&o.identity_conflict)&&<Banner tone="warning">Source identity changed. Current role was not overwritten; reconciliation is required.</Banner>}</details>
    <div className="inline-actions"><ToolButton label={j.discovery_state==='saved'?'Unsave opening':'Save opening'} icon={j.discovery_state==='saved'?Check:Bookmark} disabled={blocked} onClick={()=>void act('set_discovery_state',{jobId:j.id,expectedRevision:j.revision,state:j.discovery_state==='saved'?'none':'saved'})}/><ToolButton label={j.discovery_state==='dismissed'?'Restore opening':'Dismiss opening'} icon={j.discovery_state==='dismissed'?Undo2:X} disabled={blocked} onClick={()=>void act('set_discovery_state',{jobId:j.id,expectedRevision:j.revision,state:j.discovery_state==='dismissed'?'none':'dismissed'})}/></div>
   </article>)}
  </section>}
  <Dialog isOpen={open} onOpenChange={setOpen} purpose="form" width={500}><DialogHeader title="Add discovery source" onOpenChange={()=>setOpen(false)}/><form className="dialog-form" onSubmit={add}>
   <TextInput label="Company name" value={source.name} onChange={name=>setSource(s=>({...s,name}))} isRequired isDisabled={blocked}/>
   <Selector label="Provider" value={source.provider} onChange={provider=>setSource(s=>({...s,provider}))} options={[...data.catalog.providers.filter(c=>c.state==='available').map(c=>({value:c.id,label:c.id})),{value:'manual',label:'manual'}]}/>
   {['greenhouse','lever','ashby'].includes(source.provider)?<TextInput label="Board slug" value={source.board} onChange={board=>setSource(s=>({...s,board}))} isRequired/>:<TextInput label="Careers URL" value={source.careersUrl} onChange={careersUrl=>setSource(s=>({...s,careersUrl}))}/>}
   <div className="dialog-actions"><Button label="Cancel" onClick={()=>setOpen(false)}/><Button label="Add source" type="submit" variant="primary" icon={<Glyph icon={Plus}/>} isDisabled={blocked} isLoading={busy}/></div>
  </form></Dialog>
 </div>;
}
