import "dotenv/config";

import { assessOperationalReadiness } from "../lib/operational-readiness.mjs";
import { createStore } from "../lib/sqlite-store.mjs";
import {readApplicationProjection} from '../lib/canonical-application-read.mjs';
import {withWorkspace} from '../lib/workspace-client.mjs';
const projection=readApplicationProjection();
if(projection){
 try{
  const current=await withWorkspace(request=>request('/api/applications'));
  console.log(JSON.stringify({operationalReady:current.authority.owner==='canonical',ownership:current.authority.owner,asOf:current.asOf,projectionAsOf:projection.asOf,scope:'S5 evaluation/packet/manual tracking. Browser S6, Gmail S7, Discord S8 and networking/analytics S9 are separate acceptance gates.'},null,2));
 }catch{console.error(JSON.stringify({operationalReady:false,message:'Canonical workspace unavailable. Offline projections do not prove operational readiness.'}));process.exitCode=1;}
 process.exit(process.exitCode||0);
}

const strict = process.argv.includes("--strict");
const result = assessOperationalReadiness({ store: createStore() });

console.log(JSON.stringify(result, null, 2));

if (strict && !result.operationalReady) {
  process.exit(1);
}
