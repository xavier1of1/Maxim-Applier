import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {readAuthority} from './authority-gate.mjs';
const defaultRoot=fileURLToPath(new URL('../../',import.meta.url));
export function readApplicationProjection(root=defaultRoot,file='data/maxim/canonical-application-state.json'){
 const marker=readAuthority(root),owner=marker.applications||'legacy';
 if(owner==='legacy')return null;
 if(owner!=='canonical')throw Error('Application projections are frozen; wait for reviewed recovery.');
 if(!['data/maxim/canonical-application-state.json','data/maxim/dashboard-state.json'].includes(file))throw Error('Unsupported application projection.');
 let target=fs.realpathSync(root);
 for(const part of file.split('/')){target=path.join(target,part);if(fs.lstatSync(target).isSymbolicLink())throw Error('Linked application projection refused.');}
 const stat=fs.statSync(target);if(!stat.isFile()||stat.size>64*1024*1024)throw Error('Application projection exceeds its read bounds.');
 const bytes=fs.readFileSync(target),hash=crypto.createHash('sha256').update(bytes).digest('hex');
 if(hash!==marker.applicationFiles?.[file])throw Error('Application projection integrity failed; do not use stale SQLite as fallback.');
 const value=JSON.parse(bytes);
 if(value.ownership!=='canonical'||value.revision!==marker.applicationRevision)throw Error('Application projection identity/revision mismatch.');
 return {...value,offlineProjection:true,freshness:'as_of_projection_not_live_database'};
}
