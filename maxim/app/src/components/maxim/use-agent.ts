'use client';

import {useCallback, useEffect, useRef, useState} from 'react';
import {ApiError, consumeRun, errorMessage, isAbort, type WorkspaceApi} from './api';
import type {Conversation, ConversationData, Message, Navigation} from './types';

export function messageText(message: Message): string {
  if (typeof message.content?.text === 'string') return message.content.text;
  if (message.role === 'tool' && typeof message.content?.summary === 'string') return message.content.summary;
  return '';
}

const activeStatuses = new Set(['running', 'queued', 'pending', 'cancelling']);

export function useAgent({api, conversationId, jobId, navigate, refresh}: {
  api: WorkspaceApi; conversationId: string | null; jobId: string | null;
  navigate: (selection: Navigation) => void; refresh: () => Promise<void>;
}) {
  const [detail, setDetail] = useState<ConversationData | null>(null);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [streaming, setStreaming] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [streamText, setStreamText] = useState('');
  const [tools, setTools] = useState<{name: string; summary: string}[]>([]);
  const [state, setState] = useState('');
  const [error, setError] = useState('');
  const [draft, setDraft] = useState('');
  const selected = useRef(conversationId);
  selected.current = conversationId;
  const activeConversation = useRef<string | null>(null);
  const controller = useRef<AbortController | null>(null);
  const locked = useRef(false);
  const cancelled = useRef(false);
  const mounted = useRef(true);
  const attempt = useRef<{text: string; conversationId: string; commandId: string} | null>(null);

  const load = useCallback(async (id: string, signal?: AbortSignal) => {
    const record = await api.get<ConversationData>('/api/conversations/' + encodeURIComponent(id), signal);
    if (selected.current === id && mounted.current) setDetail(record);
    return record;
  }, [api]);

  const reload = useCallback(async () => {
    const id = selected.current;
    if (!id) return;
    setLoading(true);
    try { await load(id); setError(''); }
    catch (failure) { if (!isAbort(failure)) setError(errorMessage(failure)); }
    finally { if (mounted.current) setLoading(false); }
  }, [load]);

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; controller.current?.abort(); };
  }, []);

  useEffect(() => {
    if (activeConversation.current && activeConversation.current !== conversationId) {
      const previous = activeConversation.current;
      void api.post('/api/conversations/' + encodeURIComponent(previous) + '/cancel', {}).catch(() => undefined);
      controller.current?.abort();
    }
    if (activeConversation.current === conversationId && conversationId) return;
    setDetail(null); setError(''); setStreamText(''); setTools([]); setState('');
    if (!conversationId) { setLoading(false); return; }
    const abort = new AbortController();
    setLoading(true);
    void load(conversationId, abort.signal).catch(failure => {
      if (!isAbort(failure)) setError(errorMessage(failure));
    }).finally(() => { if (!abort.signal.aborted) setLoading(false); });
    return () => abort.abort();
  }, [conversationId, load, api]);

  const persistedRunning = Boolean(detail?.conversation.id === conversationId && detail.runs.some(run => activeStatuses.has(run.status)));
  useEffect(() => {
    if (!persistedRunning || streaming || !conversationId) return;
    const abort = new AbortController();
    let remaining = 36;
    let timer: ReturnType<typeof setTimeout>;
    const poll = async () => {
      if (abort.signal.aborted || remaining <= 0) return;
      remaining -= 1;
      try {
        const record = await load(conversationId, abort.signal);
        if (!record.runs.some(run => activeStatuses.has(run.status))) { await refresh(); return; }
        if (remaining > 0 && !abort.signal.aborted) timer = setTimeout(() => void poll(), 2500);
        else if (!abort.signal.aborted) setError('The run is still active. Reload the conversation to check its status.');
      } catch (failure) { if (!isAbort(failure)) setError(errorMessage(failure)); }
    };
    timer = setTimeout(() => void poll(), 2500);
    return () => { abort.abort(); clearTimeout(timer); };
  }, [persistedRunning, streaming, conversationId, load, refresh]);

  async function provision(): Promise<Conversation> {
    const result = await api.post<{conversation: Conversation}>('/api/conversations', {
      commandId: crypto.randomUUID(), ...(jobId ? {jobId} : {}),
    });
    selected.current = result.conversation.id;
    setDetail({conversation: result.conversation, messages: [], runs: [], proposals: []});
    navigate({conversation: result.conversation.id});
    await refresh();
    return result.conversation;
  }

  async function newConversation() {
    if (locked.current || persistedRunning) return;
    locked.current = true; setCreating(true); setError('');
    try {
      await provision();
      setDraft(''); setStreamText(''); setTools([]); setState('');
    } catch (failure) { setError(errorMessage(failure)); }
    finally { locked.current = false; setCreating(false); }
  }

  async function send() {
    const text = draft.trim();
    if (!text || locked.current || persistedRunning || loading) return;
    locked.current = true; cancelled.current = false;
    setStreaming(true); setError(''); setState('starting'); setStreamText(''); setTools([]);
    let id = conversationId;
    try {
      if (!id) {
        const conversation = await provision();
        id = conversation.id;
      }
      activeConversation.current = id;
      if (attempt.current?.text !== text || attempt.current.conversationId !== id) {
        attempt.current = {text, conversationId: id, commandId: crypto.randomUUID()};
      }
      const optimistic: Message = {id: 'pending-' + attempt.current.commandId, role: 'user', content: {text}, created_at: new Date().toISOString()};
      setDetail(current => current?.conversation.id === id ? {
        ...current, messages: [...current.messages.filter(message => !message.id.startsWith('pending-')), optimistic],
      } : current);
      setDraft('');
      controller.current = new AbortController();
      const response = await api.postResponse('/api/conversations/' + encodeURIComponent(id) + '/messages', {
        commandId: attempt.current.commandId, text,
      }, controller.current.signal);
      await consumeRun(response, event => {
        if (!mounted.current || selected.current !== id) return;
        switch (event.event) {
          case 'status':
            if (typeof event.data.state === 'string') setState(event.data.state);
            break;
          case 'tool':
            if (typeof event.data.name === 'string' && typeof event.data.summary === 'string') {
              setTools(current => [...current, event.data]);
            }
            break;
          case 'delta': setStreamText(current => current + event.data.text); break;
          case 'done': setState('completed'); attempt.current = null; break;
          case 'error':
            setState('failed');
            setError(event.data.message || 'The agent run failed.');
            attempt.current = null;
            break;
        }
      });
    } catch (failure) {
      if (!isAbort(failure)) {
        setError(errorMessage(failure)); setState('interrupted');
        if (failure instanceof ApiError && failure.status >= 400 && failure.status < 500) setDraft(text);
      } else if (cancelled.current) setState('cancelled');
    } finally {
      // Persisted messages are authoritative, including partial and failed runs.
      if (id && mounted.current) {
        try {
          await load(id);
          if (selected.current === id) { setStreamText(''); setTools([]); }
        } catch (failure) {
          if (selected.current === id) setError('Could not reload the saved conversation. ' + errorMessage(failure));
        }
        await refresh();
      }
      activeConversation.current = null; controller.current = null; locked.current = false;
      if (mounted.current) { setStreaming(false); setCancelling(false); }
    }
  }

  async function cancel() {
    const id = activeConversation.current ?? conversationId;
    if (!id || cancelling) return;
    setCancelling(true);
    try {
      await api.post('/api/conversations/' + encodeURIComponent(id) + '/cancel', {});
      cancelled.current = true;
      controller.current?.abort();
      if (!controller.current) { await load(id); await refresh(); setState('cancelled'); }
    } catch (failure) { setError(errorMessage(failure)); }
    finally { if (!controller.current) setCancelling(false); }
  }

  return {detail, loading, creating, streaming, cancelling, streamText, tools, state, error,
    draft, setDraft, newConversation, send, cancel, reload, isRunning: streaming || persistedRunning};
}

export type AgentController = ReturnType<typeof useAgent>;
