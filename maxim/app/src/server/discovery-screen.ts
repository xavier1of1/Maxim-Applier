import {domain} from './domain';
import type {UpstreamRow} from './upstream-discovery';
export type ScreeningDecision={index:number;keep:boolean;explore:boolean;reason:string;matchedGroups:unknown[]};
export function screenDiscovery(rows:UpstreamRow[],profile:Record<string,unknown>,full:(row:UpstreamRow)=>boolean){
 const decisions:ScreeningDecision[]=[];
 // Bounded batches keep the Rust stdin contract and synchronous work below its limits.
 for(let start=0;start<rows.length;start+=20){
  const jobs=rows.slice(start,start+20).map((row,i)=>({index:start+i,title:String(row.title||'').slice(0,240),description:String(row.description||'').slice(0,6000),full:full(row)}));
  decisions.push(...domain({operation:'screen_discovery',profile,jobs}).decisions as ScreeningDecision[]);
 }
 return decisions;
}
