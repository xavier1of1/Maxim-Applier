'use client';

import {useEffect, useRef, useState, type FormEvent} from 'react';
import {useSearchParams} from 'next/navigation';
import {JobFilters} from './job-filters';
import {Button} from '@astryxdesign/core/Button';
import {TextInput} from '@astryxdesign/core/TextInput';
import {TextArea} from '@astryxdesign/core/TextArea';
import {Selector} from '@astryxdesign/core/Selector';
import {Dialog, DialogHeader} from '@astryxdesign/core/Dialog';
import {Archive, ArchiveRestore, ArrowLeft, ArrowUpRight, BriefcaseBusiness, Check, Download,
  FileText, MapPin, MessageSquare, Paperclip, Plus, RefreshCw, RotateCcw, Save, Search, Send, Upload} from 'lucide-react';
import {ApiError, errorMessage, type WorkspaceApi} from './api';
import {Banner, EmptyState, Glyph, Pill, ToolButton, formatBytes, formatDate, initials, safeExternalUrl} from './shared';
import type {Job, Navigation, RecordFilter, WorkspaceData} from './types';
import {locationFilters,locationMatches,rolePolicyLabel} from './role-triage';
import {useBoundedRefresh} from './use-bounded-refresh';
import {currentScore,fitLabel,roleSorts,sortRoles} from './role-fit';

type SharedProps = {
  data: WorkspaceData;
  api: WorkspaceApi;
  disabled: boolean;
  refresh: () => Promise<void>;
  navigate: (selection: Navigation) => void;
};

export function CreateRoleDialog({open, onClose, api, disabled, onCreated}: {
  open: boolean; onClose: () => void; api: WorkspaceApi; disabled: boolean; onCreated: (job: Job) => Promise<void>;
}) {
  const [form, setForm] = useState({company: '', title: '', location: '', url: '', description: ''});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const attempt = useRef<{key: string; id: string} | null>(null);
  const lock = useRef(false);
  const change = (field: keyof typeof form, value: string) => {
    setForm(current => ({...current, [field]: value}));
    setErrors(current => ({...current, [field]: ''}));
    setError('');
  };
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (disabled || lock.current) return;
    const validation: Record<string, string> = {};
    if (!form.company.trim()) validation.company = 'Enter a company.';
    if (!form.title.trim()) validation.title = 'Enter a role title.';
    if (form.url.trim() && !safeExternalUrl(form.url.trim())) validation.url = 'Enter an HTTPS posting URL without credentials.';
    setErrors(validation);
    if (Object.keys(validation).length) return;
    const payload = {...form, company: form.company.trim(), title: form.title.trim(),
      location: form.location.trim(), url: form.url.trim() || undefined};
    const key = JSON.stringify(payload);
    if (attempt.current?.key !== key) attempt.current = {key, id: crypto.randomUUID()};
    lock.current = true;
    setBusy(true);
    setError('');
    try {
      const job = await api.command<Job>({action: 'create_job', payload}, attempt.current.id);
      await onCreated(job);
      setForm({company: '', title: '', location: '', url: '', description: ''});
      attempt.current = null;
      onClose();
    } catch (failure) { setError(errorMessage(failure)); }
    finally { lock.current = false; setBusy(false); }
  }
  const fieldStatus = (field: string) => errors[field] ? {type: 'error' as const, message: errors[field]} : undefined;
  return <Dialog isOpen={open} onOpenChange={value => { if (!value && !busy) onClose(); }} purpose="form" width={620} className="form-dialog">
    <DialogHeader title="New role" subtitle="Job record" onOpenChange={busy ? undefined : () => onClose()} />
    <form onSubmit={submit} className="dialog-form">
      {error && <Banner>{error}</Banner>}
      <div className="form-grid">
        <TextInput label="Company" value={form.company} onChange={value => change('company', value)}
          isRequired hasAutoFocus isDisabled={busy} status={fieldStatus('company')} statusVariant="detached" htmlName="company" />
        <TextInput label="Role title" value={form.title} onChange={value => change('title', value)}
          isRequired isDisabled={busy} status={fieldStatus('title')} statusVariant="detached" htmlName="title" />
      </div>
      <TextInput label="Location" value={form.location} onChange={value => change('location', value)}
        isDisabled={busy} htmlName="location" placeholder="Location or remote" />
      <TextInput label="Posting URL" type="url" value={form.url} onChange={value => change('url', value)}
        isDisabled={busy} htmlName="url" placeholder="https://" status={fieldStatus('url')} statusVariant="detached" />
      <TextArea label="Job description" value={form.description} onChange={value => change('description', value)}
        isDisabled={busy} htmlName="description" rows={6} />
      <div className="dialog-actions">
        <Button label="Cancel" variant="ghost" onClick={onClose} isDisabled={busy} />
        <Button label="Create role" type="submit" variant="primary" icon={<Glyph icon={Plus} />}
          isLoading={busy} isDisabled={disabled} />
      </div>
    </form>
  </Dialog>;
}

export function JobsView({data, api, disabled, refresh, navigate, selectedId, filter,sort, onCreate, onDirtyChange, onAgent}: SharedProps & {
  selectedId: string | null; filter: RecordFilter;sort:string; onCreate: () => void; onDirtyChange: (dirty: boolean) => void; onAgent: () => void;
}) {
  const params=useSearchParams(),search=params.get('q')||'',location=params.get('locationGroup')||'focus';
  const matching=data.jobs.filter(job=>data.jobPage?data.jobPage.ids.includes(job.id):job.archived===(filter==='archived'));
  const jobs=sortRoles(matching,sort);
  const evaluated=jobs.filter(job=>currentScore(job.fit)!==null).length;
  useBoundedRefresh(data.jobs.some(job=>['queued','running'].includes(job.fit?.status||'')),refresh);
  const employers=new Set(jobs.map(job=>job.company)).size;
  const selected = data.jobs.find(job => job.id === selectedId);
  return <div className={'jobs-workbench' + (selectedId ? ' has-selection' : '')}>
    <section className="role-list" aria-label="Job records">
      <div className="list-controls">
        <JobFilters data={data} navigate={navigate}/>
        <div className="list-filter-row">
          <Selector label="Role status" isLabelHidden value={filter} size="sm" variant="ghost"
            onChange={value => navigate({filter: value,offset:null})} options={[
              {value: 'active', label: 'Active roles'}, {value: 'archived', label: 'Archived roles'},
            ]} />
          <span className="muted small tabular">{jobs.length} {jobs.length === 1 ? 'role' : 'roles'} / {employers} {employers===1?'employer':'employers'}</span>
        </div>
        {filter==='active'&&<Selector label="Filter roles by location" isLabelHidden value={location} onChange={value=>navigate({locationGroup:value,offset:null})} options={locationFilters} width="100%" size="sm"/>}
        <Selector label="Sort roles" isLabelHidden value={sort} onChange={value=>navigate({sort:value,offset:null})} options={roleSorts} width="100%" size="sm"/>
        <span className="small muted tabular">{evaluated} evaluated / {jobs.length-evaluated} without a current score</span>
      </div>
      {data.jobPage&&<div className="list-filter-row page-controls"><ToolButton label="Previous jobs" icon={ArrowLeft} disabled={!data.jobPage.offset} onClick={()=>navigate({offset:String(Math.max(0,data.jobPage!.offset-data.jobPage!.limit))})}/><span className="small tabular">{data.jobPage.total} matches</span><ToolButton label="Next jobs" icon={ArrowUpRight} disabled={!data.jobPage.more} onClick={()=>navigate({offset:String(data.jobPage!.offset+data.jobPage!.limit)})}/></div>}
      <div className="role-rows">
        {jobs.map(job => <button type="button" key={job.id} className={'role-row' + (selectedId === job.id ? ' selected' : '')}
          aria-current={selectedId === job.id ? 'true' : undefined} onClick={() => navigate({job: job.id})}>
          <span className="company-monogram" aria-hidden="true">{initials(job.company)}</span>
          <span className="role-row-copy"><span className="role-company">{job.company}</span><strong>{job.title}</strong>
            <span className="role-location"><MapPin size={12} aria-hidden="true" />{job.location || 'Location not specified'}</span>
            <span className="role-row-meta"><span>{formatDate(job.updated_at)}</span>
              <span title="Career-Ops fit"><Pill tone={fitLabel(job.fit).tone}>{fitLabel(job.fit).label}</Pill></span>
              {job.opening_key&&<Pill tone={rolePolicyLabel(job).tone}>{rolePolicyLabel(job).label}</Pill>}
              {job.application_id && <span className="intent-dot">Application intent</span>}</span>
          </span>
          <span className="row-chevron" aria-hidden="true"><ArrowUpRight size={14} /></span>
        </button>)}
        {!jobs.length && <EmptyState compact icon={filter === 'archived' ? Archive : BriefcaseBusiness}
          title={search||matching.length ? 'No matching roles' : filter === 'archived' ? 'Archive is empty' : 'No roles yet'}
          detail={search ? 'Try another company, title, or location.' : undefined}
          action={search ? <Button label="Clear search" variant="ghost" onClick={() => navigate({q:null,offset:null})} />
            : matching.length&&filter==='active' ? <Button label="All locations" onClick={()=>navigate({locationGroup:'all',offset:null})}/>
            : filter === 'active' ? <Button label="New role" icon={<Glyph icon={Plus} />} onClick={onCreate} isDisabled={disabled} /> : undefined} />}
      </div>
      <div className="list-footer"><span className="status-dot" />Workspace records <span className="mono">{data.jobs.length}</span></div>
    </section>
    {selected ? <JobDetail key={selected.id} job={selected} data={data} api={api} disabled={disabled}
      refresh={refresh} navigate={navigate} onDirtyChange={onDirtyChange} onAgent={onAgent} />
      : <section className="detail-placeholder" aria-label="Role details">
        <EmptyState icon={BriefcaseBusiness} title={selectedId ? 'Role unavailable' : 'Your next move starts here'}
          detail={selectedId ? 'This role is not in the current workspace.' : data.jobs.length ? 'Select a role to view its record.' : 'No active roles in this workspace.'}
          action={selectedId ? <Button label="Back to roles" variant="secondary" onClick={() => navigate({job: null})} />
            : !data.jobs.length ? <Button label="Add a role" variant="primary" icon={<Glyph icon={Plus} />} onClick={onCreate} isDisabled={disabled} /> : undefined} />
      </section>}
  </div>;
}

function JobDetail({job, data, api, disabled, refresh, navigate, onDirtyChange, onAgent}: SharedProps & {
  job: Job; onDirtyChange: (dirty: boolean) => void; onAgent: () => void;
}) {
  const [note, setNote] = useState(job.note ?? '');
  const [base, setBase] = useState({note: job.note ?? '', revision: job.revision});
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const fileInput = useRef<HTMLInputElement>(null);
  const attempt = useRef<{key: string; id: string} | null>(null);
  const dirty = note !== base.note;
  const conflict = dirty && job.revision !== base.revision;
  const detailPending=['queued','running'].includes(job.posting_detail_work?.status||'');
  useBoundedRefresh(detailPending,refresh);
  async function fetchPosting(){
    if(disabled||busy||detailPending)return;
    setBusy('posting');setError('');
    try{
      await api.post('/api/discovery/commands',{commandId:crypto.randomUUID(),action:'fetch_posting_details',payload:{jobId:job.id,expectedRevision:job.revision}});
      await refresh();
    }catch(failure){setError(errorMessage(failure));}
    finally{setBusy('');}
  }
  const files = data.artifacts.filter(file => file.job_id === job.id);
  const application = data.applications.find(item => item.job_id === job.id);
  const score=currentScore(job.fit),fit=fitLabel(job.fit),evaluating=['queued','running'].includes(job.fit?.status||'');
  async function evaluate(){
    if(disabled||busy||evaluating||!data.candidate)return;
    setBusy('evaluate');setError('');
    try{await api.post('/api/evaluations/commands',{commandId:crypto.randomUUID(),action:'start_evaluation',payload:{jobId:job.id,expectedJobRevision:job.revision,expectedCandidateRevision:data.candidate.revision}});await refresh();}
    catch(failure){setError(errorMessage(failure));}finally{setBusy('');}
  }
  const url = safeExternalUrl(job.url);
  useEffect(() => { onDirtyChange(dirty); return () => onDirtyChange(false); }, [dirty, onDirtyChange]);
  useEffect(() => {
    if (!dirty && job.revision >= base.revision) {
      setNote(job.note ?? '');
      setBase({note: job.note ?? '', revision: job.revision});
    }
  }, [job.note, job.revision, dirty, base.revision]);
  async function saveNote(event: FormEvent) {
    event.preventDefault();
    if (disabled || busy || !dirty || conflict) return;
    const key = JSON.stringify({note, revision: base.revision});
    if (attempt.current?.key !== key) attempt.current = {key, id: crypto.randomUUID()};
    setBusy('note'); setError(''); setSaved(false);
    try {
      const result = await api.command<Job>({action: 'update_note', payload: {
        jobId: job.id, expectedRevision: base.revision, note,
      }}, attempt.current.id);
      setBase({note: result.note ?? note, revision: result.revision});
      setNote(result.note ?? note);
      setSaved(true);
      attempt.current = null;
      await refresh();
    } catch (failure) {
      setError(errorMessage(failure));
      if (failure instanceof ApiError && failure.status === 409) await refresh();
    } finally { setBusy(''); }
  }
  async function toggleArchive() {
    if (busy || disabled || dirty) return;
    setBusy('archive'); setError('');
    try {
      if(job.compacted_at&&job.archived)await api.post('/api/intelligence/retention',{commandId:crypto.randomUUID(),action:'restore',payload:{jobId:job.id}});
      else await api.command<Job>({action: 'archive_job', payload: {
        jobId: job.id, expectedRevision: job.revision, archived: !job.archived,
      }});
      await refresh();
      navigate({filter: job.archived ? 'active' : 'archived'});
    } catch (failure) { setError(errorMessage(failure)); await refresh(); }
    finally { setBusy(''); }
  }
  async function createIntent() {
    if (busy || disabled || application) return;
    setBusy('intent'); setError('');
    try { await api.command({action: 'create_intent', payload: {jobId: job.id}}); await refresh(); }
    catch (failure) { setError(errorMessage(failure)); }
    finally { setBusy(''); }
  }
  async function upload(file: File | undefined) {
    if (!file || uploading || disabled) return;
    setUploadError('');
    if (!/\.(pdf|txt|md)$/i.test(file.name)) { setUploadError('Choose a PDF, text, or Markdown file.'); return; }
    if (!file.size || file.size > 10 * 1024 * 1024) { setUploadError(file.size ? 'The file exceeds the 10 MB limit.' : 'The file is empty.'); return; }
    const body = new FormData();
    body.set('file', file); body.set('jobId', job.id); body.set('commandId', crypto.randomUUID());
    setUploading(true);
    try { await api.upload(body); await refresh(); }
    catch (failure) { setUploadError(errorMessage(failure)); }
    finally { setUploading(false); if (fileInput.current) fileInput.current.value = ''; }
  }
  return <article className="job-detail" aria-label={job.title + ' at ' + job.company}>
    <div className="detail-topline">
      <button type="button" className="back-to-list" onClick={() => navigate({job: null})}><ArrowLeft size={16} aria-hidden="true" />All roles</button>
      <span className="eyebrow">ROLE RECORD</span>
      <span className="record-revision mono">rev {job.revision}</span>
    </div>
    <header className="job-heading">
      <div className="job-company-line"><span className="company-monogram company-monogram-lg" aria-hidden="true">{initials(job.company)}</span>
        <span>{job.company}</span><Pill tone={job.archived ? 'neutral' : 'green'}>{job.archived ? 'Archived' : 'Active'}</Pill></div>
      <h2>{job.title}</h2>
      <div className="job-facts"><span><MapPin size={14} aria-hidden="true" />{job.location || 'Location not specified'}</span>
        {url && <a href={url} target="_blank" rel="noopener noreferrer">Original posting<ArrowUpRight size={14} aria-hidden="true" /></a>}</div>
      <div className="job-actions">
        {application ? <Button label={application.status === 'archived' ? 'Archived intent' : 'Application intent'}
          icon={<Glyph icon={Check} />} onClick={() => navigate({view: 'applications',application:application.id, filter: application.status === 'archived' ? 'archived' : 'active'})} />
          : <Button label="Create intent" variant="primary" icon={<Glyph icon={Send} />}
            onClick={createIntent} isLoading={busy === 'intent'} isDisabled={disabled || Boolean(busy) || job.archived} />}
        <ToolButton label="Discuss role with agent" icon={MessageSquare} onClick={onAgent} />
        <ToolButton label={dirty ? 'Save or discard your note before archiving' : job.archived ? 'Restore role' : 'Archive role'}
          icon={job.archived ? ArchiveRestore : Archive} onClick={toggleArchive} busy={busy === 'archive'}
          disabled={disabled || Boolean(busy) || dirty} />
      </div>
    </header>
    {error && <div className="detail-alert"><Banner onDismiss={() => setError('')}>{error}</Banner></div>}
    <div className="detail-sections">
      <section className="record-section" aria-label="Career-Ops fit">
        <div className="section-heading"><h3>Career-Ops fit</h3><Pill tone={fit.tone}>{fit.label}</Pill></div>
        {score!==null?<p className="small muted">Evaluated {job.fit?.completed_at?formatDate(job.fit.completed_at,true):''} / candidate revision {job.fit?.candidate_revision}</p>
          :<p className="small muted">{!job.fit?'Scanned or saved, but not yet evaluated against your approved experience.':job.fit.status==='completed'||job.fit.status==='stale'?'The saved evaluation is outdated. Evaluate the current candidate and posting.':fit.label+'. No current fit score is available.'}</p>}
        {(job.description||'').trim().length<50&&<p className="small muted">A full job description is required before evaluation.</p>}
        <div className="inline-actions job-fit-actions">
          <Button label={score===null?'Evaluate with Career-Ops':'Re-evaluate with Career-Ops'} icon={<Glyph icon={FileText}/>} variant="secondary" onClick={()=>void evaluate()}
            isLoading={busy==='evaluate'||evaluating} isDisabled={disabled||Boolean(busy)||evaluating||job.archived||!data.settings.model.configured||data.candidate?.ownership!=='canonical'||(job.description||'').trim().length<50}/>
          {job.fit?.report_artifact_id&&<a className="text-link" href={'/api/artifacts/'+job.fit.report_artifact_id} target="_blank" rel="noreferrer">{score===null?'Previous report':'Full evaluation report'}<ArrowUpRight size={14}/></a>}
          {data.candidate?.ownership!=='canonical'&&<Button label="Review candidate knowledge" variant="ghost" onClick={()=>navigate({view:'candidate',knowledge:'facts'})}/>}
          {!data.settings.model.configured&&<Button label="Configure evaluation model" variant="ghost" onClick={()=>navigate({view:'settings'})}/>}
        </div>
      </section>
      <section className="record-section">
        <div className="section-heading"><h3><FileText size={16} aria-hidden="true" />Job description</h3></div>
        {job.description ? <p className="posting-text">{job.description}</p> : <p className="muted section-empty">{job.source_platform==='greenhouse'?'Board summary only':'No description added.'}</p>}
        {job.source_platform==='greenhouse'&&!job.archived&&(!job.description||job.description.trim().length<50)&&<div className="inline-actions">
          <Button label="Fetch full posting" icon={<Glyph icon={RefreshCw}/>} onClick={()=>void fetchPosting()} isDisabled={disabled||Boolean(busy)||detailPending} isLoading={busy==='posting'||detailPending}/>
          {detailPending&&<Pill tone="amber">{job.posting_detail_work?.status}</Pill>}
          {job.posting_detail_work?.error_code&&<Pill tone="coral">{job.posting_detail_work.error_code.replaceAll('_',' ')}</Pill>}
        </div>}
      </section>
      <section className="record-section">
        <div className="section-heading"><h3><MessageSquare size={16} aria-hidden="true" />Working note</h3>
          {dirty ? <Pill tone={conflict ? 'coral' : 'amber'}>{conflict ? 'Revision changed' : 'Unsaved'}</Pill>
            : saved && <span className="saved-indicator" role="status"><Check size={13} aria-hidden="true" />Saved</span>}</div>
        {conflict && <Banner tone="warning">This role changed while you were editing. Your draft is preserved. Discard it to load the current note.</Banner>}
        <form onSubmit={saveNote} className="note-form">
          <TextArea label="Working note" isLabelHidden value={note} onChange={value => { setNote(value); setSaved(false); }}
            rows={5} htmlName="note" placeholder="Add a note..." isDisabled={Boolean(busy) || disabled} width="100%" />
          <div className="note-actions"><span className="small muted">Updated {formatDate(job.updated_at, true)}</span>
            <div className="inline-actions">
              {dirty && <ToolButton label="Discard note changes" icon={RotateCcw} onClick={() => {
                setNote(job.note ?? ''); setBase({note: job.note ?? '', revision: job.revision}); setError('');
              }} disabled={Boolean(busy)} />}
              <Button label="Save note" type="submit" size="sm" icon={<Glyph icon={Save} />} variant="secondary"
                isLoading={busy === 'note'} isDisabled={!dirty || disabled || conflict || Boolean(busy)} />
            </div></div>
        </form>
      </section>
      <section className="record-section">
        <div className="section-heading"><h3><Paperclip size={16} aria-hidden="true" />Reference files <span className="section-count">{files.length}</span></h3>
          <Button label="Upload" size="sm" variant="ghost" icon={<Glyph icon={Upload} />} isLoading={uploading}
            isDisabled={disabled} onClick={() => fileInput.current?.click()} /></div>
        <input ref={fileInput} type="file" accept=".pdf,.txt,.md,application/pdf,text/plain,text/markdown"
          className="visually-hidden" tabIndex={-1} aria-label="Upload reference file" onChange={event => void upload(event.target.files?.[0])} />
        {uploadError && <Banner onDismiss={() => setUploadError('')}>{uploadError}</Banner>}
        {files.length ? <ul className="reference-files">{files.map(file => <li key={file.id}>
          <span className="file-icon"><FileText size={18} aria-hidden="true" /></span>
          <div className="file-copy"><strong>{file.name}</strong><span>{formatBytes(file.bytes)} <span aria-hidden="true">/</span> {formatDate(file.created_at)} <span className="reference-label">Reference</span></span></div>
          <a href={'/api/artifacts/' + encodeURIComponent(file.id)} download className="download-link" aria-label={'Download ' + file.name} title={'Download ' + file.name}><Download size={16} aria-hidden="true" /></a>
        </li>)}</ul> : <p className="muted section-empty">No reference files. <span className="file-limits">PDF, TXT, MD / 10 MB max</span></p>}
      </section>
    </div>
    <footer className="record-footer"><span>Added {formatDate(job.created_at)}</span><span className="mono" title={job.id}>{job.id.slice(0, 8)}</span></footer>
  </article>;
}
