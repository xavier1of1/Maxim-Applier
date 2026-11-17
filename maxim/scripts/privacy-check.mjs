import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const root=path.resolve(fileURLToPath(new URL('../../',import.meta.url))),findings=[];
const git=args=>execFileSync('git',args,{cwd:root,encoding:'utf8',stdio:['ignore','pipe','pipe']});
const files=[...new Set(git(['ls-files','--cached','--others','--exclude-standard','-z']).split('\0').filter(Boolean))];
const privatePaths=['.env','cv.md','article-digest.md','config/profile.yml','modes/_profile.md','portals.yml','applications.md','data/applications.md','data/pipeline.md','data/maxim/authority.json','data/maxim/canonical-events.jsonl','data/maxim/application-write.lock/owner.json','data/maxim/maxim.db-wal'];
for(const file of privatePaths){
 const result=git(['ls-files','--',file]).trim();if(result)findings.push({file,code:'tracked_private_path'});
 try{git(['check-ignore','--quiet','--no-index',file]);}catch{findings.push({file,code:'private_path_not_ignored'});}
}
const values=[];
try{
 const env=fs.readFileSync(path.join(root,'.env'),'utf8');
 for(const line of env.split(/\r?\n/)){const m=line.match(/^\s*([A-Z0-9_]*(?:KEY|TOKEN|SECRET|WEBHOOK)[A-Z0-9_]*)\s*=\s*(.*?)\s*$/);if(!m)continue;const value=m[2].replace(/^(['"])(.*)\1$/,'$2');if(value.length>=20&&!/^(?:your[_-]|replace|example|placeholder|https:\/\/example\.)/i.test(value))values.push(value);}
}catch(e){if(e.code!=='ENOENT')throw e;}
try{
 const file=path.join(process.env.LOCALAPPDATA||'','MaximApply/private/workspace/runtime.json'),c=JSON.parse(fs.readFileSync(file,'utf8'));
 for(const value of [c.bootstrapKey,c.model?.apiKey])if(typeof value==='string'&&value.length>=20)values.push(value);
}catch(e){if(e.code!=='ENOENT')throw e;}
const patterns=[
 ['private_key',/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/],
 ['provider_key',/\bsk-(?:proj-|svcacct-)?[A-Za-z0-9_-]{40,}/],
 ['github_token',/\b(?:ghp_[A-Za-z0-9]{36}|github_pat_[A-Za-z0-9_]{60,})/],
 ['discord_webhook',/https:\/\/(?:discord(?:app)?\.com)\/api\/webhooks\/\d{15,25}\/[A-Za-z0-9_-]{40,}/],
];
let checked=0;
for(const file of files){
 const absolute=path.resolve(root,file);if(!absolute.startsWith(root+path.sep))throw Error('Tracked path escaped root.');
 if(!fs.existsSync(absolute)||!/\.(md|mjs|js|ts|tsx|rs|go|json|sql|yml|yaml|txt|toml|sh)$/.test(file))continue;
 const stat=fs.lstatSync(absolute);if(!stat.isFile()||stat.isSymbolicLink())continue;
 if(stat.size>5*1024*1024){findings.push({file,code:'text_scan_bound_exceeded'});continue;}
 const text=fs.readFileSync(absolute,'utf8');checked++;
 for(const [code,pattern]of patterns)if(pattern.test(text))findings.push({file,code});
 if(values.some(value=>text.includes(value)))findings.push({file,code:'configured_secret_copy'});
}
console.log(JSON.stringify({ok:!findings.length,checked,findings,scope:'Public tracked/unignored text plus known configured-secret copies and ignored private paths. Not a semantic proprietary-content audit.'},null,2));
process.exitCode=findings.length?1:0;
