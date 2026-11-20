import crypto from 'node:crypto';
import type { PoolClient } from 'pg';
import { z } from 'zod';
import { transaction } from './db';
import { reauthorize, digest, type Context } from './auth';
import { invariant, notFound } from './errors';
import {applicationWritable,queueApplicationProjection} from './application-authority';

export const uuid = z.string().uuid();
const note = z.string().max(8000);
const schema = z.discriminatedUnion('action', [
 z.object({ commandId: uuid, action: z.literal('create_job'), payload: z.object({
  company: z.string().trim().min(1).max(180), title: z.string().trim().min(1).max(200),
  location: z.string().trim().max(200).default(''), description: z.string().max(50000).default(''),
  url: z.string().max(2048).optional(),
 }).strict() }).strict(),
 z.object({ commandId: uuid, action: z.literal('create_intent'), payload: z.object({ jobId: uuid }).strict() }).strict(),
 z.object({ commandId: uuid, action: z.literal('update_note'), payload: z.object({ jobId: uuid, expectedRevision: z.number().int().positive(), note }).strict() }).strict(),
 z.object({ commandId: uuid, action: z.literal('archive_job'), payload: z.object({ jobId: uuid, expectedRevision: z.number().int().positive(), archived: z.boolean() }).strict() }).strict(),
 z.object({ commandId: uuid, action: z.literal('set_intent_status'), payload: z.object({ applicationId: uuid, expectedRevision: z.number().int().positive(), status: z.enum(['intent','archived']) }).strict() }).strict(),
]);
function canonical(value: unknown): string {
 if (value === null || typeof value !== 'object') return JSON.stringify(value);
 if (Array.isArray(value)) return '[' + value.map(canonical).join(',') + ']';
 return '{' + Object.entries(value as Record<string,unknown>).sort(([a],[b]) => a.localeCompare(b)).map(([k,v]) => JSON.stringify(k) + ':' + canonical(v)).join(',') + '}';
}
export async function event(tx: PoolClient, ctx: Pick<Context,'workspaceId'>, entityId: string, type: string, payload: unknown, revision?: number) {
 const id = crypto.randomUUID();
 await tx.query('INSERT INTO events(id,workspace_id,entity_id,event_type,revision,payload) VALUES($1,$2,$3,$4,$5,$6)',
  [id,ctx.workspaceId,entityId,type,revision ?? null,JSON.stringify(payload)]);
 await tx.query('INSERT INTO outbox(id,workspace_id,event_id) VALUES($1,$2,$3)', [crypto.randomUUID(),ctx.workspaceId,id]);
}
export async function command<T>(ctx: Context, commandId: string, payload: unknown, fn: (tx: PoolClient) => Promise<T>): Promise<T> {
 uuid.parse(commandId);
 const hash = digest(canonical(payload));
 return transaction(async tx => {
  await reauthorize(tx,ctx);
  await tx.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))', [ctx.workspaceId + commandId]);
  const prior = await tx.query('SELECT payload_hash,result FROM commands WHERE workspace_id=$1 AND command_id=$2', [ctx.workspaceId,commandId]);
  if (prior.rows[0]) {
   invariant(prior.rows[0].payload_hash === hash,'idempotency_conflict','This action ID was already used for different values.',409);
   return prior.rows[0].result as T;
  }
  const value = await fn(tx);
  await tx.query('INSERT INTO commands(workspace_id,command_id,payload_hash,result) VALUES($1,$2,$3,$4)',
   [ctx.workspaceId,commandId,hash,JSON.stringify(value)]);
  return value;
 });
}
export async function jobFor(tx: PoolClient, ctx: Pick<Context,'workspaceId'>, id: string) {
 const r = await tx.query('SELECT * FROM jobs WHERE id=$1 AND workspace_id=$2 FOR UPDATE', [id,ctx.workspaceId]);
 if (!r.rows[0]) throw notFound();
 return r.rows[0];
}
export async function executeCommand(ctx: Context, raw: unknown) {
 const c = schema.parse(raw);
 return command(ctx,c.commandId,c,async tx => {
  await applicationWritable(tx,ctx.workspaceId);
  await queueApplicationProjection(tx,ctx.workspaceId);
  if (c.action === 'create_job') {
   const p = c.payload;
   if (p.url) {
    let url: URL; try { url = new URL(p.url); } catch { invariant(false,'invalid_job_url','Posting URL must be a valid HTTPS address.'); }
    invariant(url.protocol === 'https:' && !url.username && !url.password,'invalid_job_url','Posting URL must be an HTTPS address without credentials.');
   }
   const id = crypto.randomUUID();
   const r = await tx.query('INSERT INTO jobs(id,workspace_id,company,title,location,url,description) VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING *',
    [id,ctx.workspaceId,p.company,p.title,p.location,p.url || null,p.description]);
   await event(tx,ctx,id,'job_added',{company:p.company,title:p.title},1);
   return r.rows[0];
  }
  if (c.action === 'set_intent_status') {
   const p = c.payload;
   const r = await tx.query('UPDATE applications SET status=$1,revision=revision+1,updated_at=now() WHERE id=$2 AND workspace_id=$3 AND revision=$4 RETURNING *',
    [p.status,p.applicationId,ctx.workspaceId,p.expectedRevision]);
   if (!r.rows[0]) {
    const exists = await tx.query('SELECT id FROM applications WHERE id=$1 AND workspace_id=$2',[p.applicationId,ctx.workspaceId]);
    if (!exists.rows[0]) throw notFound();
    invariant(false,'revision_conflict','This application changed. Refresh before saving.',409);
   }
   await event(tx,ctx,p.applicationId,'application_intent_updated',{status:p.status},r.rows[0].revision);
   return r.rows[0];
  }
  const p = c.payload, job = await jobFor(tx,ctx,p.jobId);
  if (c.action === 'create_intent') {
   const existing = await tx.query('SELECT * FROM applications WHERE workspace_id=$1 AND job_id=$2',[ctx.workspaceId,job.id]);
   if (existing.rows[0]) return existing.rows[0];
   invariant(!job.archived,'job_archived','Restore this role before adding an application intent.',409);
   const r = await tx.query('INSERT INTO applications(id,workspace_id,job_id) VALUES($1,$2,$3) RETURNING *',[crypto.randomUUID(),ctx.workspaceId,job.id]);
   await event(tx,ctx,r.rows[0].id,'application_intent_created',{jobId:job.id,company:job.company,title:job.title},1);
   return r.rows[0];
  }
  invariant(job.revision === c.payload.expectedRevision,'revision_conflict','This role changed. Refresh before saving.',409);
  const r = c.action === 'update_note'
   ? await tx.query('UPDATE jobs SET note=$1,revision=revision+1,updated_at=now() WHERE id=$2 AND workspace_id=$3 RETURNING *',[c.payload.note,job.id,ctx.workspaceId])
   : await tx.query('UPDATE jobs SET archived=$1,revision=revision+1,updated_at=now() WHERE id=$2 AND workspace_id=$3 RETURNING *',[c.payload.archived,job.id,ctx.workspaceId]);
  await event(tx,ctx,job.id,c.action === 'update_note'?'job_note_updated':'job_archive_updated',
   c.action === 'update_note'?{characters:c.payload.note.length}:{archived:c.payload.archived},r.rows[0].revision);
  return r.rows[0];
 });
}
export async function resolveProposal(ctx: Context, id: string, commandId: string, decision: 'confirmed'|'rejected') {
 uuid.parse(id);
 return command(ctx,commandId,{id,decision},async tx => {
  await applicationWritable(tx,ctx.workspaceId);
  await queueApplicationProjection(tx,ctx.workspaceId);
  const r = await tx.query('SELECT * FROM proposals WHERE id=$1 AND workspace_id=$2 FOR UPDATE',[id,ctx.workspaceId]);
  const p = r.rows[0]; if (!p) throw notFound();
  invariant(p.session_id === ctx.sessionId,'confirmation_denied','This proposal belongs to a different session. Request a new proposal.',403);
  invariant(p.status === 'pending' && new Date(p.expires_at).getTime()>Date.now(),'proposal_expired','This proposal is no longer available. Request a new proposal.',409);
  if (p.run_id) {
   const run = await tx.query('SELECT status FROM runs WHERE id=$1 AND workspace_id=$2',[p.run_id,ctx.workspaceId]);
   invariant(run.rows[0]?.status === 'completed','proposal_not_ready','Wait for the response to finish before reviewing this proposal.',409);
  }
  const job = await jobFor(tx,ctx,p.job_id);
  if (decision === 'confirmed') {
   invariant(job.revision === p.expected_revision,'revision_conflict','The role changed after this proposal. Request a new proposal.',409);
   await tx.query('UPDATE jobs SET note=$1,revision=revision+1,updated_at=now() WHERE id=$2 AND workspace_id=$3',[p.note,job.id,ctx.workspaceId]);
   await event(tx,ctx,job.id,'job_note_confirmed',{proposalId:id,characters:p.note.length},job.revision+1);
  } else await event(tx,ctx,job.id,'proposal_rejected',{proposalId:id});
  await tx.query('UPDATE proposals SET status=$1,confirmed_at=now() WHERE id=$2',[decision,id]);
  return {id,status:decision};
 });
}
