import {database,transaction} from './db';
import {candidateLock} from './sources';
import {eraseAnswer} from './answer-invalidation';
import {event} from './commands';

export async function expireAnswers(){
 const rows=(await database().query("SELECT id,workspace_id FROM answer_memory WHERE status<>'deleted' AND expires_at<now() LIMIT 20")).rows;
 for(const row of rows)await transaction(async tx=>{
  await candidateLock(tx,row.workspace_id);
  const current=(await tx.query("SELECT id FROM answer_memory WHERE workspace_id=$1 AND id=$2 AND status<>'deleted' AND expires_at<now() FOR UPDATE",[row.workspace_id,row.id])).rows[0];
  if(!current)return;
  await eraseAnswer(tx,row.workspace_id,row.id);
  await event(tx,{workspaceId:row.workspace_id},row.id,'answer_retention_expired',{historicalSubmissions:'preserved'});
 });
}

