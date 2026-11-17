import type {PoolClient} from 'pg';
import {enqueue} from './work';
import {invariant} from './errors';
export async function applicationLock(tx:PoolClient,w:string){
 await tx.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',['applications:'+w]);
 await tx.query('INSERT INTO application_authority(workspace_id) VALUES($1) ON CONFLICT DO NOTHING',[w]);
 return (await tx.query('SELECT * FROM application_authority WHERE workspace_id=$1 FOR UPDATE',[w])).rows[0];
}
export async function applicationWritable(tx:PoolClient,w:string){
 const row=await applicationLock(tx,w);
 invariant(row.owner!=='staging','application_frozen','Application reconciliation is staged/frozen. Finish or recover the reviewed cutover before editing.',409);
 invariant(row.owner!=='legacy'||!row.transition_id,'legacy_owner_active','Legacy writers own applications after rollback. Review a new import/cutover before editing them here.',409);return row;
}
export async function queueApplicationProjection(tx:PoolClient,w:string){
 const row=await applicationLock(tx,w);if(row.owner!=='canonical')return;
 const rev=(await tx.query('UPDATE application_authority SET revision=revision+1,updated_at=now() WHERE workspace_id=$1 RETURNING revision',[w])).rows[0].revision;
 await enqueue(tx,w,'project_applications',String(rev),{revision:rev,transitionId:row.transition_id});
}
