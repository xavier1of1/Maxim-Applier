import type {PostingPolicy} from './role-triage';
import type {JobFit} from './role-fit';

export type View = 'home' | 'archive' | 'jobs' | 'applications' | 'activity' | 'settings' | 'candidate' | 'answers' | 'discovery' | 'browser' | 'gmail' | 'discord' | 'networking' | 'interview';
export type RecordFilter = 'active' | 'archived';
export type Navigation = Partial<Record<'view' | 'job' | 'conversation' | 'filter' | 'source' | 'application' | 'knowledge' | 'question' | 'sort' | 'q' | 'company' | 'industry' | 'lane' | 'age' | 'minScore' | 'maxScore' | 'fit' | 'location' | 'locationGroup' | 'offset' | 'setup', string | null>>;

export interface WorkspaceIdentity {
  id: string;
  name: string;
  is_owner: boolean;
}

export interface Session {
  authenticated: true;
  csrfToken: string;
  workspace: WorkspaceIdentity;
  testMode: boolean;
}

export interface Job {
  fit?:JobFit|null;
  id: string;
  company: string;
  title: string;
  location: string | null;
  url: string | null;
  application_url?: string | null;
  description: string | null;
  note: string | null;
  revision: number;
  archived: boolean;
  compacted_at?:string|null;
  created_at: string;
  updated_at: string;
  application_id: string | null;
  opening_key?:string|null;
  discovery_state?:string;
  discovery_policy?:PostingPolicy;
  source_platform?:string|null;
  posting_detail_work?:{status:string;error_code:string|null}|null;
}

export interface Application {
  id: string;
  job_id: string;
  company: string;
  title: string;
  location: string | null;
  status: 'intent' | 'archived';
  workflow: string;
  outcome: string;
  revision: number;
  created_at: string;
}

export interface ActivityEvent {
  id: string;
  event_type: string;
  entity_id: string;
  payload: Record<string, unknown> | null;
  created_at: string;
}

export interface Conversation {
  id: string;
  title: string;
  job_id: string | null;
  updated_at: string;
}

export interface Proposal {
  run_id?: string;
  id: string;
  job_id: string;
  note: string;
  expected_revision: number;
  status: string;
  expires_at: string;
}

export interface ReferenceFile {
  id: string;
  job_id: string;
  name: string;
  bytes: number;
  created_at: string;
}

export interface ModelSettings {
  configured: boolean;
  hasKey: boolean;
  model: string;
  api?:'responses'|'chat_completions';
  provider: string;
  requestByteLimit: number;
  inputTokenBudget?:number;
  tokenizer?:string;
  outputTokenLimit: number;
}

export interface WorkspaceData {
  totals?:{leads:number;applications:number;events:number};
  jobPage?:{total:number;offset:number;limit:number;more:boolean;ids:string[]};
  facets?:{company:string[];industry:string[];lane:string[]};
  candidate?:{revision:number;ownership:string};
  workspace: WorkspaceIdentity;
  jobs: Job[];
  applications: Application[];
  events: ActivityEvent[];
  conversations: Conversation[];
  proposals: Proposal[];
  artifacts: ReferenceFile[];
  settings: {
    model: ModelSettings;
    testMode: boolean;
    ownership: 'new_workspace';
  };
  asOf: string;
  sourceStatus?:'empty'|'fresh'|'partial';
}

export interface Message {
  id: string;
  role: 'user' | 'assistant' | 'tool';
  content: {text?: string; summary?: string; name?: string};
  created_at: string;
}

export interface ConversationData {
  conversation: Conversation;
  messages: Message[];
  runs: {id: string; status: string; error_code: string | null;context_accounting?:{estimatedInputTokens:number;serializedTokens:number;outputReserve:number;encoding:string;providerUsage?:{prompt_tokens?:number;completion_tokens?:number}|null}[]}[];
  proposals: Proposal[];
}

export type Command =
  | {action: 'create_job'; payload: {company: string; title: string; location: string; url?: string; description: string}}
  | {action: 'create_intent'; payload: {jobId: string}}
  | {action: 'update_note'; payload: {jobId: string; expectedRevision: number; note: string}}
  | {action: 'archive_job'; payload: {jobId: string; expectedRevision: number; archived: boolean}}
  | {action: 'set_intent_status'; payload: {applicationId: string; expectedRevision: number; status: 'intent' | 'archived'}};

export type RunEvent =
  | {event: 'status'; data: {state: string}}
  | {event: 'tool'; data: {name: string; summary: string}}
  | {event: 'delta'; data: {text: string}}
  | {event: 'done'; data: {runId: string; conversationId: string}}
  | {event: 'error'; data: {code: string; message: string}};
