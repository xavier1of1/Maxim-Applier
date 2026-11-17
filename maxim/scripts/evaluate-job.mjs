import {runWorkspaceCommand} from '../lib/workspace-client.mjs';
try{
 const id=process.argv[2];
 console.log(JSON.stringify(await runWorkspaceCommand(!id||id==='--help'?['help']:['evaluate',id]),null,2));
}catch(error){console.error(JSON.stringify({ok:false,message:error.message}));process.exitCode=1;}
