'use client';
import {useEffect,useState} from 'react';
import {useSearchParams} from 'next/navigation';
import {TextInput} from '@astryxdesign/core/TextInput';
import {Selector} from '@astryxdesign/core/Selector';
import {Search,RotateCcw} from 'lucide-react';
import {ToolButton} from './shared';
import type {Navigation,WorkspaceData} from './types';

export function JobFilters({data,navigate}:{data:WorkspaceData;navigate:(n:Navigation)=>void}){
 const q=useSearchParams(),[search,setSearch]=useState(q.get('q')||'');
 const current=q.get('q')||'';
 useEffect(()=>setSearch(current),[current]);
 useEffect(()=>{if(search===current)return;const timer=setTimeout(()=>navigate({q:search||null,offset:null}),300);return()=>clearTimeout(timer);},[search,current,navigate]);
 const set=(key:keyof Navigation,value:string)=>navigate({[key]:value||null,offset:null});
 const select=(label:string,key:keyof Navigation,options:{value:string;label:string}[])=><Selector label={label} value={q.get(key)||''} onChange={v=>set(key,v)} options={options} width="100%" size="sm"/>;
 return <div className="job-filter-fields">
  <TextInput label="Search roles" isLabelHidden type="search" placeholder="Search roles..." value={search} onChange={setSearch} startIcon={Search} hasClear width="100%"/>
  <div className="filter-pair">{select('Posted','age',[{value:'',label:'Any posting date'},{value:'today',label:'Posted today'},{value:'7',label:'Past week'},{value:'30',label:'Past month'},{value:'unknown',label:'Date unknown'}])}
  {select('Minimum score','minScore',[{value:'',label:'Any score'},{value:'3.5',label:'3.5+'},{value:'4',label:'4.0+ (T2+)'},{value:'4.5',label:'4.5+ (T3)'}])}</div>
  <details><summary>More filters</summary><div className="job-filter-fields">
   {(['company','industry','lane']as const).map(key=><div key={key}>{select(key==='lane'?'Role type':key==='industry'?'Industry':'Company',key,[{value:'',label:'All '+(key==='lane'?'role types':key==='industry'?'industries':'companies')},...(data.facets?.[key]||[]).map(value=>({value,label:value}))])}</div>)}
   {select('Evaluation','fit',[{value:'',label:'Any evaluation state'},{value:'current',label:'Current score'},{value:'unscored',label:'Without current score'}])}
   {select('Maximum score','maxScore',[{value:'',label:'No maximum'},{value:'3.4',label:'Below 3.5 (T0)'},{value:'3.9',label:'Up to 3.9'},{value:'4.4',label:'Up to 4.4'}])}
   <TextInput label="Location contains" value={q.get('location')||''} onChange={v=>set('location',v)} hasClear/>
   <ToolButton label="Reset job filters" icon={RotateCcw} onClick={()=>navigate({q:null,company:null,industry:null,lane:null,age:null,minScore:null,maxScore:null,fit:null,location:null,locationGroup:'focus',offset:null})}/>
  </div></details>
 </div>;
}
