import {extractDocument} from '../server/document-parser';
import {DomainError} from '../server/errors';

let raw='';
console.log=()=>{};
console.warn=()=>{};
for await(const chunk of process.stdin){
 raw+=chunk;
 if(Buffer.byteLength(raw)>15*1024*1024){process.stdout.write(JSON.stringify({error:'input_limit'}));process.exit(1);}
}
try{
 const input=JSON.parse(raw);
 const parsed=await extractDocument(input.name,Buffer.from(input.bytes,'base64'),input.legacyYaml===true);
 process.stdout.write(JSON.stringify(parsed));
}catch(e){
 process.stdout.write(JSON.stringify({error:e instanceof DomainError?e.code:'parser_failed'}));
 process.exitCode=1;
}
