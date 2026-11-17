'use client';

import {useEffect, useId, useRef, useState} from 'react';
import {Button} from '@astryxdesign/core/Button';
import {IconButton} from '@astryxdesign/core/IconButton';
import {Dialog, DialogHeader} from '@astryxdesign/core/Dialog';
import {ArrowRight, ArrowUp, Bot, BriefcaseBusiness, Check, ChevronDown, Clock3, History,
  LoaderCircle, MessageSquare, Plus, RefreshCw, Settings2, ShieldCheck, Square, Wrench, X} from 'lucide-react';
import {errorMessage, type WorkspaceApi} from './api';
import {Banner, EmptyState, Glyph, Pill, ToolButton, eventTitle, formatDate} from './shared';
import {messageText, type AgentController} from './use-agent';
import type {Navigation, Proposal, WorkspaceData} from './types';

export function AgentPanel({agent, data, conversationId, jobId, disabled, navigate, onReview, onClose}: {
  agent: AgentController; data: WorkspaceData; conversationId: string | null; jobId: string | null;
  disabled: boolean; navigate: (selection: Navigation) => void; onReview: (proposal: Proposal) => void; onClose?: () => void;
}) {
  const [history, setHistory] = useState(false);
  const composerId = useId();
  const [nearBottom, setNearBottom] = useState(true);
  const transcript = useRef<HTMLDivElement>(null);
  const composer = useRef<HTMLTextAreaElement>(null);
  const current = agent.detail?.conversation.id === conversationId ? agent.detail : null;
  const contextId = current ? current.conversation.job_id : jobId;
  const job = data.jobs.find(item => item.id === contextId);
  const conversations = [...data.conversations].sort((a, b) => b.updated_at.localeCompare(a.updated_at));
  const proposals = (current?.proposals ?? []).filter(proposal => proposal.status === 'pending' &&
    new Date(proposal.expires_at).getTime() > Date.now() && !agent.isRunning &&
    current?.runs.some(run => run.id === proposal.run_id && run.status === 'completed'));
  const messages = (current?.messages ?? []).filter(message => messageText(message).trim());
  const modelReady = data.settings.model.configured;
  const draftBytes = new TextEncoder().encode(agent.draft).byteLength;
  const limit = data.settings.model.requestByteLimit;
  const overBudget = Number.isFinite(limit) && draftBytes > limit;
  const lastRun = current?.runs.at(-1);
  const failedRun = lastRun && ['failed', 'error', 'cancelled', 'interrupted'].includes(lastRun.status) ? lastRun : null;
  useEffect(() => {
    if (nearBottom && transcript.current) transcript.current.scrollTop = transcript.current.scrollHeight;
  }, [messages.length, agent.streamText, agent.tools.length, agent.state, nearBottom]);
  useEffect(() => { setNearBottom(true); setHistory(false); }, [conversationId]);
  return <aside className="agent-panel" aria-label="Workspace agent">
    <header className="agent-header">
      <span className="agent-emblem"><Bot size={19} aria-hidden="true" /></span>
      <div><h2>Workspace agent</h2><span className={'agent-status' + (agent.isRunning ? ' running' : '')}>
        <span className={'status-dot ' + (modelReady ? '' : 'status-dot-amber')} />
        {agent.isRunning ? 'Run in progress' : modelReady ? 'Model configured' : 'Not configured'}</span></div>
      <div className="agent-header-actions">
        <ToolButton label="Conversations" icon={History} onClick={() => setHistory(value => !value)} disabled={agent.isRunning} />
        <ToolButton label="New conversation" icon={Plus} onClick={() => void agent.newConversation()}
          disabled={disabled || agent.isRunning || agent.creating} busy={agent.creating} />
        {onClose && <ToolButton label="Close agent" icon={X} onClick={onClose} />}
      </div>
    </header>
    <div className="agent-context"><BriefcaseBusiness size={14} aria-hidden="true" />
      <span>{job ? job.company + ' / ' + job.title : 'Workspace context'}</span>
      {job && <button className="context-open" type="button" aria-label="Open conversation role" title="Open conversation role"
        onClick={() => navigate({view: 'jobs', job: job.id, filter: job.archived ? 'archived' : 'active'})}><ArrowRight size={14} aria-hidden="true" /></button>}
    </div>
    {(history || (!conversationId && conversations.length > 0)) && <section className="conversation-history" aria-label="Saved conversations">
      <div className="mini-section-title"><span>CONVERSATIONS</span><span>{conversations.length}</span></div>
      {conversations.length ? <ul>{conversations.map(conversation => <li key={conversation.id}>
        <button type="button" disabled={agent.isRunning} aria-current={conversation.id === conversationId ? 'true' : undefined}
          onClick={() => { navigate({conversation: conversation.id}); setHistory(false); }}>
          <MessageSquare size={14} aria-hidden="true" /><span><strong>{conversation.title || 'Untitled conversation'}</strong>
            <time dateTime={conversation.updated_at}>{formatDate(conversation.updated_at)}</time></span>
        </button></li>)}</ul> : <p className="small muted">No saved conversations.</p>}
    </section>}
    <div className="conversation-heading"><span>{current?.conversation.title || (conversationId ? 'Conversation' : 'New conversation')}</span>
      {conversationId && <ToolButton label="Reload conversation" icon={RefreshCw} onClick={() => void agent.reload()}
        disabled={agent.isRunning || agent.loading || disabled} busy={agent.loading} />}</div>
    <div ref={transcript} className="transcript" role="log" aria-label="Conversation messages" aria-live="polite" aria-busy={agent.loading}
      onScroll={() => { const node = transcript.current; if (node) setNearBottom(node.scrollHeight - node.scrollTop - node.clientHeight < 90); }}>
      {agent.loading && !current ? <div className="conversation-loading" role="status"><LoaderCircle className="spin" size={18} aria-hidden="true" />Loading conversation</div>
        : !messages.length && !agent.streaming ? <EmptyState compact icon={Bot} title={conversationId ? 'No messages yet' : 'A clear view of your next move'}
          detail={conversationId ? undefined : job ? job.company + ' / ' + job.title : 'No conversation selected'} /> : null}
      {messages.map(message => <article key={message.id} className={'chat-message message-' + message.role}>
        <div className="message-meta">{message.role === 'assistant' ? <Bot size={13} aria-hidden="true" /> : message.role === 'tool' ? <Wrench size={13} aria-hidden="true" /> : <span className="user-mark" aria-hidden="true">Y</span>}
          <strong>{message.role === 'user' ? 'You' : message.role === 'assistant' ? 'Agent' : 'Tool'}</strong>
          <time dateTime={message.created_at}>{formatDate(message.created_at, true)}</time>
          {message.id.startsWith('pending-') && <span>Sending</span>}
        </div>{message.role === 'tool' ? <details className="tool-record">
          <summary>{eventTitle(message.content.name || 'Workspace read')}</summary><pre>{messageText(message)}</pre>
        </details> : <div className="message-text">{messageText(message)}</div>}
      </article>)}
      {agent.tools.map((tool, index) => <div className="tool-event" key={tool.name + index}><Wrench size={13} aria-hidden="true" />
        <div><strong>{eventTitle(tool.name)}</strong><p>{tool.summary}</p></div><Check size={12} aria-hidden="true" /></div>)}
      {agent.streamText && <article className="chat-message message-assistant streaming-message">
        <div className="message-meta"><Bot size={13} aria-hidden="true" /><strong>Agent</strong><span>{agent.isRunning ? 'Streaming' : 'Partial response'}</span></div>
        <div className="message-text">{agent.streamText}<span className="stream-cursor" aria-hidden="true" /></div>
      </article>}
      {agent.isRunning && <div className="run-status" role="status"><LoaderCircle size={13} className="spin" aria-hidden="true" />
        {agent.cancelling ? 'Stopping run' : agent.state ? eventTitle(agent.state) : 'Working'}</div>}
      {!agent.isRunning && failedRun && !agent.error && <Banner tone="warning">
        {eventTitle(failedRun.status)}{failedRun.error_code ? ' / ' + eventTitle(failedRun.error_code) : ''}
      </Banner>}
      {agent.error && <Banner>{agent.error}</Banner>}
      {proposals.map(proposal => <div className="proposal-item" key={proposal.id}>
        <div className="proposal-item-heading"><ShieldCheck size={15} aria-hidden="true" /><strong>Note update</strong><Pill tone="amber">Review</Pill></div>
        <p>{proposal.note || 'Empty note'}</p>
        <Button label="Review proposal" size="sm" variant="secondary" endContent={<Glyph icon={ArrowRight} />} onClick={() => onReview(proposal)} />
      </div>)}
      {!agent.isRunning&&messages.some(m=>m.role==='tool'&&m.content.name==='propose_candidate_fact')&&
       <Button label="Review candidate facts" size="sm" variant="secondary" endContent={<Glyph icon={ArrowRight}/>}
        onClick={()=>{navigate({view:'candidate'});onClose?.();}}/>}
    </div>
    {!nearBottom && <button type="button" className="latest-messages" onClick={() => {
      setNearBottom(true); transcript.current?.scrollTo({top: transcript.current.scrollHeight, behavior: 'smooth'});
    }}>Latest messages<ChevronDown size={13} aria-hidden="true" /></button>}
    {!modelReady && <div className="agent-unconfigured"><KeyStatus />
      <span>Model not configured</span><button type="button" className="text-link" onClick={() => navigate({view: 'settings'})}>Settings<Settings2 size={12} aria-hidden="true" /></button>
    </div>}
    <form className="composer" onSubmit={event => { event.preventDefault(); if (!disabled && modelReady && !overBudget) void agent.send(); }}>
      <label htmlFor={composerId} className="visually-hidden">Message agent</label>
      <textarea id={composerId} ref={composer} rows={3} value={agent.draft} onChange={event => agent.setDraft(event.target.value)}
        placeholder={modelReady ? 'Message agent...' : 'Model connection required'} disabled={disabled || !modelReady || agent.isRunning || agent.creating || agent.loading}
        onKeyDown={event => {
          if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing && event.keyCode !== 229) {
            event.preventDefault(); if (!disabled && modelReady && !overBudget) void agent.send();
          }
        }} />
      <div className="composer-bottom"><span className={'composer-budget tabular' + (overBudget ? ' over-budget' : '')}>
        {draftBytes ? draftBytes.toLocaleString() + ' B' : 'Private conversation'}</span>
        {agent.isRunning ? <Button label="Stop" size="sm" icon={<Glyph icon={Square} />} onClick={() => void agent.cancel()}
          isLoading={agent.cancelling} isDisabled={disabled} /> : <IconButton label="Send message" type="submit" variant="primary"
          icon={<Glyph icon={ArrowUp} />} isDisabled={disabled || !modelReady || !agent.draft.trim() || overBudget || agent.loading || agent.creating} />}
      </div>
    </form>
    <footer className="agent-footer"><ShieldCheck size={11} aria-hidden="true" />{data.settings.model.model || 'No model selected'}</footer>
  </aside>;
}

function KeyStatus() { return <Bot size={15} aria-hidden="true" />; }

export function ProposalReview({proposal, data, api, disabled, running, onClose, onResolved}: {
  proposal: Proposal | null; data: WorkspaceData; api: WorkspaceApi; disabled: boolean; running: boolean;
  onClose: () => void; onResolved: () => Promise<void>;
}) {
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [now, setNow] = useState(Date.now());
  useEffect(() => { setError(''); }, [proposal?.id]);
  useEffect(() => {
    if (!proposal) return;
    setNow(Date.now());
    const delay = Math.max(0, new Date(proposal.expires_at).getTime() - Date.now()) + 50;
    const timer = window.setTimeout(() => setNow(Date.now()), Math.min(delay, 2147483647));
    return () => window.clearTimeout(timer);
  }, [proposal]);
  const job = data.jobs.find(item => item.id === proposal?.job_id);
  const expired = proposal ? new Date(proposal.expires_at).getTime() <= now : false;
  const stale = Boolean(proposal && job && proposal.expected_revision !== job.revision);
  async function resolve(action: 'confirm' | 'reject') {
    if (!proposal || busy || disabled || (action === 'confirm' && (running || expired || stale || !job))) return;
    setBusy(action); setError('');
    try {
      await api.post('/api/proposals/' + encodeURIComponent(proposal.id) + '/' + action, {commandId: crypto.randomUUID()});
      await onResolved(); onClose();
    } catch (failure) { setError(errorMessage(failure)); await onResolved(); }
    finally { setBusy(''); }
  }
  return <Dialog isOpen={Boolean(proposal)} onOpenChange={value => { if (!value && !busy) onClose(); }}
    purpose="form" width={680} className="proposal-dialog">
    <DialogHeader title="Review note update" subtitle={job ? job.company + ' / ' + job.title : 'Role unavailable'}
      onOpenChange={busy ? undefined : onClose} />
    <div className="proposal-review-body">
      {error && <Banner>{error}</Banner>}
      {expired && <Banner tone="warning">This proposal has expired.</Banner>}
      {stale && <Banner tone="warning">The role has changed since this proposal. A new proposal is required.</Banner>}
      {running && <Banner tone="info">The agent run must finish before this proposal can be confirmed.</Banner>}
      <div className="proposal-revision"><Pill tone="amber">Pending approval</Pill><span className="small mono">Expected revision {proposal?.expected_revision}</span></div>
      <div className="note-comparison note-before"><h3>Current note</h3><pre>{job?.note || 'No current note'}</pre></div>
      <div className="note-comparison note-after"><h3>Proposed note</h3><pre>{proposal?.note || 'Empty note'}</pre></div>
      {proposal && <span className="small muted"><Clock3 size={12} aria-hidden="true" /> Expires {formatDate(proposal.expires_at, true)}</span>}
      <div className="dialog-actions"><Button label="Reject" variant="secondary" icon={<Glyph icon={X} />}
        onClick={() => void resolve('reject')} isDisabled={disabled || Boolean(busy)} isLoading={busy === 'reject'} />
        <Button label="Confirm update" variant="primary" icon={<Glyph icon={Check} />} onClick={() => void resolve('confirm')}
          isDisabled={disabled || Boolean(busy) || running || expired || stale || !job || proposal?.status !== 'pending'} isLoading={busy === 'confirm'} />
      </div>
    </div>
  </Dialog>;
}
