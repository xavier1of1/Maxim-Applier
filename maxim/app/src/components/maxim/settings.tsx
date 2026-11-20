'use client';

import {useEffect, useState, type FormEvent} from 'react';
import {Button} from '@astryxdesign/core/Button';
import {TextInput} from '@astryxdesign/core/TextInput';
import {Selector} from '@astryxdesign/core/Selector';
import {ArrowRight, Bot, Check, Globe, KeyRound, LogOut, Mail, MessageCircle, Save, ShieldCheck} from 'lucide-react';
import {errorMessage, type WorkspaceApi} from './api';
import {Banner, Glyph, Pill, formatBytes} from './shared';
import type {ModelSettings, Navigation, WorkspaceData} from './types';

export function SettingsView({data, api, disabled, refresh, navigate, onLogout}: {
  data: WorkspaceData; api: WorkspaceApi; disabled: boolean; refresh: () => Promise<void>; navigate:(value:Navigation)=>void; onLogout: () => Promise<void>;
}) {
  const [model, setModel] = useState(data.settings.model.model ?? '');
  const [apiKey, setApiKey] = useState('');
  const [busy, setBusy] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);
  const [checking,setChecking]=useState(false);
  const [accessConfirmed,setAccessConfirmed]=useState(false);
  const [modelApi,setModelApi]=useState<'responses'|'chat_completions'>(data.settings.model.hasKey?(data.settings.model.api||'chat_completions'):'responses');
  const [catalog,setCatalog]=useState<string[]>([]),[listing,setListing]=useState(false);
  const current = data.settings.model;
  const isOwner = data.workspace.is_owner;
  useEffect(() => { setModel(current.model ?? ''); }, [current.model]);
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (disabled || busy || !isOwner) return;
    if (!/^[A-Za-z0-9][A-Za-z0-9._:/-]{0,119}$/.test(model.trim())) { setError('Enter the exact API model ID without spaces, not a display name.'); return; }
    if (!current.hasKey && !apiKey.trim()) { setError('Enter an API key for the model connection.'); return; }
    setBusy(true); setError(''); setSaved(false);setAccessConfirmed(false);
    try {
      await api.post<{model: ModelSettings}>('/api/settings/model', {
        model: model.trim(), api:modelApi,...(apiKey.trim() ? {apiKey: apiKey.trim()} : {}),
      });
      setApiKey('');
      setSaved(true);
      await refresh();
    } catch (failure) { setError(errorMessage(failure)); }
    finally { setBusy(false); }
  }
  async function checkAccess(){
    if(disabled||busy||checking||!isOwner||!current.configured)return;
    setChecking(true);setAccessConfirmed(false);setError('');
    try{await api.post('/api/settings/model/check',{});setAccessConfirmed(true);}
    catch(failure){setError(errorMessage(failure));}
    finally{setChecking(false);}
  }
  async function loadModels(){
    if(disabled||busy||listing||checking||!isOwner)return;
    setListing(true);setError('');
    try{const r=await api.post<{models:string[]}>('/api/settings/model/list',apiKey.trim()?{apiKey:apiKey.trim()}:{});setCatalog(r.models);}
    catch(e){setError(errorMessage(e));}finally{setListing(false);}
  }
  return <div className="settings-view">
    <section className="settings-section">
      <div className="settings-section-title"><Bot size={19} aria-hidden="true" /><div><h2>Model connection</h2>
        <span className="small muted">{current.provider || 'Provider not configured'}</span></div>
        <Pill tone={current.configured ? 'green' : 'amber'}>{current.configured ? 'Configured' : 'Not configured'}</Pill></div>
      {error && <Banner onDismiss={() => setError('')}>{error}</Banner>}
      {saved && <Banner tone="success" onDismiss={() => setSaved(false)}>Connection settings saved.</Banner>}
      {accessConfirmed&&<Banner tone="success" onDismiss={()=>setAccessConfirmed(false)}>OpenAI confirmed model access. Task compatibility has not been tested; no evaluation was run.</Banner>}
      {!isOwner && <Banner tone="info">Only the workspace owner can change connection settings.</Banner>}
      <form onSubmit={submit} className="model-form">
        <Button label="Load models" type="button" variant="secondary" icon={<Glyph icon={Bot}/>} onClick={()=>void loadModels()}
          isLoading={listing} isDisabled={disabled||busy||checking||!isOwner||(!current.hasKey&&!apiKey.trim())}/>
        {catalog.length>0&&<Selector label="Available API models" hasSearch value={catalog.includes(model)?model:''} options={catalog.map(value=>({value,label:value}))}
          onChange={value=>{setModel(value);setModelApi('responses');setSaved(false);setAccessConfirmed(false);}} isDisabled={disabled||busy||checking||listing||!isOwner}/>}
        <TextInput label="Model ID" value={model} onChange={value => { setModel(value);if(value!==current.model)setModelApi('responses'); setSaved(false);setAccessConfirmed(false); }}
          htmlName="model" placeholder="gpt-4.1-mini" isRequired isDisabled={disabled || busy || checking || listing || !isOwner} hasSpellCheck={false} autoComplete="off" />
        <TextInput label={current.hasKey ? 'Replace API key' : 'API key'} type="password" value={apiKey}
          onChange={value => { setApiKey(value);setCatalog([]); setSaved(false);setAccessConfirmed(false); }} htmlName="apiKey" autoComplete="new-password"
          placeholder={current.hasKey ? 'Unchanged' : 'API key'} isDisabled={disabled || busy || checking || listing || !isOwner} hasSpellCheck={false} />
        <details><summary>Advanced connection</summary><Selector label="OpenAI API" value={modelApi}
          options={[{value:'responses',label:'Responses'},{value:'chat_completions',label:'Chat Completions (legacy)'}]}
          onChange={value=>{setModelApi(value as typeof modelApi);setSaved(false);setAccessConfirmed(false);}} isDisabled={disabled||busy||checking||listing||!isOwner}/></details>
        <div className="key-status"><KeyRound size={14} aria-hidden="true" /><span>{current.hasKey ? 'Key stored on server' : 'No key saved'}</span>
          {current.hasKey && <Check size={14} aria-hidden="true" />}</div>
        <div className="settings-save inline-actions"><Button label="Save connection" type="submit" variant="primary" icon={<Glyph icon={Save} />}
          isLoading={busy} isDisabled={disabled || checking || listing || !isOwner} />
          <Button label="Check model access" type="button" variant="secondary" icon={<Glyph icon={Check}/>} onClick={()=>void checkAccess()}
            isLoading={checking} isDisabled={disabled||busy||listing||!isOwner||!current.configured||model!==current.model||modelApi!==(current.api||'chat_completions')||Boolean(apiKey)}/></div>
      </form>
      <dl className="connection-limits"><div><dt>Request budget</dt><dd className="tabular">{formatBytes(current.requestByteLimit)}</dd></div>
        <div><dt>Output limit</dt><dd className="tabular">{Number.isFinite(current.outputTokenLimit) ? current.outputTokenLimit.toLocaleString() + ' tokens' : 'Not set'}</dd></div>
        <div><dt>Context policy</dt><dd className="tabular">{current.inputTokenBudget?.toLocaleString()||'Unknown'} tokens with framing/output reserve</dd></div>
        <div><dt>Local counter</dt><dd>{current.tokenizer||'Unavailable'}</dd></div>
        <div><dt>Credential storage</dt><dd>Server only</dd></div></dl>
    </section>
    <section className="settings-section">
      <div className="settings-section-title"><Globe size={19} aria-hidden="true" /><h2>Integrations</h2></div>
      <div className="integration-list">{[
        {name: 'Gmail', icon: Mail, view:'gmail'}, {name: 'Discord', icon: MessageCircle, view:'discord'}, {name: 'Apply Assistant', icon: Globe, view:'browser'},
      ].filter(i=>isOwner||i.view==='browser').map(integration => <div className="integration-row" key={integration.name}>
        <span className="integration-icon"><integration.icon size={20} aria-hidden="true" /></span><strong>{integration.name}</strong>
        <Button label={'Open '+integration.name} size="sm" variant="ghost" icon={<Glyph icon={ArrowRight}/>} onClick={()=>navigate({view:integration.view})}/>
      </div>)}</div>
    </section>
    <section className="settings-section">
      <div className="settings-section-title"><ShieldCheck size={19} aria-hidden="true" /><h2>Workspace</h2><Pill tone="green">Private</Pill></div>
      <dl className="workspace-properties"><div><dt>Name</dt><dd>{data.workspace.name}</dd></div>
        <div><dt>Access</dt><dd>{isOwner ? 'Owner' : 'Member'}</dd></div>
        <div><dt>Ownership</dt><dd>New workspace</dd></div>
        <div><dt>Environment</dt><dd>{data.settings.testMode ? 'Isolated test workspace' : 'Local workspace'}</dd></div>
        <div><dt>Workspace ID</dt><dd className="mono">{data.workspace.id}</dd></div></dl>
      <Button label="Sign out" variant="secondary" icon={<Glyph icon={LogOut} />} isLoading={loggingOut} isDisabled={disabled}
        onClick={async () => {
          setLoggingOut(true); setError('');
          try { await onLogout(); } catch (failure) { setError(errorMessage(failure)); setLoggingOut(false); }
        }} />
    </section>
  </div>;
}
