'use client';
import {useEffect,useId,useState} from 'react';
import {useSearchParams} from 'next/navigation';
import {TextInput} from '@astryxdesign/core/TextInput';
import {Selector} from '@astryxdesign/core/Selector';
import {Search,RotateCcw,SlidersHorizontal} from 'lucide-react';
import {ToolButton} from './shared';
import type {Navigation,WorkspaceData} from './types';
import {locationFilters} from './role-triage';

export function JobFilters({data,navigate}:{data:WorkspaceData;navigate:(n:Navigation)=>void}){
 const q=useSearchParams(),[search,setSearch]=useState(q.get('q')||'');
 const [expanded,setExpanded]=useState(false),panelId=useId();
 const current=q.get('q')||'';
 useEffect(()=>setSearch(current),[current]);
 useEffect(()=>{if(search===current)return;const timer=setTimeout(()=>navigate({q:search||null,offset:null}),300);return()=>clearTimeout(timer);},[search,current,navigate]);
 const set=(key:keyof Navigation,value:string)=>navigate({[key]:value||null,offset:null});
 const count=['company','industry','lane','age','minScore','maxScore','fit','location'].filter(key=>q.get(key)).length+(q.get('filter')==='archived'?1:0)+(q.has('locationGroup')&&q.get('locationGroup')!=='focus'?1:0);
 const select=(label:string,key:keyof Navigation,options:{value:string;label:string}[])=><Selector label={label} value={q.get(key)||(key==='filter'?'active':key==='locationGroup'?'focus':'')} onChange={v=>set(key,v)} options={options} hasSearch={options.length>30} width="100%" size="sm"/>;
 return <div className="job-filter-fields">
  <div className="job-search-row">
  <TextInput label="Search roles" isLabelHidden type="search" placeholder="Search roles..." value={search} onChange={setSearch} startIcon={Search} hasClear width="100%"/>
  <button type="button" className="job-filter-toggle" aria-label="Filter jobs" title="Filter jobs" aria-expanded={expanded} aria-controls={panelId} onClick={()=>setExpanded(v=>!v)}><SlidersHorizontal size={17} aria-hidden="true"/>{count>0&&<span className="filter-count">{count}</span>}</button></div>
  <div id={panelId} className="job-filter-panel" role="region" aria-label="Job filters" hidden={!expanded} onKeyDown={e=>{if(e.key==='Escape'){setExpanded(false);document.querySelector<HTMLButtonElement>('.job-filter-toggle')?.focus();}}}>
   {select('Role status','filter',[{value:'active',label:'Active roles'},{value:'archived',label:'Archived roles'}])}
   {q.get('filter')!=='archived'&&select('Filter roles by location','locationGroup',locationFilters)}
  <div className="filter-pair">{select('Posted','age',[{value:'',label:'Any posting date'},{value:'today',label:'Posted today'},{value:'7',label:'Past week'},{value:'30',label:'Past month'},{value:'unknown',label:'Date unknown'}])}
  {select('Minimum score','minScore',[{value:'',label:'Any score'},{value:'3.5',label:'3.5+'},{value:'4',label:'4.0+ (T2+)'},{value:'4.5',label:'4.5+ (T3)'}])}</div>
   {(['company','industry','lane']as const).map(key=><div key={key}>{select(key==='lane'?'Role type':key==='industry'?'Industry':'Company',key,[{value:'',label:'All '+(key==='lane'?'role types':key==='industry'?'industries':'companies')},...(data.facets?.[key]||[]).map(value=>({value,label:value}))])}</div>)}
   {select('Evaluation','fit',[{value:'',label:'Any evaluation state'},{value:'current',label:'Current score'},{value:'unscored',label:'Without current score'}])}
   {select('Maximum score','maxScore',[{value:'',label:'No maximum'},{value:'3.4',label:'Below 3.5 (T0)'},{value:'3.9',label:'Up to 3.9'},{value:'4.4',label:'Up to 4.4'}])}
   <TextInput label="Location contains" value={q.get('location')||''} onChange={v=>set('location',v)} hasClear/>
   <ToolButton label="Reset job filters" icon={RotateCcw} onClick={()=>navigate({q:null,filter:null,company:null,industry:null,lane:null,age:null,minScore:null,maxScore:null,fit:null,location:null,locationGroup:'focus',offset:null})}/>
  </div>
 </div>;
}
