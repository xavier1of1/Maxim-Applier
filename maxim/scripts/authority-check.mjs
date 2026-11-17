import {readAuthority,assertLegacyWriteAllowed,assertNativeCandidateCurrent} from '../lib/authority-gate.mjs';
import {readApplicationProjection} from '../lib/canonical-application-read.mjs';

const [family='candidate',operation='read']=process.argv.slice(2);
try{
 if(!['candidate','applications'].includes(family)||!['read','write'].includes(operation))throw Error('Use candidate|applications read|write.');
 if(operation==='write')assertLegacyWriteAllowed(family);
 else if(family==='candidate')await assertNativeCandidateCurrent();
 else readApplicationProjection();
 console.log(JSON.stringify({ok:true,family,operation,owner:readAuthority()[family]||'legacy'}));
}catch(e){console.error(JSON.stringify({ok:false,message:e.message}));process.exitCode=1;}
