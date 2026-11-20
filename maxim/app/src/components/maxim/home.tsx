'use client';
import {useCallback,useEffect,useMemo,useRef,useState} from 'react';
import {sankey,sankeyLinkHorizontal,type SankeyNode,type SankeyLink} from 'd3-sankey';
import {Selector} from '@astryxdesign/core/Selector';
import {Button} from '@astryxdesign/core/Button';
import {ArrowRight,BriefcaseBusiness,GitBranch,RefreshCw,Settings2,ShieldCheck} from 'lucide-react';
import {Banner,EmptyState,Glyph,ToolButton,formatDate} from './shared';
import {errorMessage,type WorkspaceApi} from './api';
import type {Navigation} from './types';

type Node={id:string;label:string;color:string};
type Link={source:string;target:string;value:number};
type Data={days:number;timezone:string;asOf:string;flow:{total:number;nodes:Node[];links:Link[]};metrics:{id:string;label:string;value:string|number}[];
 lanes:{lane:string;openings:number;best_score:number;job_id:string;last_checked:string|null}[];setup:{candidate:boolean;model:boolean;sources:boolean;limits:boolean};formulas:{cohort:string;week:string;postingAvailability:string}};
function ApplicationFlow({flow}:{flow:Data['flow']}){
 const viewport=useRef<HTMLDivElement>(null),[width,setWidth]=useState(1040);
 useEffect(()=>{const el=viewport.current;if(!el)return;const resize=()=>setWidth(Math.max(720,el.clientWidth));const observer=new ResizeObserver(resize);resize();observer.observe(el);return()=>observer.disconnect();},[flow]);
 const graph=useMemo(()=>{
  if(!flow.links.length)return null;
  return sankey<Node,{}>().nodeId(n=>n.id).nodeWidth(9).nodePadding(24).nodeSort(null).extent([[14,25],[width-168,355]])({nodes:flow.nodes.map(n=>({...n})),links:flow.links.map(l=>({...l}))});
 },[flow,width]);
 if(!graph)return <EmptyState icon={GitBranch} title="No recorded submissions in this period"/>;
 const path=sankeyLinkHorizontal<Node,{}>();
 return <>
  <div className="sankey-scroll" ref={viewport} tabIndex={0} aria-label="Application flow diagram"><svg viewBox={'0 0 '+width+' 390'} width={width} height="390" role="img" aria-labelledby="flow-title flow-description">
   <title id="flow-title">Application journey</title><desc id="flow-description">{flow.total} unique submitted openings. Only recorded outcomes are shown. A table follows.</desc>
   <g transform="translate(8,0)">{graph.links.map((l,i)=><path key={i} className="flow-link" d={path(l)||''} fill="none" stroke={(l.target as SankeyNode<Node,{}>).color} strokeWidth={Math.max(1,l.width||0)} opacity={0.37}><title>{(l.source as Node).label} to {(l.target as Node).label}: {l.value}</title></path>)}
    {graph.nodes.map(n=><g key={n.id}><rect x={n.x0} y={n.y0} width={(n.x1||0)-(n.x0||0)} height={Math.max(2,(n.y1||0)-(n.y0||0))} fill={n.color}><title>{n.label}: {n.value}</title></rect><text x={(n.x1||0)+7} y={((n.y0||0)+(n.y1||0))/2} dominantBaseline="central" fontSize="11" fill="#273b32"><tspan>{n.label}</tspan><tspan x={(n.x1||0)+7} dy="15" fill="#64756b">{n.value}</tspan></text></g>)}
   </g></svg></div>
  <details className="flow-table"><summary>Flow records</summary><table><thead><tr><th>From</th><th>To</th><th>Applications</th></tr></thead><tbody>{flow.links.map((l,i)=><tr key={i}><td>{l.source}</td><td>{l.target}</td><td>{l.value}</td></tr>)}</tbody></table></details>
 </>;
}
export function HomeView({api,disabled,asOf,navigate}:{api:WorkspaceApi;disabled:boolean;asOf:string;navigate:(n:Navigation)=>void}){
 const [data,setData]=useState<Data|null>(null),[days,setDays]=useState('90'),[error,setError]=useState('');
 const sequence=useRef(0);
 const load=useCallback(async()=>{const n=++sequence.current;try{const result=await api.get<Data>('/api/home?days='+days);if(n===sequence.current){setData(result);setError('');}}catch(e){if(n===sequence.current)setError(errorMessage(e));}},[api,days]);
 useEffect(()=>{void load();return()=>{sequence.current++;};},[load,asOf]);
 if(!data)return <div className="knowledge-view">{error?<Banner>{error}<ToolButton label="Retry Home" icon={RefreshCw} onClick={()=>void load()}/></Banner>:<p role="status">Loading Home</p>}</div>;
 const setup=[{key:'candidate' as const,label:'Review candidate',view:'candidate'},{key:'model' as const,label:'Connect evaluation model',view:'settings'},{key:'sources' as const,label:'Select public sources',view:'discovery'},{key:'limits' as const,label:'Review discovery limits',view:'settings'}].filter(s=>!data.setup[s.key]);
 return <div className="home-view">
  {error&&<Banner>{error}</Banner>}
  {setup.length>0&&<div className="home-setup"><ShieldCheck size={18}/><span>Setup needs review</span><div className="inline-actions">{setup.map(s=><Button key={s.key} label={s.label} variant="ghost" size="sm" icon={<Glyph icon={ArrowRight}/>} onClick={()=>navigate({view:s.view})} isDisabled={disabled}/>)}</div></div>}
  <section className="home-metrics" aria-label="Career activity statistics">{data.metrics.slice(0,8).map(m=><div key={m.id}><span>{m.label}</span><strong className="tabular">{m.value}</strong></div>)}</section>
  <section className="home-flow"><div className="home-section-heading"><div><h3>Application journey</h3><p className="small muted">Confirmed submissions / {data.timezone}</p></div><Selector label="Submission cohort" value={days} onChange={setDays} options={[{value:'30',label:'Past 30 days'},{value:'90',label:'Past 90 days'},{value:'365',label:'Past year'}]} size="sm"/></div>
   {data.days===Number(days)?<ApplicationFlow flow={data.flow}/>:<p role="status">Loading cohort</p>}<p className="small muted">Known posting identities are deduplicated. Missing stages are not invented.</p>
  </section>
  <section className="home-lanes"><div className="home-section-heading"><div><h3>Where to focus next</h3><p className="small muted">Unsubmitted role types / current Career-Ops T2 and T3</p></div><Button label="Discovery settings" icon={<Glyph icon={Settings2}/>} variant="ghost" size="sm" onClick={()=>navigate({view:'settings'})}/></div>
   {!data.lanes.length?<EmptyState compact icon={BriefcaseBusiness} title="No current high-fit shortlist" detail="Current approved evidence, a fresh full posting and a qualifying Career-Ops evaluation are required." action={<Button label="Review jobs" icon={<Glyph icon={ArrowRight}/>} onClick={()=>navigate({view:'jobs',minScore:null,maxScore:null,fit:null,q:null,company:null,industry:null,lane:null,age:null,location:null,offset:null})}/>}/>:<ol className="home-lane-list">{data.lanes.map((lane,i)=><li key={lane.lane}><span className="lane-rank tabular">{String(i+1).padStart(2,'0')}</span><div><h4>{lane.lane}</h4><span className="small muted">{lane.openings} {lane.openings===1?'opening':'openings'} / best fit {lane.best_score.toFixed(1)} / 5{lane.last_checked?' / seen '+formatDate(lane.last_checked):''}</span></div><ToolButton label={'View '+lane.lane+' openings'} icon={ArrowRight} onClick={()=>navigate({view:'jobs',job:lane.job_id,conversation:null,lane:lane.lane,minScore:'4',maxScore:null,fit:null,q:null,company:null,industry:null,age:null,location:null,filter:'active',sort:'score_desc',offset:null,locationGroup:'local'})}/></li>)}</ol>}
   <p className="small muted">Fit reflects approved evidence. Posting availability remains unconfirmed.</p>
  </section>
 </div>;
}
