import fs from 'node:fs';
import {spawnSync} from 'node:child_process';
const docker=spawnSync('docker',['info','--format','{{.ServerVersion}}'],{encoding:'utf8',windowsHide:true,timeout:15000});
if(docker.error||docker.status!==0){console.error('Integration tests require a responsive Docker engine. Check Docker Desktop and free disk space; no tests were counted as passed.');process.exit(1);}
const files=fs.readdirSync(new URL('./integration/',import.meta.url)).filter(n=>n.endsWith('.test.mjs')).sort().map(n=>'tests/integration/'+n);
const result=spawnSync(process.execPath,['--import','tsx','--test','--test-concurrency=1',...files],{stdio:'inherit',windowsHide:true});
process.exit(result.status??1);
