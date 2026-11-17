import crypto from 'node:crypto';
import type { PoolClient } from 'pg';
import { database } from './db';
import { config } from './config';
import { DomainError, invariant } from './errors';
export const digest = (s: string) => crypto.createHash('sha256').update(s).digest('hex');
export type Context = { workspaceId: string; sessionId: string; csrfToken: string; isOwner: boolean };
export function checkOrigin(req: Request) {
  const origin = config().origin;
  invariant(req.headers.get('origin') === origin, 'origin_denied', 'Request origin denied.', 403);
  invariant(req.headers.get('host') === new URL(origin).host, 'host_denied', 'Request host denied.', 403);
}
export async function authenticate(req: Request, mutation = false): Promise<Context> {
  const token = (req.headers.get('cookie') || '').split(';').map(x => x.trim()).find(x => x.startsWith('maxim_session='))?.slice(14);
  invariant(token && token.length <= 128, 'authentication_required', 'Sign in to your workspace.', 401);
  const { rows } = await database().query(
    'SELECT s.id,s.workspace_id,s.csrf_token,w.is_owner FROM sessions s JOIN workspaces w ON w.id=s.workspace_id WHERE s.token_hash=$1 AND s.expires_at>now()', [digest(token)]);
  invariant(rows[0], 'authentication_required', 'Your session expired. Sign in again.', 401);
  if (mutation) { checkOrigin(req); invariant(req.headers.get('x-csrf-token') === rows[0].csrf_token, 'csrf_denied', 'Session confirmation failed.', 403); }
  return { workspaceId: rows[0].workspace_id, sessionId: rows[0].id, csrfToken: rows[0].csrf_token, isOwner: rows[0].is_owner };
}
export async function reauthorize(tx: PoolClient, ctx: Context) {
  const r = await tx.query('SELECT id FROM sessions WHERE id=$1 AND workspace_id=$2 AND expires_at>now() FOR SHARE', [ctx.sessionId, ctx.workspaceId]);
  invariant(r.rowCount, 'authentication_required', 'Your session expired. Sign in again.', 401);
}
let failures: number[] = [];
export async function login(key: string) {
  failures = failures.filter(t => t > Date.now() - 60000);
  if (failures.length >= 10) throw new DomainError('login_limited', 'Too many sign-in attempts. Try again in a minute.', 429);
  const r = await database().query('SELECT workspace_id FROM access_keys WHERE key_hash=$1', [digest(key)]);
  if (!r.rows[0]) { failures.push(Date.now()); throw new DomainError('invalid_key', 'Access key not recognized.', 401); }
  const token = crypto.randomBytes(32).toString('base64url'), csrfToken = crypto.randomBytes(24).toString('base64url');
  await database().query('INSERT INTO sessions(id,token_hash,workspace_id,csrf_token,expires_at) VALUES($1,$2,$3,$4,now()+interval \'12 hours\')',
    [crypto.randomUUID(), digest(token), r.rows[0].workspace_id, csrfToken]);
  return { token, csrfToken };
}
