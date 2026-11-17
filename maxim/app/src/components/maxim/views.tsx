'use client';

import {useState} from 'react';
import {Button} from '@astryxdesign/core/Button';
import {TextInput} from '@astryxdesign/core/TextInput';
import {Selector} from '@astryxdesign/core/Selector';
import {Archive, ArchiveRestore, ArrowUpRight, BriefcaseBusiness, Clock3, History, Search, Send} from 'lucide-react';
import {errorMessage, type WorkspaceApi} from './api';
import {Banner, EmptyState, Pill, ToolButton, eventJob, eventTitle, formatDate, initials} from './shared';
import type {Application, Navigation, RecordFilter, WorkspaceData} from './types';

export function ApplicationsView({data, api, disabled, refresh, navigate, filter}: {
  data: WorkspaceData; api: WorkspaceApi; disabled: boolean; refresh: () => Promise<void>;
  navigate: (selection: Navigation) => void; filter: RecordFilter;
}) {
  const [search, setSearch] = useState('');
  const [pending, setPending] = useState('');
  const [error, setError] = useState('');
  const items = data.applications.filter(item => item.status === (filter === 'archived' ? 'archived' : 'intent') &&
    [item.company, item.title, item.location ?? ''].join(' ').toLowerCase().includes(search.toLowerCase().trim()))
    .sort((a, b) => b.created_at.localeCompare(a.created_at));
  async function changeStatus(item: Application) {
    if (disabled || pending) return;
    setPending(item.id); setError('');
    try {
      await api.command({action: 'set_intent_status', payload: {
        applicationId: item.id, expectedRevision: item.revision, status: item.status === 'intent' ? 'archived' : 'intent',
      }});
      await refresh();
    } catch (failure) { setError(errorMessage(failure)); await refresh(); }
    finally { setPending(''); }
  }
  return <section className="applications-view" aria-label="Application intents">
    <div className="view-toolbar">
      <TextInput label="Search application intents" isLabelHidden value={search} onChange={setSearch}
        type="search" placeholder="Search applications..." startIcon={Search} hasClear width={300} />
      <Selector label="Application status" isLabelHidden value={filter} onChange={value => navigate({filter: value})}
        options={[{value: 'active', label: 'Active intents'}, {value: 'archived', label: 'Archived intents'}]} width={180} />
      <span className="small muted toolbar-count">{items.length} records</span>
    </div>
    {error && <div className="view-alert"><Banner onDismiss={() => setError('')}>{error}</Banner></div>}
    {items.length ? <div className="table-scroll"><table className="applications-table">
      <caption className="visually-hidden">Persisted application intents</caption>
      <thead><tr><th scope="col">Company / role</th><th scope="col">Location</th><th scope="col">Status</th><th scope="col">Created</th><th scope="col"><span className="visually-hidden">Actions</span></th></tr></thead>
      <tbody>{items.map(item => <tr key={item.id}>
        <td><button type="button" className="application-role" onClick={() => {
          const job = data.jobs.find(record => record.id === item.job_id);
          navigate({view: 'jobs', job: item.job_id, filter: job?.archived ? 'archived' : 'active'});
        }}><span className="company-monogram" aria-hidden="true">{initials(item.company)}</span>
          <span><strong>{item.title}</strong><span className="muted">{item.company}</span></span><ArrowUpRight size={14} aria-hidden="true" /></button></td>
        <td className="location-cell">{item.location || 'Not specified'}</td>
        <td><Pill tone={item.status === 'intent' ? 'amber' : 'neutral'}>{item.status === 'intent' ? 'Intent' : 'Archived'}</Pill></td>
        <td><time dateTime={item.created_at}>{formatDate(item.created_at)}</time></td>
        <td><ToolButton label={item.status === 'intent' ? 'Archive intent' : 'Restore intent'}
          icon={item.status === 'intent' ? Archive : ArchiveRestore} onClick={() => void changeStatus(item)}
          busy={pending === item.id} disabled={disabled || Boolean(pending)} /></td>
      </tr>)}</tbody>
    </table></div> : <EmptyState icon={filter === 'archived' ? Archive : Send}
      title={search ? 'No matching applications' : filter === 'archived' ? 'No archived intents' : 'No application intents'}
      detail={search ? 'Try a different company or title.' : filter === 'active' ? 'No submission is recorded.' : undefined}
      action={<Button label={search ? 'Clear search' : 'View roles'} variant="secondary" onClick={() => search ? setSearch('') : navigate({view: 'jobs', filter: 'active'})} />} />}
    <div className="view-footnote"><BriefcaseBusiness size={14} aria-hidden="true" /><span>Application intents</span><span className="separator-dot" /> <span>Not submitted applications</span></div>
  </section>;
}

export function ActivityView({data, navigate}: {data: WorkspaceData; navigate: (selection: Navigation) => void}) {
  const [search, setSearch] = useState('');
  const events = [...data.events].sort((a, b) => b.created_at.localeCompare(a.created_at)).filter(event => {
    const job = eventJob(event, data.jobs);
    return [eventTitle(event.event_type), job?.company ?? '', job?.title ?? ''].join(' ').toLowerCase().includes(search.toLowerCase().trim());
  });
  return <section className="activity-view" aria-label="Workspace activity">
    <div className="view-toolbar"><TextInput label="Search activity" isLabelHidden type="search" value={search}
      onChange={setSearch} startIcon={Search} hasClear placeholder="Search activity..." width={300} />
      <span className="small muted toolbar-count">{events.length} events</span></div>
    {events.length ? <ol className="event-list">{events.map(event => {
      const job = eventJob(event, data.jobs);
      return <li key={event.id}>
        <span className="event-marker"><Clock3 size={16} aria-hidden="true" /></span>
        <div className="event-content"><strong>{eventTitle(event.event_type)}</strong>
          {job ? <button type="button" className="text-link event-role" onClick={() => navigate({view: 'jobs', job: job.id, filter: job.archived ? 'archived' : 'active'})}>{job.company} / {job.title}<ArrowUpRight size={12} aria-hidden="true" /></button>
            : <span className="small muted">Workspace event</span>}
        </div>
        <time dateTime={event.created_at} title={new Date(event.created_at).toLocaleString()}>{formatDate(event.created_at, true)}</time>
      </li>;
    })}</ol> : <EmptyState icon={History} title={search ? 'No matching activity' : 'No activity yet'}
      detail={search ? 'Try another event or role.' : 'No workspace changes have been recorded.'}
      action={search ? <Button label="Clear search" onClick={() => setSearch('')} /> : undefined} />}
  </section>;
}
