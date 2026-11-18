import {spawnSync} from 'node:child_process';
import {testStorageEnv} from '../lib/test-resources.mjs';
const args=process.argv.slice(2);
if(!args.length)throw Error('Pass the Node test entry point and arguments');
const result=spawnSync(process.execPath,args,{cwd:process.cwd(),env:testStorageEnv(),stdio:'inherit',windowsHide:true});
process.exit(result.status??1);
