'use client';

import {useEffect, useState, type ReactNode} from 'react';
import {Button} from '@astryxdesign/core/Button';
import {IconButton} from '@astryxdesign/core/IconButton';
import {Icon} from '@astryxdesign/core/Icon';
import {Tooltip} from '@astryxdesign/core/Tooltip';
import {AlertCircle, ArrowRight, CheckCircle2, LoaderCircle, ShieldCheck, type LucideIcon} from 'lucide-react';
import type {ActivityEvent, Job} from './types';

export function Glyph({icon, size = 'sm'}: {icon: LucideIcon; size?: 'sm' | 'md' | 'lg'}) {
  return <Icon icon={icon} size={size} />;
}

export function ToolButton({label, icon, onClick, disabled = false, busy = false, className = ''}: {
  label: string; icon: LucideIcon; onClick: () => void; disabled?: boolean; busy?: boolean; className?: string;
}) {
  return <Tooltip content={label} placement="above">
    <IconButton label={label} icon={<Glyph icon={icon} />} variant="ghost" size="md"
      isDisabled={disabled} isLoading={busy} onClick={onClick} className={'tool-button ' + className} />
  </Tooltip>;
}

export function Brand({compact = false}: {compact?: boolean}) {
  return <div className={'brand' + (compact ? ' brand-compact' : '')}>
    {/* This is the workspace mark, not a company logo or candidate image. */}
    <img src="/maxim-mark.svg" alt="" width={36} height={36} />
    <div><span className="brand-name">Maxim Apply</span>{!compact && <span className="brand-caption">WORKSPACE</span>}</div>
  </div>;
}

export function Pill({children, tone = 'neutral'}: {children: ReactNode; tone?: 'neutral' | 'green' | 'amber' | 'coral'}) {
  return <span className={'pill pill-' + tone}>{children}</span>;
}

export function Banner({children, tone = 'error', onDismiss}: {
  children: ReactNode; tone?: 'error' | 'warning' | 'success' | 'info'; onDismiss?: () => void;
}) {
  return <div className={'banner banner-' + tone} role={tone === 'error' ? 'alert' : 'status'}>
    <Glyph icon={tone === 'success' ? CheckCircle2 : AlertCircle} />
    <div className="banner-copy">{children}</div>
    {onDismiss && <button type="button" className="dismiss-text" onClick={onDismiss}>Dismiss</button>}
  </div>;
}

export function EmptyState({icon: Symbol, title, detail, action, compact = false}: {
  icon: LucideIcon; title: string; detail?: string; action?: ReactNode; compact?: boolean;
}) {
  return <div className={'empty-state' + (compact ? ' empty-compact' : '')}>
    <span className="empty-symbol"><Symbol size={24} strokeWidth={1.5} aria-hidden="true" /></span>
    <h3>{title}</h3>{detail && <p>{detail}</p>}{action && <div className="empty-action">{action}</div>}
  </div>;
}

export function WorkspaceLoading() {
  return <main className="boot-screen" aria-busy="true">
    <Brand /><div className="boot-status" role="status"><LoaderCircle size={18} className="spin" aria-hidden="true" />Opening workspace</div>
    <div className="boot-skeleton" aria-hidden="true"><i /><i /><i /></div>
  </main>;
}

export function ActionButton({label, onClick}: {label: string; onClick: () => void}) {
  return <Button label={label} variant="secondary" endContent={<Glyph icon={ArrowRight} />} onClick={onClick} />;
}

export function PrivacyStamp() {
  return <span className="privacy-stamp"><ShieldCheck size={13} aria-hidden="true" />Private workspace</span>;
}

export function initials(value: string): string {
  return value.trim().split(/\s+/).slice(0, 2).map(part => Array.from(part)[0] ?? '').join('').toUpperCase() || '?';
}

export function safeExternalUrl(value: string | null | undefined): string | undefined {
  if (!value) return undefined;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && !url.username && !url.password ? url.href : undefined;
  } catch { return undefined; }
}

export function formatDate(value: string, withTime = false): string {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return 'Unknown date';
  return new Intl.DateTimeFormat('en-US', {
    month: 'short', day: 'numeric', ...(withTime ? {hour: 'numeric', minute: '2-digit'} as const : {}),
  }).format(date);
}

export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return 'Unknown size';
  if (bytes < 1024) return bytes + ' B';
  return bytes < 1024 * 1024 ? (bytes / 1024).toFixed(1) + ' KB' : (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

export function eventTitle(value: string): string {
  return value.replace(/[._-]+/g, ' ').replace(/\b\w/g, character => character.toUpperCase());
}

export function eventJob(event: ActivityEvent, jobs: Job[]): Job | undefined {
  const id = event.payload && typeof event.payload.jobId === 'string' ? event.payload.jobId : event.entity_id;
  return jobs.find(job => job.id === id);
}

export function useOnline() {
  const [online, setOnline] = useState(true);
  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    update();
    window.addEventListener('online', update);
    window.addEventListener('offline', update);
    return () => {
      window.removeEventListener('online', update);
      window.removeEventListener('offline', update);
    };
  }, []);
  return online;
}

export function useMediaQuery(query: string) {
  const [matches, setMatches] = useState(false);
  useEffect(() => {
    const media = window.matchMedia(query);
    const update = () => setMatches(media.matches);
    update();
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, [query]);
  return matches;
}
