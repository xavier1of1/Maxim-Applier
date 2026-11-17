import { database, transaction } from './db';
import { config, publicModelSettings } from './config';
import { reauthorize, type Context } from './auth';
import { notFound } from './errors';
import { uuid } from './commands';
export async function snapshot(ctx: Context) {
 return transaction(async db=>{
 await db.query('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY');
 const w=ctx.workspaceId;
 const workspace=(await db.query('SELECT id,name,is_owner FROM workspaces WHERE id=$1',[w])).rows[0];
 const jobs=(await db.query('SELECT j.*,a.id AS application_id FROM jobs j LEFT JOIN applications a ON a.job_id=j.id AND a.workspace_id=j.workspace_id WHERE j.workspace_id=$1 ORDER BY j.updated_at DESC,j.id LIMIT 500',[w])).rows;
 const applications=(await db.query('SELECT a.*,j.company,j.title,j.location FROM applications a JOIN jobs j ON j.id=a.job_id AND j.workspace_id=a.workspace_id WHERE a.workspace_id=$1 ORDER BY a.updated_at DESC,a.id LIMIT 500',[w])).rows;
 const events=(await db.query('SELECT id,entity_id,event_type,revision,payload,created_at FROM events WHERE workspace_id=$1 ORDER BY sequence DESC LIMIT 100',[w])).rows;
 const conversations=(await db.query('SELECT id,title,job_id,updated_at FROM conversations WHERE workspace_id=$1 ORDER BY updated_at DESC,id LIMIT 100',[w])).rows;
 const proposals=(await db.query('SELECT p.id,p.job_id,p.note,p.expected_revision,p.status,p.expires_at,p.created_at FROM proposals p JOIN runs r ON r.id=p.run_id AND r.workspace_id=p.workspace_id WHERE p.workspace_id=$1 AND p.status=$2 AND p.expires_at>now() AND r.status=$3 AND p.session_id=$4 ORDER BY p.created_at DESC',[w,'pending','completed',ctx.sessionId])).rows;
 const artifacts=(await db.query('SELECT id,job_id,name,bytes,content_type,created_at FROM artifacts WHERE workspace_id=$1 ORDER BY created_at DESC LIMIT 500',[w])).rows;
 return {workspace,jobs,applications,events,conversations,proposals,artifacts,settings:{model:publicModelSettings(),testMode:config().testMode,ownership:'new_workspace'},
  asOf:new Date().toISOString(),sourceStatus:jobs.length===500?'partial':jobs.length?'fresh':'empty'};
 });
}
export async function getJob(ctx: Context, id: string) {
 uuid.parse(id);
 const r=await database().query('SELECT * FROM jobs WHERE workspace_id=$1 AND id=$2',[ctx.workspaceId,id]);
 if(!r.rows[0])throw notFound();
 return r.rows[0];
}
export async function getConversation(ctx: Context,id: string) {
 uuid.parse(id);
 await transaction(async tx=>{
  await reauthorize(tx,ctx);
  const stale=(await tx.query('SELECT active_run FROM conversations WHERE id=$1 AND workspace_id=$2 AND active_run IS NOT NULL AND lease_until<now() FOR UPDATE',[id,ctx.workspaceId])).rows[0];
  if(stale){
   await tx.query('UPDATE runs SET status=$1,error_code=$2,completed_at=now() WHERE id=$3 AND workspace_id=$4 AND status=$5',['failed','interrupted',stale.active_run,ctx.workspaceId,'running']);
   await tx.query('UPDATE proposals SET status=$1 WHERE run_id=$2 AND workspace_id=$3 AND status=$4',['cancelled',stale.active_run,ctx.workspaceId,'pending']);
   await tx.query('UPDATE conversations SET active_run=null,lease_until=null WHERE id=$1 AND workspace_id=$2',[id,ctx.workspaceId]);
  }
 });
 return transaction(async db=>{
 await db.query('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY');
 const conversation=(await db.query('SELECT * FROM conversations WHERE id=$1 AND workspace_id=$2',[id,ctx.workspaceId])).rows[0];
 if(!conversation)throw notFound();
 const messages=(await db.query('SELECT id,role,content,run_id,created_at FROM messages WHERE conversation_id=$1 AND workspace_id=$2 ORDER BY sequence',[id,ctx.workspaceId])).rows;
 const runs=(await db.query('SELECT id,status,error_code,usage,created_at FROM runs WHERE conversation_id=$1 AND workspace_id=$2 ORDER BY created_at',[id,ctx.workspaceId])).rows;
 const proposals=(await db.query('SELECT p.id,p.run_id,p.job_id,p.note,p.expected_revision,p.status,p.expires_at FROM proposals p JOIN runs r ON r.id=p.run_id AND r.workspace_id=p.workspace_id WHERE r.conversation_id=$1 AND p.workspace_id=$2 ORDER BY p.created_at',[id,ctx.workspaceId])).rows;
 return {conversation,messages,runs,proposals};
 });
}
