'use client';
import {useState} from 'react';
import {Button} from '@astryxdesign/core/Button';
import {Selector} from '@astryxdesign/core/Selector';
import {TextInput} from '@astryxdesign/core/TextInput';
import {Check,Globe2,Save,X,ArrowLeft,ArrowRight} from 'lucide-react';
import {Banner,Glyph,Pill,ToolButton} from './shared';

export type SearchPreferences={families:string[];extraAliases:string[];excludedTitles:string[];explorationPerSource:number;detailRequestsPerSource:number;responsibilityGroupsRequired:number;includeUnverifiedLocations?:boolean;seniorityLevels?:string[]};
export type SearchProfileData={current:{revision:number;candidate_revision:number;stale:boolean;value:SearchPreferences&{titleAliases:string[];responsibilityGroups:unknown[]}}|null;candidateRevision:number;evidenceCount:number;suggested:SearchPreferences;families:{id:string;label:string}[];seniorities:{id:string;label:string}[]};
export type ProfileProposal={id:string;value:SearchPreferences;quote:string;expected_revision:number;candidate_revision:number};
export type Capability={id:string;kind:string;region:string;query:string;description:string;state:string;reason:string;permission:string};
type Act=(action:string,payload:unknown)=>Promise<boolean|undefined>;
export function MarketSetup({profile,proposals,blocked,act}:{profile:SearchProfileData;proposals:ProfileProposal[];blocked:boolean;act:Act}){
 const original=profile.current?.value||profile.suggested;
 const [families,setFamilies]=useState(original.families),[aliases,setAliases]=useState(original.extraAliases.join(', ')),[excluded,setExcluded]=useState(original.excludedTitles.join(', '));
 const [details,setDetails]=useState(original.detailRequestsPerSource),[explore,setExplore]=useState(original.explorationPerSource),[groups,setGroups]=useState(original.responsibilityGroupsRequired),[pack,setPack]=useState('us_tech');
 const [unverified,setUnverified]=useState(original.includeUnverifiedLocations===true);
 const [levels,setLevels]=useState(original.seniorityLevels??profile.suggested.seniorityLevels??[]);
 return <section className="knowledge-section market-setup" aria-label="Broad market setup">
  <div className="knowledge-toolbar"><h3>Broad market</h3><Pill tone={profile.current&&!profile.current.stale?'green':'amber'}>{profile.current?.stale?'Profile needs review':profile.current?'Profile ready':'Profile not reviewed'}</Pill></div>
  <div className="market-pack-row"><Selector label="Source pack" value={pack} onChange={setPack} isDisabled={blocked} options={[{value:'us_tech',label:'US technology and startups'},{value:'reverse_ats',label:'Reverse ATS discovery'},{value:'remote',label:'Remote boards' }]}/><Button label="Enable source pack" icon={<Glyph icon={Globe2}/>} size="sm" isDisabled={blocked} onClick={()=>void act('enable_source_pack',{pack})}/></div>
  <details open={!profile.current||profile.current.stale}><summary>Search profile</summary><form className="market-profile-form" onSubmit={e=>{e.preventDefault();void act('save_search_profile',{expectedRevision:profile.current?.revision||0,expectedCandidateRevision:profile.candidateRevision,profile:{families,extraAliases:aliases.split(',').map(s=>s.trim()).filter(Boolean),excludedTitles:excluded.split(',').map(s=>s.trim()).filter(Boolean),explorationPerSource:explore,detailRequestsPerSource:details,responsibilityGroupsRequired:groups,includeUnverifiedLocations:unverified,seniorityLevels:levels}});}}>
   <p className="small muted">Candidate revision {profile.candidateRevision} / {profile.evidenceCount} approved professional fields</p>
   {!profile.evidenceCount&&<Banner tone="warning">Candidate knowledge needs review.</Banner>}
   <fieldset className="market-families"><legend>Work families</legend>{profile.families.map(f=><label className="binary-option" key={f.id}><input type="checkbox" checked={families.includes(f.id)} disabled={blocked} onChange={e=>setFamilies(p=>e.target.checked?[...p,f.id]:p.filter(id=>id!==f.id))}/>{f.label}</label>)}</fieldset>
   <fieldset className="market-families"><legend>Target experience levels</legend><label className="binary-option"><input type="checkbox" checked={!levels.length} disabled={blocked} onChange={()=>setLevels([])}/>Any level</label>{profile.seniorities.map(s=><label className="binary-option" key={s.id}><input type="checkbox" checked={levels.includes(s.id)} disabled={blocked} onChange={e=>setLevels(p=>e.target.checked?[...p,s.id]:p.filter(id=>id!==s.id))}/>{s.label}</label>)}</fieldset>
   <TextInput label="Additional title aliases" value={aliases} onChange={setAliases} isDisabled={blocked}/>
   <details><summary>Screening and exploration</summary><label className="binary-option"><input type="checkbox" checked={unverified} onChange={e=>setUnverified(e.target.checked)} disabled={blocked}/>Include unverified locations for review</label><div className="intelligence-grid">
    <label>Detail requests / source<input type="number" min={0} max={8} value={details} onChange={e=>setDetails(Number(e.target.value))} disabled={blocked}/></label>
    <label>Title-miss exploration / source<input type="number" min={0} max={10} value={explore} onChange={e=>setExplore(Number(e.target.value))} disabled={blocked}/></label>
    <label>Responsibility groups required<input type="number" min={1} max={4} value={groups} onChange={e=>setGroups(Number(e.target.value))} disabled={blocked}/></label>
   </div><TextInput label="Excluded titles" value={excluded} onChange={setExcluded} isDisabled={blocked}/></details>
   <Button label="Save search profile" icon={<Glyph icon={Save}/>} variant="primary" type="submit" size="sm" isDisabled={blocked||!families.length||!profile.evidenceCount}/>
  </form></details>
  {proposals.map(p=><div className="market-profile-proposal" key={p.id}><h4>Proposed search profile</h4><p className="small">{p.quote}</p><dl className="connection-limits"><div><dt>Work families</dt><dd>{p.value.families.join(', ').replaceAll('_',' ')}</dd></div><div><dt>Detail / exploration limit</dt><dd>{p.value.detailRequestsPerSource} / {p.value.explorationPerSource}</dd></div></dl><details><summary>Exact proposed preferences</summary><pre className="discovery-lineage">{JSON.stringify(p.value,null,2)}</pre></details><div className="inline-actions"><Button label="Approve search profile" size="sm" icon={<Glyph icon={Check}/>} isDisabled={blocked} onClick={()=>void act('approve_search_profile',{id:p.id})}/><ToolButton label="Reject search profile" icon={X} disabled={blocked} onClick={()=>void act('reject_search_profile',{id:p.id})}/></div></div>)}
 </section>;
}
export function ProviderCatalog({providers,sources}:{providers:Capability[];sources:{provider:string;enabled:boolean;status:string;checked_at:string|null}[]}){
 const [query,setQuery]=useState(''),[kind,setKind]=useState('all'),[page,setPage]=useState(0);
 const matches=providers.filter(p=>(kind==='all'||p.kind===kind)&&(p.id+' '+p.region).includes(query.toLowerCase())),size=25,maxPage=Math.max(0,Math.ceil(matches.length/size)-1),current=Math.min(page,maxPage);
 return <section className="knowledge-section" aria-label="Provider catalog"><div className="market-catalog-filters"><TextInput label="Find provider" value={query} onChange={v=>{setQuery(v);setPage(0);}}/><Selector label="Source type" value={kind} onChange={v=>{setKind(v);setPage(0);}} options={['all','board_wide','tenant_ats','single_employer','local_parser'].map(value=>({value,label:value.replaceAll('_',' ')}))}/></div>
  <p className="small muted">{providers.length} installed / {matches.length} matching</p><div className="archive-table-wrap"><table className="archive-table market-catalog"><thead><tr><th>Provider</th><th>Scope</th><th>Runtime state</th><th>Evidence and access</th></tr></thead><tbody>{matches.slice(current*size,(current+1)*size).map(p=>{
   const configured=sources.filter(s=>s.provider.replace(/^reverse:/,'')===p.id),recent=configured.find(s=>s.checked_at);
   const state=['blocked','retired'].includes(p.state)?p.state:recent?.status||(!configured.length?'unconfigured':configured.some(s=>s.enabled)?'enabled':'disabled');
   return <tr key={p.id}><td><strong>{p.id}</strong></td><td>{p.kind.replaceAll('_',' ')}<br/><span className="small muted">{p.region.replaceAll('_',' ')}</span></td><td><Pill tone={['success','empty_success'].includes(state)?'green':'amber'}>{state.replaceAll('_',' ')}</Pill></td><td><details><summary>{p.description.replaceAll('_',' ')}</summary><p>{p.reason}</p><p>{p.permission}</p><p>Query: {p.query.replaceAll('_',' ')}</p></details></td></tr>;
  })}</tbody></table></div><div className="inline-actions"><ToolButton label="Previous catalog page" icon={ArrowLeft} disabled={current===0} onClick={()=>setPage(current-1)}/><span className="small">{current+1} / {maxPage+1}</span><ToolButton label="Next catalog page" icon={ArrowRight} disabled={current===maxPage} onClick={()=>setPage(current+1)}/></div>
 </section>;
}
