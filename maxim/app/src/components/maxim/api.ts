import type {Command, RunEvent} from './types';

export class ApiError extends Error {
  constructor(message: string, public code: string, public status = 0) {
    super(message);
    this.name = 'ApiError';
  }
}

export function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return 'The request could not be completed. Please try again.';
}

export function isAbort(error: unknown): boolean {
  return error instanceof Error && error.name === 'AbortError';
}

async function checkResponse(response: Response): Promise<Response> {
  if (response.ok) return response;
  let message = response.status >= 500
    ? 'The workspace service is unavailable. Please try again.'
    : 'The request could not be completed.';
  let code = 'HTTP_' + response.status;
  try {
    const body = await response.json();
    if (typeof body?.error?.message === 'string') message = body.error.message;
    if (typeof body?.error?.code === 'string') code = body.error.code;
  } catch {
    if (response.status === 401) message = 'Your session has expired. Sign in again.';
  }
  throw new ApiError(message, code, response.status);
}

export async function request(path: string, init: RequestInit = {}): Promise<Response> {
  let response: Response;
  try {
    response = await fetch(path, {...init, credentials: 'same-origin', cache: 'no-store'});
  } catch (error) {
    if (isAbort(error)) throw error;
    throw new ApiError('Cannot reach the workspace. Check your connection and retry.', 'NETWORK_ERROR');
  }
  return checkResponse(response);
}

export async function readJson<T>(response: Response): Promise<T> {
  try {
    return await response.json() as T;
  } catch {
    throw new ApiError('The service returned an unreadable response.', 'INVALID_RESPONSE', response.status);
  }
}

export class WorkspaceApi {
  constructor(private csrf: string, private onUnauthorized: () => void) {}

  private async perform(path: string, init: RequestInit): Promise<Response> {
    try {
      return await request(path, init);
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) this.onUnauthorized();
      throw error;
    }
  }

  async get<T>(path: string, signal?: AbortSignal): Promise<T> {
    return readJson<T>(await this.perform(path, {signal}));
  }

  async post<T>(path: string, body: unknown = {}, signal?: AbortSignal): Promise<T> {
    return readJson<T>(await this.postResponse(path, body, signal));
  }

  postResponse(path: string, body: unknown, signal?: AbortSignal): Promise<Response> {
    return this.perform(path, {
      method: 'POST',
      headers: {'Content-Type': 'application/json', 'x-csrf-token': this.csrf},
      body: JSON.stringify(body),
      signal,
    });
  }

  async upload<T>(body: FormData): Promise<T> {
    return readJson<T>(await this.perform('/api/artifacts', {
      method: 'POST', headers: {'x-csrf-token': this.csrf}, body,
    }));
  }

  async command<T>(command: Command, commandId = crypto.randomUUID()): Promise<T> {
    const result = await this.post<{result: T}>('/api/commands', {commandId, ...command});
    return result.result;
  }
}

export async function consumeRun(response: Response, onEvent: (event: RunEvent) => void): Promise<void> {
  if (!response.headers.get('content-type')?.includes('text/event-stream') || !response.body) {
    throw new ApiError('The agent did not return a stream. Refresh the conversation before retrying.', 'INVALID_STREAM');
  }
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let event = 'message';
  let data: string[] = [];
  let terminal = false;
  const dispatch = () => {
    if (!data.length) { event = 'message'; return; }
    const name = event;
    const raw = data.join('\n');
    data = [];
    event = 'message';
    if (!['status', 'tool', 'delta', 'done', 'error'].includes(name)) return;
    let payload: unknown;
    try { payload = JSON.parse(raw); }
    catch { throw new ApiError('The agent stream contained an invalid event.', 'INVALID_STREAM'); }
    if (!payload || typeof payload !== 'object') throw new ApiError('Invalid agent event.', 'INVALID_STREAM');
    const record = payload as Record<string, unknown>;
    if (name === 'delta' && typeof record.text !== 'string') throw new ApiError('Invalid agent text.', 'INVALID_STREAM');
    if (name === 'done' || name === 'error') terminal = true;
    onEvent({event: name, data: payload} as RunEvent);
  };
  const line = (value: string) => {
    if (!value) return dispatch();
    if (value.startsWith(':')) return;
    const colon = value.indexOf(':');
    const field = colon < 0 ? value : value.slice(0, colon);
    let content = colon < 0 ? '' : value.slice(colon + 1);
    if (content.startsWith(' ')) content = content.slice(1);
    if (field === 'event') event = content;
    if (field === 'data') data.push(content);
  };
  try {
    let streamEnded = false;
    let receivedBytes = 0;
    for (let chunks = 0; chunks < 100000; chunks += 1) {
      const {done, value} = await reader.read();
      receivedBytes += value?.byteLength ?? 0;
      if (receivedBytes > 8 * 1024 * 1024) throw new ApiError('The agent stream exceeded the transport limit.', 'INVALID_STREAM');
      buffer += done ? decoder.decode() : decoder.decode(value, {stream: true});
      let end: number;
      // A trailing CR may be the first half of a CRLF split across chunks.
      while ((end = buffer.search(/[\r\n]/)) >= 0) {
        if (!done && buffer[end] === '\r' && end === buffer.length - 1) break;
        const consumed = buffer[end] === '\r' && buffer[end + 1] === '\n' ? 2 : 1;
        line(buffer.slice(0, end));
        buffer = buffer.slice(end + consumed);
      }
      if (buffer.length > 262144) throw new ApiError('The agent event exceeded the transport limit.', 'INVALID_STREAM');
      if (done) { if (buffer) line(buffer); dispatch(); streamEnded = true; break; }
    }
    if (!streamEnded) throw new ApiError('The agent stream exceeded its chunk limit.', 'INVALID_STREAM');
    if (!terminal) throw new ApiError('The connection ended before the agent finished. Refresh to check the saved run.', 'STREAM_INTERRUPTED');
  } finally {
    await reader.cancel().catch(() => undefined);
    reader.releaseLock();
  }
}
