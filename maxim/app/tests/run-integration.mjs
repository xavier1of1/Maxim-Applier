import fs from 'node:fs';
import {spawnSync} from 'node:child_process';
const files=fs.readdirSync(new URL('./integration/',import.meta.url)).filter(n=>n.endsWith('.test.mjs')).sort().map(n=>'tests/integration/'+n);
const result=spawnSync(process.execPath,['--import','tsx','--test','--test-concurrency=1',...files],{stdio:'inherit',windowsHide:true});
process.exit(result.status??1);
