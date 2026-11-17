import type {PoolClient} from 'pg';
import type {Context} from './auth';
import {invariant,notFound} from './errors';
export const renderFactEvidence=(facts:Array<{value:unknown}>)=>facts.map(f=>typeof f.value==='string'?f.value:Array.isArray(f.value)?f.value.join(', '):JSON.stringify(f.value)).join('\n\n');

export async function questionFor(tx:PoolClient,ctx:Context,id:string){
 const q=(await tx.query('SELECT * FROM answer_questions WHERE workspace_id=$1 AND id=$2',[ctx.workspaceId,id])).rows[0];
 if(!q)throw notFound();return q;
}
export async function answerFor(tx:PoolClient,ctx:Context,id:string){
 const a=(await tx.query('SELECT * FROM answer_memory WHERE workspace_id=$1 AND id=$2 FOR UPDATE',[ctx.workspaceId,id])).rows[0];
 if(!a)throw notFound();return a;
}
export async function refsFor(tx:PoolClient,workspaceId:string,id:string,revision:number){
 return (await tx.query('SELECT fact_id AS id,fact_revision AS revision FROM answer_fact_refs WHERE workspace_id=$1 AND answer_id=$2 AND answer_revision=$3 ORDER BY fact_id',[workspaceId,id,revision])).rows;
}
export async function validRefs(tx:PoolClient,workspaceId:string,refs:Array<{id:string;revision:number}>,forModel=false){
 const values=[];
 for(const ref of refs){
  const f=(await tx.query("SELECT f.*,s.model_consent,s.deleted_at,s.revision AS actual_source_revision FROM candidate_facts f JOIN candidate_sources s ON s.workspace_id=f.workspace_id AND s.id=f.source_id WHERE f.workspace_id=$1 AND f.id=$2 AND f.status='current' AND s.deleted_at IS NULL AND f.source_revision=s.revision",[workspaceId,ref.id])).rows[0];
  invariant(f&&f.revision===ref.revision,'evidence_stale','A supporting fact changed or was withdrawn. Review the answer again.',409);
  invariant(!forModel||f.model_consent&&f.sensitivity==='standard','disclosure_denied','A supporting fact is not permitted in model context.',409);
  values.push(f);
 }
 return values;
}
export async function assertUsable(tx:PoolClient,ctx:Context,answer:Record<string,any>,forModel=false){
 invariant(answer.status==='approved'&&new Date(answer.expires_at).getTime()>Date.now()&&answer.permission!=='never','answer_unavailable','This answer is not currently approved for reuse.',409);
 invariant(!forModel||answer.model_consent&&answer.sensitivity==='standard','disclosure_denied','This answer is not permitted in general model context.',409);
 invariant(answer.sensitivity==='standard'||answer.sensitive_consent,'sensitive_review','Private answers require explicit local reuse consent.',409);
 const refs=await refsFor(tx,ctx.workspaceId,answer.id,answer.revision);
 await validRefs(tx,ctx.workspaceId,refs,forModel);
 return refs;
}

