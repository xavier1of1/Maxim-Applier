import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {repoRoot} from '../../lib/path-utils.mjs';
const appDir=path.join(repoRoot,'maxim','app');

export function closeOwnedBrowsers(c){
 const root=path.join(c.privateRoot,'browser-sessions');if(!fs.existsSync(root))return;
 if(fs.lstatSync(root).isSymbolicLink()||fs.realpathSync(root)!==path.join(fs.realpathSync(c.privateRoot),'browser-sessions'))throw Error('Unsafe browser-session root');
 const env=Object.fromEntries(Object.entries(process.env).filter(([k])=>!/^AGENT_BROWSER_|^AI_GATEWAY_|^BROWSER_USE_/.test(k)));
 for(const entry of fs.readdirSync(root,{withFileTypes:true}).slice(0,100)){
  if(!entry.isDirectory()||!/^[0-9a-f-]{36}$/.test(entry.name))continue;
  const directory=path.join(root,entry.name),file=path.join(directory,'config.json');
  if(fs.lstatSync(directory).isSymbolicLink()||fs.realpathSync(directory)!==directory)throw Error('Linked browser-session directory');
  if(!fs.existsSync(file))continue;
  if(fs.lstatSync(file).isSymbolicLink()||fs.statSync(file).size>16384)throw Error('Unsafe browser configuration');
  const settings=JSON.parse(fs.readFileSync(file,'utf8')),session='maxim-'+entry.name;
  if(settings.session!==session||settings.cdp||settings.autoConnect||settings.provider||settings.extensions?.length||settings.plugins?.length)throw Error('Unexpected browser ownership configuration');
  const pid=path.join(directory,session+'.pid');if(!fs.existsSync(pid))continue;
  execFileSync(process.execPath,[path.join(appDir,'node_modules/agent-browser/bin/agent-browser.js'),'--session',session,'--config',file,'close'],{cwd:appDir,env:{...env,AGENT_BROWSER_SOCKET_DIR:directory,AGENT_BROWSER_NO_VERSION_CHECK:'1'},stdio:'pipe',windowsHide:true,timeout:20000,maxBuffer:65536});
 }
}
