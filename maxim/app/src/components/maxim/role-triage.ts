export type PostingPolicy = {eligibility?:string;flags?:{flagType:string;reason:string;severity:string}[]};
type AttributedRole={company:string;opening_key?:string|null;application_id?:string|null;discovery_state?:string;discovery_policy?:PostingPolicy};

export const locationFilters=[
 {value:'focus',label:'Local + tracked'},
 {value:'local',label:'NoVA/DC only'},
 {value:'review',label:'Location needs review'},
 {value:'outside',label:'Outside target area'},
 {value:'all',label:'All locations'},
];

export function locationGroup(role:AttributedRole){
 const flags=role.discovery_policy?.flags||[];
 if(flags.some(f=>f.flagType==='location'&&f.severity==='blocker'))return 'outside';
 if(flags.some(f=>f.flagType==='location'&&f.severity==='positive'))return 'local';
 return 'review';
}

export function locationMatches(role:AttributedRole,filter:string){
 if(filter==='all')return true;
 const group=locationGroup(role);
 if(filter==='focus')return group==='local'||!role.opening_key||Boolean(role.application_id)||role.discovery_state==='saved';
 return group===filter;
}

export function rolePolicyLabel(role:AttributedRole){
 const eligibility=role.discovery_policy?.eligibility;
 return eligibility==='eligible'?{label:'Policy eligible',tone:'green' as const}
  :eligibility==='blocked'?{label:'Policy blocked',tone:'coral' as const}
  :{label:'Needs review',tone:'amber' as const};
}

export function companySpread<T extends {company:string}>(roles:readonly T[]){
 const companies=new Map<string,T[]>();
 for(const role of roles){
  const key=role.company.trim().toLowerCase(),rows=companies.get(key)||[];
  rows.push(role);companies.set(key,rows);
 }
 const queues=[...companies.values()],sorted:T[]=[];
 const max=Math.max(0,...queues.map(q=>q.length));
 for(let index=0;index<max;index++){
  for(const queue of queues){if(queue[index])sorted.push(queue[index]);}
 }
 return sorted;
}

export function runResultIds(observations:readonly {job_id:string;run_id:string}[],runId?:string){
 return new Set(runId?observations.filter(o=>o.run_id===runId).map(o=>o.job_id):[]);
}
