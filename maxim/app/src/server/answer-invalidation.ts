import type {PoolClient} from 'pg';

export async function invalidateAnswerUses(tx:PoolClient,workspaceId:string,answerId:string){
 await tx.query("UPDATE answer_dependencies SET status='invalidated' WHERE workspace_id=$1 AND answer_id=$2",[workspaceId,answerId]);
 await tx.query("UPDATE answer_uses SET status='invalidated',revision=revision+1,updated_at=now() WHERE workspace_id=$1 AND answer_id=$2 AND status IN ('draft','confirmed')",[workspaceId,answerId]);
}
export async function invalidateFactAnswers(tx:PoolClient,workspaceId:string,factIds:string[]){
 if(!factIds.length)return;
 const rows=(await tx.query("UPDATE answer_memory SET status='invalidated',revision=revision+1,updated_at=now() WHERE workspace_id=$1 AND status IN ('draft','approved') AND id IN (SELECT answer_id FROM answer_fact_refs WHERE workspace_id=$1 AND fact_id=ANY($2::uuid[])) RETURNING *",[workspaceId,factIds])).rows;
 for(const row of rows){
  await tx.query('INSERT INTO answer_versions(workspace_id,answer_id,revision,snapshot) VALUES($1,$2,$3,$4)',[workspaceId,row.id,row.revision,JSON.stringify(row)]);
  await tx.query('INSERT INTO answer_fact_refs(workspace_id,answer_id,answer_revision,fact_id,fact_revision) SELECT workspace_id,answer_id,$3,fact_id,fact_revision FROM answer_fact_refs WHERE workspace_id=$1 AND answer_id=$2 AND answer_revision=$3-1',[workspaceId,row.id,row.revision]);
  await invalidateAnswerUses(tx,workspaceId,row.id);
 }
}
export async function eraseAnswer(tx:PoolClient,workspaceId:string,answerId:string){
 await invalidateAnswerUses(tx,workspaceId,answerId);
 const row=(await tx.query("UPDATE answer_memory SET text='',status='deleted',model_consent=false,sensitive_consent=false,revision=revision+1,updated_at=now() WHERE workspace_id=$1 AND id=$2 RETURNING *",[workspaceId,answerId])).rows[0];
 if(!row)return;
 await tx.query("UPDATE answer_versions SET snapshot=jsonb_build_object('redacted',true,'reason','answer_deleted') WHERE workspace_id=$1 AND answer_id=$2",[workspaceId,answerId]);
 await tx.query("UPDATE answer_uses SET snapshot=jsonb_build_object('redacted',true,'reason','answer_deleted') WHERE workspace_id=$1 AND answer_id=$2 AND status<>'submitted'",[workspaceId,answerId]);
 await tx.query("UPDATE commands SET result=jsonb_build_object('redacted',true,'reason','answer_deleted') WHERE workspace_id=$1 AND (result->>'id'=$2::text OR result->>'id' IN(SELECT id::text FROM answer_uses WHERE workspace_id=$1 AND answer_id=$2::uuid))",[workspaceId,answerId]);
 const runs=(await tx.query("SELECT entity_id AS id FROM answer_dependencies WHERE workspace_id=$1 AND answer_id=$2 AND kind='context' UNION SELECT origin_run AS id FROM answer_memory WHERE workspace_id=$1 AND id=$2 AND origin_run IS NOT NULL",[workspaceId,answerId])).rows.map(r=>r.id);
 if(runs.length){
  await tx.query("UPDATE messages SET content=jsonb_build_object('text','[Answer-derived content erased]','redacted',true) WHERE workspace_id=$1 AND run_id=ANY($2::uuid[])",[workspaceId,runs]);
  await tx.query("UPDATE runs SET status='cancelled',error_code='answer_deleted',completed_at=now() WHERE workspace_id=$1 AND id=ANY($2::uuid[]) AND status='running'",[workspaceId,runs]);
  await tx.query("UPDATE conversations SET title='Redacted conversation',active_run=null,lease_until=null WHERE workspace_id=$1 AND (active_run=ANY($2::uuid[]) OR id IN(SELECT conversation_id FROM runs WHERE workspace_id=$1 AND id=ANY($2::uuid[])))",[workspaceId,runs]);
 }
 const erased=await tx.query("UPDATE answer_questions q SET exact_text='[Question erased]',normalized_text='',company='[erased]',context='{}',context_hash='',tags='{}',identity_hash='deleted:'||id WHERE q.workspace_id=$1 AND (q.id=$2 OR q.id IN(SELECT question_id FROM answer_uses WHERE workspace_id=$1 AND answer_id=$3)) AND NOT EXISTS(SELECT 1 FROM answer_memory a WHERE a.workspace_id=$1 AND a.question_id=q.id AND a.status<>'deleted') AND NOT EXISTS(SELECT 1 FROM answer_uses u WHERE u.workspace_id=$1 AND u.question_id=q.id AND u.status IN ('draft','confirmed')) RETURNING id",[workspaceId,row.question_id,answerId]);
 if(erased.rowCount)await tx.query("UPDATE commands SET result=jsonb_build_object('redacted',true,'reason','question_deleted') WHERE workspace_id=$1 AND result->>'id'=ANY($2::text[])",[workspaceId,erased.rows.map(r=>r.id)]);
}
export async function eraseSourceAnswers(tx:PoolClient,workspaceId:string,sourceId:string){
 const rows=(await tx.query("SELECT DISTINCT a.answer_id FROM answer_fact_refs a JOIN fact_versions v ON v.workspace_id=a.workspace_id AND v.fact_id=a.fact_id AND v.revision=a.fact_revision WHERE a.workspace_id=$1 AND v.source_id=$2",[workspaceId,sourceId])).rows;
 for(const row of rows)await eraseAnswer(tx,workspaceId,row.answer_id);
}

