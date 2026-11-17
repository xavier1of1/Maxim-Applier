import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';

export const assetRoot=fileURLToPath(new URL('../.cache/tokenizers/',import.meta.url));
export const encodings={
 o200k_base:'446a9538cb6c348e3516120d7c08b09f57c36495e2acfffe59a5bf8b0cfb1a2d',
 cl100k_base:'223921b76ee99bde995b7ff738513eef100fb51d18c93597a113bcffe865b2a7',
};
export const hash=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
export async function prepareTokenizers(){
 fs.mkdirSync(assetRoot,{recursive:true});
 for(const[name,expected]of Object.entries(encodings)){
  const target=path.join(assetRoot,name+'.tiktoken');
  if(fs.existsSync(target)&&!fs.lstatSync(target).isSymbolicLink()&&hash(fs.readFileSync(target))===expected)continue;
  const response=await fetch('https://openaipublic.blob.core.windows.net/encodings/'+name+'.tiktoken',{redirect:'error',signal:AbortSignal.timeout(30000)});
  if(!response.ok||!response.body)throw Error('Official tokenizer asset unavailable.');
  const chunks=[],reader=response.body.getReader();let total=0;
  try{for(let n=0;n<10000;n++){const p=await reader.read();if(p.done)break;total+=p.value.length;if(total>5*1024*1024)throw Error('Tokenizer asset exceeds limit.');chunks.push(p.value);}}
  finally{await reader.cancel().catch(()=>{});}
  const bytes=Buffer.concat(chunks);if(hash(bytes)!==expected)throw Error('Tokenizer asset checksum mismatch.');
  const temp=target+'.'+crypto.randomUUID()+'.new';fs.writeFileSync(temp,bytes,{flag:'wx'});fs.renameSync(temp,target);
  console.log('Verified official '+name+' tokenizer asset.');
 }
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))prepareTokenizers().catch(()=>{console.error('Tokenizer setup failed; no runtime download fallback is permitted.');process.exitCode=1;});

