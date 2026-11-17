'use client';

import {useEffect, useState, type FormEvent} from 'react';
import {Button} from '@astryxdesign/core/Button';
import {TextInput} from '@astryxdesign/core/TextInput';
import {Bot, Check, Globe, KeyRound, LockKeyhole, LogOut, Mail, MessageCircle, Save, ShieldCheck} from 'lucide-react';
import {errorMessage, type WorkspaceApi} from './api';
import {Banner, Glyph, Pill, formatBytes} from './shared';
import type {ModelSettings, WorkspaceData} from './types';

export function SettingsView({data, api, disabled, refresh, onLogout}: {
  data: WorkspaceData; api: WorkspaceApi; disabled: boolean; refresh: () => Promise<void>; onLogout: () => Promise<void>;
}) {
  const [model, setModel] = useState(data.settings.model.model ?? '');
  const [apiKey, setApiKey] = useState('');
  const [busy, setBusy] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);
  const current = data.settings.model;
  const isOwner = data.workspace.is_owner;
  useEffect(() => { setModel(current.model ?? ''); }, [current.model]);
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (disabled || busy || !isOwner) return;
    if (!model.trim()) { setError('Enter a model ID.'); return; }
    if (!current.hasKey && !apiKey.trim()) { setError('Enter an API key for the model connection.'); return; }
    setBusy(true); setError(''); setSaved(false);
    try {
      await api.post<{model: ModelSettings}>('/api/settings/model', {
        model: model.trim(), ...(apiKey.trim() ? {apiKey: apiKey.trim()} : {}),
      });
      setApiKey('');
      setSaved(true);
      await refresh();
    } catch (failure) { setError(errorMessage(failure)); }
    finally { setBusy(false); }
  }
  return <div className="settings-view">
    <section className="settings-section">
      <div className="settings-section-title"><Bot size={19} aria-hidden="true" /><div><h2>Model connection</h2>
        <span className="small muted">{current.provider || 'Provider not configured'}</span></div>
        <Pill tone={current.configured ? 'green' : 'amber'}>{current.configured ? 'Configured' : 'Not configured'}</Pill></div>
      {error && <Banner onDismiss={() => setError('')}>{error}</Banner>}
      {saved && <Banner tone="success" onDismiss={() => setSaved(false)}>Connection settings saved.</Banner>}
      {!isOwner && <Banner tone="info">Only the workspace owner can change connection settings.</Banner>}
      <form onSubmit={submit} className="model-form">
        <TextInput label="Model ID" value={model} onChange={value => { setModel(value); setSaved(false); }}
          htmlName="model" placeholder="Model ID" isRequired isDisabled={disabled || busy || !isOwner} hasSpellCheck={false} autoComplete="off" />
        <TextInput label={current.hasKey ? 'Replace API key' : 'API key'} type="password" value={apiKey}
          onChange={value => { setApiKey(value); setSaved(false); }} htmlName="apiKey" autoComplete="new-password"
          placeholder={current.hasKey ? 'Unchanged' : 'API key'} isDisabled={disabled || busy || !isOwner} hasSpellCheck={false} />
        <div className="key-status"><KeyRound size={14} aria-hidden="true" /><span>{current.hasKey ? 'Key stored on server' : 'No key saved'}</span>
          {current.hasKey && <Check size={14} aria-hidden="true" />}</div>
        <div className="settings-save"><Button label="Save connection" type="submit" variant="primary" icon={<Glyph icon={Save} />}
          isLoading={busy} isDisabled={disabled || !isOwner} /></div>
      </form>
      <dl className="connection-limits"><div><dt>Request budget</dt><dd className="tabular">{formatBytes(current.requestByteLimit)}</dd></div>
        <div><dt>Output limit</dt><dd className="tabular">{Number.isFinite(current.outputTokenLimit) ? current.outputTokenLimit.toLocaleString() + ' tokens' : 'Not set'}</dd></div>
        <div><dt>Context policy</dt><dd className="tabular">{current.inputTokenBudget?.toLocaleString()||'Unknown'} tokens with framing/output reserve</dd></div>
        <div><dt>Local counter</dt><dd>{current.tokenizer||'Unavailable'}</dd></div>
        <div><dt>Credential storage</dt><dd>Server only</dd></div></dl>
    </section>
    <section className="settings-section">
      <div className="settings-section-title"><Globe size={19} aria-hidden="true" /><h2>Integrations</h2><span className="small muted">Not connected</span></div>
      <div className="integration-list">{[
        {name: 'Gmail', icon: Mail}, {name: 'Discord', icon: MessageCircle}, {name: 'Browser assistance', icon: Globe},
      ].map(integration => <div className="integration-row" key={integration.name}>
        <span className="integration-icon"><integration.icon size={20} aria-hidden="true" /></span><strong>{integration.name}</strong>
        <Pill>Unavailable</Pill><Button label="Connect" size="sm" variant="ghost" icon={<Glyph icon={LockKeyhole} />} isDisabled tooltip="Not available in this workspace" />
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
