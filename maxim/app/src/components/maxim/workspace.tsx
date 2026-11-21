'use client';

import {useCallback, useEffect, useMemo, useRef, useState, type FormEvent, type MouseEvent} from 'react';
import {usePathname, useRouter, useSearchParams} from 'next/navigation';
import {Button} from '@astryxdesign/core/Button';
import {TextInput} from '@astryxdesign/core/TextInput';
import {Dialog, DialogHeader} from '@astryxdesign/core/Dialog';
import {Activity, ArrowRight, Bot, BookOpen, BriefcaseBusiness, ChevronRight, CircleCheck, FileCheck2, History,
  KeyRound, LayoutGrid, LockKeyhole, Menu, MessageSquare, Plus, RefreshCw, Send, Settings2,
  ShieldCheck, WifiOff, X} from 'lucide-react';
import {ApiError, WorkspaceApi, errorMessage, isAbort, readJson, request} from './api';
import {AgentPanel, ProposalReview} from './agent';
import {CreateRoleDialog, JobsView} from './jobs';
import {SettingsView} from './settings';
import {ArchiveView} from './intelligence';
import {HomeView} from './home';
import {CandidateView} from './candidate';
import {AnswersView} from './answers';
import {DiscoveryView} from './discovery';
import {ApplicationsView, ActivityView} from './views';
import {BrowserView} from './browser';
import {Monitor,Mail,Bell,Users} from 'lucide-react';
import {GmailView} from './gmail';
import {DiscordView} from './discord';
import {NetworkingView} from './networking';
import {InterviewView} from './interview';
import {useAgent} from './use-agent';
import {Banner, Brand, EmptyState, Glyph, Pill, PrivacyStamp, ToolButton, WorkspaceLoading, formatDate, useMediaQuery, useOnline} from './shared';
import type {Navigation, Proposal, Session, View, WorkspaceData} from './types';
import {roleSort} from './role-fit';

const navigation = [
  {view: 'home' as const, label: 'Home', icon: LayoutGrid},
  {view: 'jobs' as const, label: 'Jobs', icon: BriefcaseBusiness},
  {view: 'archive' as const, label: 'Archive', icon: History},
  {view: 'discovery' as const, label: 'Discovery', icon: LayoutGrid},
  {view: 'candidate' as const, label: 'Candidate', icon: ShieldCheck},
  {view: 'answers' as const, label: 'Answers', icon: BookOpen},
  {view: 'applications' as const, label: 'Applications', icon: Send},
  {view: 'browser' as const, label: 'Apply Assistant', icon: Monitor},
  {view: 'gmail' as const, label: 'Gmail', icon: Mail},
  {view: 'discord' as const, label: 'Discord', icon: Bell},
  {view: 'networking' as const, label: 'Networking', icon: Users},
  {view: 'interview' as const, label: 'Interview practice', icon: MessageSquare},
  {view: 'activity' as const, label: 'Activity', icon: History},
  {view: 'settings' as const, label: 'Settings', icon: Settings2},
];

export function WorkspaceApp() {
  const [session, setSession] = useState<Session | null | undefined>();
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [version, setVersion] = useState(0);
  const router = useRouter();
  const pathname = usePathname();
  useEffect(() => {
    const controller = new AbortController();
    setError('');
    void request('/api/session', {signal: controller.signal}).then(readJson<Session>).then(result => {
      if (!result.authenticated || !result.csrfToken || !result.workspace?.id) throw new ApiError('Invalid session response.', 'INVALID_RESPONSE');
      setSession(result);
    }).catch(failure => {
      if (isAbort(failure)) return;
      if (failure instanceof ApiError && failure.status === 401) setSession(null);
      else setError(errorMessage(failure));
    });
    return () => controller.abort();
  }, [version]);
  const expire = useCallback(() => {
    setSession(null); setNotice('Your session has expired. Sign in again.'); router.replace(pathname);
  }, [router, pathname]);
  if (error && !session) return <main className="boot-screen"><Brand />
    <EmptyState icon={WifiOff} title="Workspace unavailable" detail={error}
      action={<Button label="Retry connection" variant="primary" icon={<Glyph icon={RefreshCw} />}
        onClick={() => { setSession(undefined); setVersion(value => value + 1); }} />} /><PrivacyStamp /></main>;
  if (session === undefined) return <WorkspaceLoading />;
  if (!session) return <SignIn notice={notice} onSignedIn={() => { setNotice(''); setSession(undefined); setVersion(value => value + 1); }} />;
  return <AuthenticatedWorkspace session={session} onExpired={expire} onSignedOut={() => {
    setSession(null); setNotice(''); router.replace(pathname);
  }} />;
}

function SignIn({notice, onSignedIn}: {notice: string; onSignedIn: () => void}) {
  const [accessKey, setAccessKey] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const online = useOnline();
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!accessKey.trim() || busy || !online) return;
    setBusy(true); setError('');
    try {
      await request('/api/auth/login', {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({accessKey: accessKey.trim()})});
      setAccessKey(''); onSignedIn();
    } catch (failure) { setError(errorMessage(failure)); }
    finally { setBusy(false); }
  }
  return <main className="sign-in-page">
    <div className="sign-in-top"><Brand compact /><PrivacyStamp /></div>
    <section className="sign-in-content" aria-labelledby="sign-in-title">
      <span className="sign-in-icon"><LockKeyhole size={26} strokeWidth={1.5} aria-hidden="true" /></span>
      <span className="eyebrow">PRIVATE WORKSPACE</span><h1 id="sign-in-title">Maxim Apply</h1><p>Sign in to your workspace.</p>
      {notice && <Banner tone="info">{notice}</Banner>}
      {!online && <Banner tone="warning">You are offline. Reconnect to sign in.</Banner>}
      {error && <Banner>{error}</Banner>}
      <form onSubmit={submit}>
        <TextInput label="Workspace access key" type="password" value={accessKey} onChange={setAccessKey}
          htmlName="accessKey" autoComplete="off" hasSpellCheck={false} hasAutoFocus isDisabled={busy} isRequired width="100%" />
        <Button label="Sign in" type="submit" variant="primary" endContent={<Glyph icon={ArrowRight} />} width="100%"
          isLoading={busy} isDisabled={!accessKey.trim() || !online} />
      </form>
      <span className="sign-in-footer"><ShieldCheck size={14} aria-hidden="true" />Authenticated access only</span>
    </section>
    <footer className="sign-in-bottom"><span>Maxim Apply</span><span>Local workspace</span></footer>
  </main>;
}

function AuthenticatedWorkspace({session, onExpired, onSignedOut}: {
  session: Session; onExpired: () => void; onSignedOut: () => void;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const query = searchParams.toString();
  const requestedView = searchParams.get('view');
  const view: View = navigation.some(item => item.view === requestedView) ? requestedView as View : requestedView||searchParams.has('job')?'jobs':'home';
  const jobId = searchParams.get('job');
  const sort=roleSort(searchParams.get('sort'));
  const jobQuery=new URLSearchParams(query);jobQuery.set('limit','50');jobQuery.set('sort',sort);jobQuery.set('filter',searchParams.get('filter')==='archived'?'archived':'active');
  if(!jobQuery.has('locationGroup'))jobQuery.set('locationGroup','focus');
  const jobsQuery=jobQuery.toString();
  const conversationId = searchParams.get('conversation');
  const filter = searchParams.get('filter') === 'archived' ? 'archived' : 'active';
  const [data, setData] = useState<WorkspaceData | null>(null);
  const [error, setError] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [agentOpen, setAgentOpen] = useState(false);
  const [proposal, setProposal] = useState<Proposal | null>(null);
  const [noteDirty, setNoteDirty] = useState(false);
  const [pendingNavigation, setPendingNavigation] = useState<Navigation | null>(null);
  const online = useOnline();
  const wide = useMediaQuery('(min-width: 1440px)');
  const sequence = useRef(0);
  const live = useRef(true);
  const api = useMemo(() => new WorkspaceApi(session.csrfToken, onExpired), [session.csrfToken, onExpired]);
  const rawNavigate = useCallback((selection: Navigation) => {
    const params = new URLSearchParams(query);
    if ('job' in selection && selection.job !== jobId) params.delete('practice');
    if(selection.view&&selection.view!=='answers')params.delete('question');
    for (const [key, value] of Object.entries(selection)) {
      if (value == null) params.delete(key); else params.set(key, value);
    }
    const suffix = params.toString();
    router.push(pathname + (suffix ? '?' + suffix : ''), {scroll: false});
    setMenuOpen(false);
    if (selection.view) setAgentOpen(false);
  }, [query, pathname, router]);
  const navigate = useCallback((selection: Navigation) => {
    if (noteDirty && ((selection.view != null && selection.view !== view) || ('job' in selection && selection.job !== jobId))) {
      setPendingNavigation(selection);
    } else rawNavigate(selection);
  }, [noteDirty, view, jobId, rawNavigate]);
  const refresh = useCallback(async () => {
    const requestId = ++sequence.current;
    setRefreshing(true);
    try {
      const result = await api.get<WorkspaceData>('/api/workspace?'+jobsQuery);
      if (!Array.isArray(result.jobs) || !Array.isArray(result.conversations) || !result.settings?.model) {
        throw new ApiError('The service returned an incomplete workspace.', 'INVALID_RESPONSE');
      }
      if (live.current && requestId === sequence.current) { setData(result); setError(''); }
    } catch (failure) {
      if (live.current && requestId === sequence.current && !isAbort(failure)) setError(errorMessage(failure));
    } finally { if (live.current && requestId === sequence.current) setRefreshing(false); }
  }, [api,jobsQuery]);
  useEffect(() => {
    live.current = true;
    void refresh();
    return () => { live.current = false; sequence.current += 1; };
  }, [refresh]);
  useEffect(() => {
    const update = () => { if (!document.hidden && navigator.onLine) void refresh(); };
    window.addEventListener('online', update);
    window.addEventListener('focus', update);
    return () => { window.removeEventListener('online', update); window.removeEventListener('focus', update); };
  }, [refresh]);
  useEffect(() => {
    if (!noteDirty) return;
    const guard = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ''; };
    window.addEventListener('beforeunload', guard);
    return () => window.removeEventListener('beforeunload', guard);
  }, [noteDirty]);
  const agent = useAgent({api, conversationId, jobId, navigate, refresh});
  const disabled = !online || Boolean(error);
  const activeJobs = data?.totals?.leads??data?.jobs.filter(job => !job.archived).length;
  const activeIntents = data?.totals?.applications??data?.applications.filter(application => application.status === 'intent').length;
  const currentNav = navigation.find(item => item.view === view)!;
  const counts: Partial<Record<View, number>> = {jobs: activeJobs, applications: activeIntents, activity: data?.events.length};
  const identity = data?.workspace ?? session.workspace;
  const homeHref=pathname+'?view=home';
  const goHome=(event:MouseEvent<HTMLAnchorElement>)=>{
    if(event.button!==0||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey)return;
    event.preventDefault();navigate({view:'home',job:null,conversation:null,filter:null});
  };
  const navItems = (mobile=false) => <>{navigation.filter(item=>item.view!=='home'&&(!mobile||['jobs','candidate','applications'].includes(item.view))).map(item => <button type="button" key={item.view}
    className={'nav-item' + (view === item.view ? ' current' : '')} aria-current={view === item.view ? 'page' : undefined}
    onClick={() => navigate({view: item.view, filter: null})}>
    <item.icon size={18} aria-hidden="true" /><span>{item.label}</span>
    {counts[item.view] !== undefined && <span className="nav-count tabular">{counts[item.view]}</span>}
  </button>)}</>;
  const sidebar = <div className="sidebar-inner"><a className="brand-home" href={homeHref} onClick={goHome} aria-label="Maxim Apply" aria-current={view==='home'?'page':undefined}><Brand /></a><div className="workspace-identity"><LayoutGrid size={16} aria-hidden="true" />
    <span><strong>{identity.name}</strong><small>New workspace</small></span><LockKeyhole size={12} aria-hidden="true" /></div>
    <div className="sidebar-section-label">WORKSPACE</div><nav aria-label="Workspace navigation">{navItems()}</nav>
    <div className="sidebar-bottom"><div className="sidebar-privacy"><ShieldCheck size={17} aria-hidden="true" /><span>Private by default<small>{identity.is_owner ? 'Workspace owner' : 'Workspace member'}</small></span></div>
      <div className="sidebar-connection"><span className={'status-dot' + (!online || error ? ' status-dot-amber' : '')} />
        {!online ? 'Offline' : error ? 'Service unavailable' : data ? 'Workspace connected' : 'Connecting'}</div></div></div>;
  return <div className="workspace-shell">
    <a href="#workspace-content" className="skip-link">Skip to workspace</a>
    <aside className="sidebar" aria-label="Main navigation">{sidebar}</aside>
    <main className="workspace-main">
      <header className="topbar"><div className="topbar-brand"><span className="mobile-menu"><ToolButton label="Open navigation" icon={Menu} onClick={() => setMenuOpen(true)} /></span>
        <h1><a className="brand-home" href={homeHref} onClick={goHome} aria-current={view==='home'?'page':undefined}>Maxim Apply</a></h1><ChevronRight size={14} aria-hidden="true" /><span className="topbar-current">{currentNav.label}</span></div>
        <div className="topbar-actions">{session.testMode && <Pill tone="amber">Test workspace</Pill>}
          <span className="topbar-private"><PrivacyStamp /></span>
          <ToolButton label="Refresh workspace" icon={RefreshCw} onClick={() => void refresh()} disabled={!online || refreshing} busy={refreshing} />
          {!wide && <Button label="Agent" size="sm" variant="secondary" icon={<Glyph icon={Bot} />} onClick={() => setAgentOpen(true)} />}
        </div></header>
      {!online && <Banner tone="warning"><span className="inline-label"><WifiOff size={14} aria-hidden="true" />Offline. Changes are paused.</span>{data && ' Showing the last loaded workspace.'}</Banner>}
      {error && <Banner><span>{error} </span>{data && <span>Showing the last loaded workspace. </span>}
        <button type="button" className="text-link" disabled={!online || refreshing} onClick={() => void refresh()}>Retry</button></Banner>}
      <div className="page-heading"><div><div className="eyebrow">{view === 'settings' ? 'WORKSPACE PREFERENCES' : 'WORKSPACE OVERVIEW'}</div>
        <h2>{currentNav.label}</h2></div>
        <div className="page-heading-actions"><span className="last-sync">{data ? 'Updated ' + formatDate(data.asOf, true) : 'Connecting...'}</span>
          {view === 'jobs' && <Button label="New role" variant="primary" icon={<Glyph icon={Plus} />} onClick={() => setCreateOpen(true)} isDisabled={!data || disabled} />}</div>
      </div>
      {data && !['home','settings','candidate','answers'].includes(view) && <div className="workspace-stats" aria-label="Workspace totals">
        <div><span className="stat-icon stat-green"><BriefcaseBusiness size={16} aria-hidden="true" /></span><span>Active leads<strong className="tabular">{activeJobs}</strong></span></div>
        <div><span className="stat-icon stat-amber"><Send size={16} aria-hidden="true" /></span><span>Applications<strong className="tabular">{activeIntents}</strong></span></div>
        <div><span className="stat-icon stat-coral"><FileCheck2 size={16} aria-hidden="true" /></span><span>Pending reviews<strong className="tabular">{data.proposals.length}</strong></span></div>
        <div><span className="stat-icon"><Activity size={16} aria-hidden="true" /></span><span>Recorded events<strong className="tabular">{data.totals?.events??data.events.length}</strong></span></div>
      </div>}
      <div id="workspace-content" className={'workspace-content view-' + view} tabIndex={-1} aria-busy={!data && refreshing}>
        {!data ? error ? <EmptyState icon={WifiOff} title="Unable to load workspace" detail="No records have been loaded."
          action={<Button label="Retry" icon={<Glyph icon={RefreshCw} />} onClick={() => void refresh()} isDisabled={!online || refreshing} />} />
          : <div className="workspace-skeleton" role="status"><span className="visually-hidden">Loading workspace</span><i /><i /><i /><i /></div>
          : view === 'home' ? <HomeView api={api} disabled={disabled} asOf={data.asOf} navigate={navigate}/>
          : view === 'jobs' ? <JobsView data={data} api={api} disabled={disabled} refresh={refresh} navigate={navigate}
            selectedId={jobId} filter={filter} sort={sort} onCreate={() => setCreateOpen(true)} onDirtyChange={setNoteDirty}
            onAgent={() => { setAgentOpen(true); if (conversationId && agent.detail && agent.detail.conversation.job_id !== jobId && !agent.isRunning) void agent.newConversation(); }} />
          : view === 'candidate' ? <CandidateView key={searchParams.get('knowledge')} api={api} disabled={disabled} refresh={refresh} navigate={navigate} sourceId={searchParams.get('source')} initialTab={searchParams.get('knowledge')} asOf={data.asOf} isOwner={data.workspace.is_owner}/>
          : view === 'archive' ? <ArchiveView api={api} disabled={disabled} asOf={data.asOf} refresh={refresh} isOwner={data.workspace.is_owner} navigate={navigate}/>
          : view === 'answers' ? <AnswersView key={searchParams.get('question')} api={api} disabled={disabled} refresh={refresh} asOf={data.asOf}
            requestedQuestion={searchParams.get('question')} returnToAssistant={searchParams.has('application')&&searchParams.has('question')?()=>navigate({view:'browser',question:null}):undefined}/>
          : view === 'discovery' ? <DiscoveryView api={api} disabled={disabled} refresh={refresh} asOf={data.asOf} navigate={navigate} sort={sort}/>
          : view === 'browser' ? <BrowserView key={searchParams.get('application')} api={api} disabled={disabled} refresh={refresh} navigate={navigate} requestedApplication={searchParams.get('application')}/>
          : view === 'gmail' ? <GmailView api={api} disabled={disabled} asOf={data.asOf} navigate={navigate}/>
          : view === 'discord' ? <DiscordView api={api} disabled={disabled} asOf={data.asOf}/>
          : view === 'networking' ? <NetworkingView api={api} disabled={disabled} asOf={data.asOf}/>
          : view === 'interview' ? <InterviewView key={jobId} api={api} disabled={disabled} job={data.jobs.find(j=>j.id===jobId)??null} asOf={data.asOf} refresh={refresh} onDirtyChange={setNoteDirty}/>
          : view === 'applications' ? <ApplicationsView data={data} api={api} disabled={disabled} refresh={refresh} navigate={navigate} filter={filter} selectedId={searchParams.get('application')}/>
          : view === 'activity' ? <ActivityView data={data} navigate={navigate} />
          : <SettingsView data={data} api={api} disabled={disabled} refresh={refresh} navigate={navigate} onLogout={async () => { await api.post('/api/auth/logout', {}); onSignedOut(); }} />}
      </div>
      <nav className="mobile-navigation" aria-label="Mobile workspace navigation">{navItems(true)}
        <button type="button" className="nav-item" onClick={() => setMenuOpen(true)}><Menu size={18} aria-hidden="true" /><span>More</span></button></nav>
    </main>
    {data && wide && <AgentPanel agent={agent} data={data} conversationId={conversationId} jobId={jobId} disabled={disabled}
      navigate={navigate} onReview={value => setProposal(value)} />}
    <Dialog isOpen={menuOpen} onOpenChange={setMenuOpen} variant="fullscreen" className="navigation-dialog" aria-label="Navigation">
      <div className="drawer-close"><ToolButton label="Close navigation" icon={X} onClick={() => setMenuOpen(false)} /></div>{sidebar}
    </Dialog>
    <Dialog isOpen={agentOpen && !wide && Boolean(data)} onOpenChange={setAgentOpen} variant="fullscreen" padding={0} className="agent-dialog" aria-label="Workspace agent">
      {data && agentOpen && !wide && <AgentPanel agent={agent} data={data} conversationId={conversationId} jobId={jobId} disabled={disabled}
        navigate={navigate} onClose={() => setAgentOpen(false)} onReview={value => { setAgentOpen(false); setProposal(value); }} />}
    </Dialog>
    <CreateRoleDialog open={createOpen} onClose={() => setCreateOpen(false)} api={api} disabled={disabled} onCreated={async job => {
      await refresh(); navigate({view: 'jobs', job: job.id, filter: 'active'});
    }} />
    {data && <ProposalReview proposal={proposal} data={data} api={api} disabled={disabled} running={agent.isRunning}
      onClose={() => setProposal(null)} onResolved={async () => { await refresh(); await agent.reload(); }} />}
    <Dialog isOpen={Boolean(pendingNavigation)} onOpenChange={value => { if (!value) setPendingNavigation(null); }} purpose="form" width={440}>
      <DialogHeader title="Discard unsaved note?" onOpenChange={() => setPendingNavigation(null)} />
      <div className="dialog-form"><p className="muted">Your unsaved changes will be lost.</p><div className="dialog-actions">
        <Button label="Keep editing" variant="secondary" onClick={() => setPendingNavigation(null)} />
        <Button label="Discard changes" variant="destructive" onClick={() => {
          if (pendingNavigation) { setNoteDirty(false); rawNavigate(pendingNavigation); setPendingNavigation(null); }
        }} /></div></div>
    </Dialog>
  </div>;
}
