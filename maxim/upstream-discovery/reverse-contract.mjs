// Generated from pinned scan-ats-full.mjs; SHA-256 3465e14272c66bd6678199293bc51687d4fd168844cd689a7ce04000c1e9ab8b.
// MIT license: ../vendor/career-ops-discovery/LICENSE. Do not hand-edit.
import greenhouse from '../vendor/career-ops-discovery/providers/greenhouse.mjs';
import lever from '../vendor/career-ops-discovery/providers/lever.mjs';
import ashby from '../vendor/career-ops-discovery/providers/ashby.mjs';
import workday from '../vendor/career-ops-discovery/providers/workday.mjs';
import icims from '../vendor/career-ops-discovery/providers/icims.mjs';
import bamboohr from '../vendor/career-ops-discovery/providers/bamboohr.mjs';
import join from '../vendor/career-ops-discovery/providers/join.mjs';
import paylocity,{boardUrl as paylocityBoardUrl} from '../vendor/career-ops-discovery/providers/paylocity.mjs';
import {parseCompanySitemap} from '../vendor/career-ops-discovery/providers/join.mjs';
import {decodeEntities} from '../vendor/career-ops-discovery/providers/_html-entities.mjs';
import {WORKABLE_FEED_URL} from '../vendor/career-ops-discovery/providers/workable.mjs';
const workableFeedCache=()=>{throw Object.assign(new Error('Global Workable feed needs an explicit streaming budget.'),{code:'large_feed_deferred'});};
const loadWorkableFeed=workableFeedCache;
const DATASET_BASE = 'https://raw.githubusercontent.com/Feashliaa/job-board-aggregator/main/data';

const SINGLE_HOST_CONCURRENCY = 6;

const PAYLOCITY_CONCURRENCY = 2;

const JOIN_CONCURRENCY = 2;

const SLUG_RE = /^[A-Za-z0-9._-]+$/;

const WORKDAY_JUNK_TENANT_RE = /^wd\d+$/i;

export function entryOnHost(name, careersUrl, isCanonicalHost) {
  let hostname;
  try {
    ({ hostname } = new URL(careersUrl));
  } catch {
    return null;
  }
  return isCanonicalHost(hostname) ? { name, careers_url: careersUrl } : null;
}

export function icimsHostCandidates(slug) {
  const s = String(slug ?? '').toLowerCase().replace(/^-+/, '');
  if (!s) return [];
  const asIs = `${s}.icims.com`;
  const prefixed = `careers-${s}.icims.com`;
  if (s.startsWith('careers-')) return [asIs];
  return s.includes('careers') ? [asIs, prefixed] : [prefixed, asIs];
}

export function paylocityEntry(row) {
  const careersUrl = paylocityBoardUrl(row?.guid);
  if (!careersUrl) return null;
  const name = typeof row.name === 'string' ? decodeEntities(row.name).trim() : '';
  return entryOnHost(name, careersUrl, h => h === 'recruiting.paylocity.com');
}

const WORKABLE_FEED_PROVIDER = Object.freeze({
  id: 'workable-feed',
  fetch: async (entry) => (Array.isArray(entry?.jobs) ? entry.jobs : []),
});

export const SOURCES = {
  greenhouse: {
    provider: greenhouse,
    // Whole directory behind one host — see SINGLE_HOST_CONCURRENCY.
    concurrency: SINGLE_HOST_CONCURRENCY,
    // One host means one keep-alive pool, so per-board connection scopes would
    // only add a TLS handshake per board (see boardScope below).
    singleHost: true,
    dataset: `${DATASET_BASE}/greenhouse_companies.json`,
    toEntry: (slug) => SLUG_RE.test(String(slug))
      ? entryOnHost(String(slug), `https://job-boards.greenhouse.io/${slug}`, h => h === 'job-boards.greenhouse.io')
      : null,
  },
  lever: {
    provider: lever,
    // Whole directory behind one host — see SINGLE_HOST_CONCURRENCY.
    concurrency: SINGLE_HOST_CONCURRENCY,
    // One host means one keep-alive pool, so per-board connection scopes would
    // only add a TLS handshake per board (see boardScope below).
    singleHost: true,
    dataset: `${DATASET_BASE}/lever_companies.json`,
    toEntry: (slug) => SLUG_RE.test(String(slug))
      ? entryOnHost(String(slug), `https://jobs.lever.co/${slug}`, h => h === 'jobs.lever.co')
      : null,
  },
  ashby: {
    provider: ashby,
    // Whole directory behind one host — see SINGLE_HOST_CONCURRENCY.
    concurrency: SINGLE_HOST_CONCURRENCY,
    // One host means one keep-alive pool, so per-board connection scopes would
    // only add a TLS handshake per board (see boardScope below).
    singleHost: true,
    dataset: `${DATASET_BASE}/ashby_companies.json`,
    toEntry: (slug) => SLUG_RE.test(String(slug))
      ? entryOnHost(String(slug), `https://jobs.ashbyhq.com/${slug}`, h => h === 'jobs.ashbyhq.com')
      : null,
  },
  workday: {
    provider: workday,
    dataset: `${DATASET_BASE}/workday_companies.json`,
    // Dataset entries are "tenant|instance|site" triples.
    toEntry: (line) => {
      const [tenant, instance, site] = String(line).split('|');
      if (![tenant, instance, site].every(p => p && SLUG_RE.test(p))) return null;
      if (WORKDAY_JUNK_TENANT_RE.test(tenant)) return null;
      return entryOnHost(
        tenant,
        `https://${tenant}.${instance}.myworkdayjobs.com/${site}`,
        h => h === `${tenant}.${instance}.myworkdayjobs.com` && h.endsWith('.myworkdayjobs.com'),
      );
    },
  },
  icims: {
    provider: icims,
    dataset: `${DATASET_BASE}/icims_companies.json`,
    toEntry: (slug) => {
      if (!SLUG_RE.test(String(slug))) return null;
      const hosts = icimsHostCandidates(slug);
      if (hosts.length === 0) return null;
      const [primary, ...fallbacks] = hosts.map((h) => `https://${h}/jobs/search?ss=1&in_iframe=1`);
      const entry = entryOnHost(String(slug), primary, (h) => h === hosts[0]);
      if (entry && fallbacks.length) entry.fallback_urls = fallbacks;
      return entry;
    },
  },
  bamboohr: {
    provider: bamboohr,
    // Per-tenant own host (<slug>.bamboohr.com), like workday/icims — default
    // CONCURRENCY is correct here, not SINGLE_HOST_CONCURRENCY.
    dataset: `${DATASET_BASE}/bamboohr_companies.json`,
    toEntry: (slug) => SLUG_RE.test(String(slug))
      ? entryOnHost(String(slug), `https://${slug}.bamboohr.com/careers`, h => h === `${slug}.bamboohr.com`)
      : null,
  },
  paylocity: {
    provider: paylocity,
    // Whole directory behind one host that throttles early — see PAYLOCITY_CONCURRENCY.
    concurrency: PAYLOCITY_CONCURRENCY,
    // One host means one keep-alive pool, so per-board connection scopes would
    // only add a TLS handshake per board (see boardScope below).
    singleHost: true,
    // Entries are { guid, name, jobs } objects, not slugs. `jobs` is the
    // dataset's count at snapshot time and does not decide whether a board is
    // scanned: it is out of date by the time the sweep runs.
    dataset: `${DATASET_BASE}/paylocity_companies_clean.json`,
    toEntry: (row) => paylocityEntry(row),
  },
  join: {
    provider: join,
    // Whole directory behind one host that rate-limits — see JOIN_CONCURRENCY.
    concurrency: JOIN_CONCURRENCY,
    singleHost: true,
    // job-board-aggregator has no join file; join.com publishes its own
    // company directory, listed under `Sitemap:` in its robots.txt.
    dataset: 'https://join.com/companies/sitemap.xml',
    parseDataset: parseCompanySitemap,
    toEntry: (slug) => SLUG_RE.test(String(slug))
      ? entryOnHost(String(slug), `https://join.com/companies/${slug}`, h => h === 'join.com')
      : null,
  },
  workable: {
    // Workable publishes every tenant's postings in one hourly XML feed, so
    // there is no company directory to walk and nothing to fetch per board:
    // loadDataset reads the feed once (loadWorkableFeed in
    // providers/workable.mjs, through workableFeedCache) and hands back
    // one board per employer in the feed with its postings attached, already
    // narrowed to the --since window and the title filter (so most boards are
    // empty, and the source counts every employer as others count every
    // tenant of their directory). The rest of the sweep (domain
    // gate, location and content filters, blacklist, dedup) runs per employer
    // as for any other source. Title-filter overrides match the employer name.
    provider: WORKABLE_FEED_PROVIDER,
    singleHost: true,
    // The feed changes every hour, so an interrupted pass cannot resume at an
    // offset into it; it starts again, and seenUrls keeps the matches already
    // saved from being added twice.
    restartOnResume: true,
    dataset: WORKABLE_FEED_URL,
    loadDataset: async ({ cutoff, includeUndated, titleFilter, cacheDir }) => {
      const cache = workableFeedCache(cacheDir ? { cacheDir } : {});
      try {
        const { companies } = await loadWorkableFeed({ cutoffMs: cutoff, includeUndated, titleFilter, fetchStream: cache.fetchStream });
        cache.commit();
        return { list: companies, status: cache.from === 'stale-cache' ? 'stale' : 'ok' };
      } catch (err) {
        cache.discard();
        throw err;
      }
    },
    toEntry: (row) => (row && typeof row.company === 'string' && row.company
      ? { name: row.company, ...(row.website ? { website: row.website } : {}), jobs: Array.isArray(row.jobs) ? row.jobs : [] }
      : null),
  },
};
