import {runWorkspaceCommand} from '../lib/workspace-client.mjs';
try{console.log(JSON.stringify(await runWorkspaceCommand(),null,2));}
catch(error){console.error(JSON.stringify({ok:false,message:error.message}));process.exitCode=1;}
