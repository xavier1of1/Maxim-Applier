import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {config} from '../../config';
import {invariant} from '../../errors';

function directory() {
 const root=path.join(config().privateRoot,'gmail');
 fs.mkdirSync(root,{recursive:true,mode:0o700});
 invariant(!fs.lstatSync(root).isSymbolicLink(),'gmail_storage_unsafe','Gmail private storage must not be a link.',503);
 if(process.platform==='win32'){
  const user=execFileSync('whoami',{encoding:'utf8',windowsHide:true}).trim();
  execFileSync('icacls',[root,'/inheritance:r','/grant:r',user+':(OI)(CI)F','SYSTEM:(OI)(CI)F'],{stdio:'ignore',windowsHide:true});
 }else fs.chmodSync(root,0o700);
 return root;
}
function filename(key:string) {
 invariant(key==='client'||/^[0-9a-f-]{36}$/.test(key),'gmail_storage_key','Invalid Gmail private key.');
 return path.join(directory(),key+'.json');
}
export function readPrivate<T>(key:string):T {
 const file=filename(key);
 invariant(!fs.lstatSync(file).isSymbolicLink()&&fs.statSync(file).size<=65536,'gmail_storage_unsafe','Gmail private file is unsafe.',503);
 if(process.platform!=='win32')invariant((fs.statSync(file).mode&0o077)===0,'gmail_storage_unsafe','Gmail private file permissions are unsafe.',503);
 return JSON.parse(fs.readFileSync(file,'utf8')) as T;
}
export function writePrivate(key:string,value:unknown) {
 const target=filename(key),temp=target+'.'+crypto.randomUUID()+'.new';
 try{fs.writeFileSync(temp,JSON.stringify(value),{flag:'wx',mode:0o600});fs.renameSync(temp,target);}
 finally{fs.rmSync(temp,{force:true});}
}
export function removePrivate(key:string) {fs.rmSync(filename(key),{force:true});}
