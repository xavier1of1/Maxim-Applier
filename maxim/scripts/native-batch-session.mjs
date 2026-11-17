import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {beginLegacyApplicationWrite,applicationWriteEnvironment,attachApplicationWriterChild} from '../lib/application-write-gate.mjs';
const root=fileURLToPath(new URL('../../',import.meta.url)),release=beginLegacyApplicationWrite(root);
try{
 if(process.argv[2]==='--verify-lease'){release();process.exit(0);}
 const child=spawn('bash',[fileURLToPath(new URL('../../batch/batch-runner.sh',import.meta.url)),...process.argv.slice(2)],{cwd:root,stdio:'inherit',windowsHide:true,env:{...process.env,...applicationWriteEnvironment(root)}});
 if(child.pid)attachApplicationWriterChild(child.pid,root);
 process.exitCode=await new Promise((resolve,reject)=>{child.once('error',reject);child.once('close',code=>resolve(code??1));});
}finally{release();}
