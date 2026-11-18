import fs from 'node:fs';
import path from 'node:path';
import {setTimeout as wait} from 'node:timers/promises';
import {config} from '../../src/server/config.ts';
import {database} from '../../src/server/db.ts';
import {claimWork} from '../../src/server/work.ts';
import {gmailWork} from '../../src/worker/gmail.ts';

const c=config();
if(!c.testMode)throw Error('Fixture worker refuses production');
const script=()=>JSON.parse(fs.readFileSync(path.join(c.privateRoot,'gmail-worker-script.json'),'utf8'));
let current;
const provider={
 async profile(){return {emailAddress:'fixture@example.test',historyId:'100'};},
 async refresh(t){return t;},
 async thread(_token,id){
  const s=script();process.send?.({kind:'thread',workId:current.id});
  if(s.pauseThread===id)await wait(30000);
  return s.messages.filter(m=>m.threadId===id);
 },
 async history(){return script().history;},
 async message(_token,id){return script().messages.find(m=>m.id===id);},
 async revoke(){},
};
try{
 for(let i=0;i<20;i++){
  current=await claimWork('gmail-fixture-child',45);if(!current)break;
  if(!current.kind.startsWith('gmail_'))throw Error('Fixture worker refuses unrelated work');
  await gmailWork(current,new AbortController().signal,provider);
 }
}catch{process.exitCode=1;}
finally{await database().end();process.disconnect?.();}
