import fs from 'node:fs';
import path from 'node:path';
import { z } from 'zod';
import { DomainError, invariant } from './errors';
import {modelProfile} from './context-budget';
import {validateModelId,type ModelApi} from './model-id';
import {boundedJson} from './openai';

const schema = z.object({
  databaseUrl: z.string().url(), origin: z.string().url(), privateRoot: z.string(),
  bootstrapKey: z.string().min(32), workspaceId: z.string().uuid(),
  model: z.object({ model: z.string().max(120), apiKey: z.string(), baseUrl: z.string().url(),api:z.enum(['responses','chat_completions']).default('chat_completions') }),
  testMode: z.boolean().default(false),
  discoveryFixtureOrigin:z.string().url().optional(),
  contextBudget:z.number().int().min(100).max(8192).default(8192),
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
      if(c.discoveryFixtureOrigin){const f=new URL(c.discoveryFixtureOrigin);if(f.origin!==c.discoveryFixtureOrigin||f.protocol!=='http:'||f.hostname!=='127.0.0.1')throw Error();}
    } else if (c.model.baseUrl !== 'https://api.openai.com/v1') throw Error();
    if(!c.testMode&&c.discoveryFixtureOrigin)throw Error();
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
  let supported=false;
  try{modelProfile(c.model.model,c.testMode);supported=true;}catch{}
  return { configured: Boolean(supported && c.model.apiKey), model: c.model.model,api:c.model.api,
    hasKey: Boolean(c.model.apiKey), provider: 'OpenAI', requestByteLimit: 32000, outputTokenLimit: 1024,
    inputTokenBudget:c.contextBudget,tokenizer:'@microsoft/tiktokenizer@1.0.10',
    accounting: 'Local BPE estimate with framing/margin and output reserve; unknown model context windows are not assumed. Provider usage is separate.' };
}
export function saveModelSettings(model: string, apiKey?: string,api:ModelApi='responses') {
  const c = config();
  modelProfile(model,c.testMode);
  invariant(apiKey||c.model.apiKey,'model_key_required','Enter your OpenAI API key before saving.',400);
  invariant(!apiKey||/^[!-~]+$/.test(apiKey),'invalid_model_key','Enter an API key without spaces or line breaks.',400);
  c.model.model = model;
  c.model.api=api;
  if (apiKey !== undefined && apiKey !== '') c.model.apiKey = apiKey;
  const target = configFile(), temp = target + '.new';
  fs.writeFileSync(temp, JSON.stringify(c, null, 2), { mode: 0o600 });
  fs.renameSync(temp, target);
}

export async function checkModelAccess(signal:AbortSignal) {
  const c=config(),model=c.model;
  invariant(model.model&&model.apiKey,'model_unconfigured','Save your model connection first.',409);
  modelProfile(model.model,c.testMode);
  let response:Response;
  try{
    response=await fetch(model.baseUrl+'/models/'+encodeURIComponent(model.model),{
      headers:{Authorization:'Bearer '+model.apiKey},redirect:'error',
      signal:AbortSignal.any([signal,AbortSignal.timeout(8000)]),
    });
    await response.body?.cancel();
  }catch{
    throw new DomainError('model_unavailable','The model provider could not be reached. Check your connection and retry.',502);
  }
  invariant(response.ok,'model_access_denied','OpenAI did not confirm access to this model (HTTP '+response.status+'). Check the key and model ID.',502);
  return {accessible:true};
}
export async function listModels(apiKey:string|undefined,signal:AbortSignal){
 const c=config(),key=apiKey||c.model.apiKey;
 invariant(key&&/^[!-~]+$/.test(key),'model_key_required','Enter an OpenAI API key to load models.',400);
 let response:Response;
 try{response=await fetch(c.model.baseUrl+'/models',{headers:{Authorization:'Bearer '+key},redirect:'error',signal:AbortSignal.any([signal,AbortSignal.timeout(8000)])});}
 catch{throw new DomainError('model_unavailable','Could not load models. Enter an exact model ID manually or retry.',502);}
 if(!response.ok){await response.body?.cancel();throw new DomainError('model_access_denied','Could not load models (HTTP '+response.status+'). Check the API key or enter a model ID manually.',502);}
 const value=await boundedJson(response,2*1024*1024);
 invariant(Array.isArray(value.data)&&value.data.length<=10000,'model_invalid_response','The model list is unavailable. Enter an ID manually.',502);
 const ids:string[]=[];
 for(const row of value.data){try{ids.push(validateModelId(row.id));}catch{}}
 return {models:[...new Set(ids)].sort()};
}
