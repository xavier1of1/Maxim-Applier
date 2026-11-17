import fs from 'node:fs';
import path from 'node:path';
import { z } from 'zod';
import { DomainError } from './errors';

const schema = z.object({
  databaseUrl: z.string().url(), origin: z.string().url(), privateRoot: z.string(),
  bootstrapKey: z.string().min(32), workspaceId: z.string().uuid(),
  model: z.object({ model: z.string().max(120), apiKey: z.string(), baseUrl: z.string().url() }),
  testMode: z.boolean().default(false),
});
export type RuntimeConfig = z.infer<typeof schema>;
export function configFile() {
  return process.env.MAXIM_RUNTIME_FILE || path.join(process.env.LOCALAPPDATA || '', 'MaximApply', 'private', 'workspace', 'runtime.json');
}
export function config(): RuntimeConfig {
  try {
    // Runtime secrets are external inputs, never build-traced deployment files.
    const c = schema.parse(JSON.parse(fs.readFileSync(/* turbopackIgnore: true */ configFile(), 'utf8')));
    const db = new URL(c.databaseUrl);
    if (!['127.0.0.1', 'localhost'].includes(db.hostname)) throw Error();
    if (c.testMode && !/^\/maxim_test_[a-z0-9_]+$/.test(db.pathname)) throw Error();
    if (!c.testMode && db.pathname !== '/maxim_workspace') throw Error();
    if (!['127.0.0.1', 'localhost'].includes(new URL(c.origin).hostname)) throw Error();
    const base = new URL(c.model.baseUrl);
    if (c.testMode) {
      if (base.hostname !== '127.0.0.1' || base.protocol !== 'http:') throw Error();
      if (!path.basename(c.privateRoot).startsWith('maxim-test-')) throw Error();
    } else if (c.model.baseUrl !== 'https://api.openai.com/v1') throw Error();
    const repo = path.resolve(/* turbopackIgnore: true */ process.cwd(), process.cwd().endsWith(path.join('maxim', 'app')) ? '../..' : '.');
    const relative = path.relative(fs.realpathSync(/* turbopackIgnore: true */ repo), fs.realpathSync(/* turbopackIgnore: true */ c.privateRoot));
    if (!relative.startsWith('..') && !path.isAbsolute(relative)) throw Error();
    return c;
  } catch {
    throw new DomainError('configuration_unavailable', 'Workspace configuration is unavailable. Run workspace setup.', 503);
  }
}
export function publicModelSettings() {
  const c = config();
  return { configured: Boolean(c.model.model && c.model.apiKey), model: c.model.model,
    hasKey: Boolean(c.model.apiKey), provider: 'OpenAI', requestByteLimit: 32000, outputTokenLimit: 1024,
    accounting: 'Conservative request-byte cap; actual usage is reported by the provider.' };
}
export function saveModelSettings(model: string, apiKey?: string) {
  const c = config();
  c.model.model = model;
  if (apiKey !== undefined && apiKey !== '') c.model.apiKey = apiKey;
  const target = configFile(), temp = target + '.new';
  fs.writeFileSync(temp, JSON.stringify(c, null, 2), { mode: 0o600 });
  fs.renameSync(temp, target);
}
