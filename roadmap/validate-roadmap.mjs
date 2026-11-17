import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath, pathToFileURL } from 'node:url';

const defaultRoot = fileURLToPath(new URL('../', import.meta.url));
const primaryDocs = ['README.md', 'MANIFESTO.md', 'high-level-roadmap.md',
  'external-components-assessment.md', 'development-workflow.md', 'operational-setup.md'];
const requiredSections = ['Objective', 'Thin Vertical Slice', 'Acceptance', 'Integration Test',
  'Files Changed', 'Dependencies And Handoff', 'What Shipped', 'Deferred To Later Stages',
  'Comments And Miscellaneous'];
const originalHash = '4fa45f8457e3a2f1b93d22e6bf80b84bd39f88bf524b924f58eb9e350b1e76bb';

function isInside(root, target) {
  const relative = path.relative(root, target);
  return relative === '' || (!relative.startsWith('..' + path.sep) &&
    relative !== '..' && !path.isAbsolute(relative));
}

function headingAnchors(text) {
  const seen = new Map();
  const result = new Set();
  for (const match of text.matchAll(/^#{1,6}\s+(.+)$/gm)) {
    const base = match[1].trim().toLowerCase().replace(/[^\w -]/g, '').replace(/ /g, '-');
    const count = seen.get(base) || 0;
    seen.set(base, count + 1);
    result.add(base + (count ? '-' + count : ''));
  }
  return result;
}

function rowIds(text) {
  const pattern = /^\| (?:\[(S\d+)\]\([^)]+\)|(S\d+)) \|/;
  const lines = text.split('\n');
  const start = lines.findIndex(line => pattern.test(line));
  if (start < 0) return [];
  const result = [];
  for (const line of lines.slice(start)) {
    const match = line.match(pattern);
    if (!match) break;
    result.push(match[1] || match[2]);
  }
  return result;
}

export function validateRoadmap({ root = defaultRoot, manifest: suppliedManifest } = {}) {
  root = path.resolve(root);
  const errors = [];
  const cache = new Map();
  const stats = { documents: 0, localLinks: 0, externalLinks: 0, numberedSections: 0, commentBlocks: 0 };
  const check = (condition, message) => { if (!condition) errors.push(message); };
  const read = target => {
    const absolute = path.resolve(target);
    if (!cache.has(absolute)) cache.set(absolute, fs.readFileSync(absolute, 'utf8').replace(/\r\n/g, '\n'));
    return cache.get(absolute);
  };
  const stageRoot = path.join(root, 'roadmap', 'stages');
  let manifest;
  try {
    manifest = suppliedManifest || JSON.parse(read(path.join(stageRoot, 'manifest.json')));
  } catch (error) {
    return { ok: false, errors: ['Cannot read stage registry: ' + error.message] };
  }
  if (!manifest || manifest.schemaVersion !== 1 || !Array.isArray(manifest.stages)) {
    return { ok: false, errors: ['Invalid stage registry schema'] };
  }
  const stages = manifest.stages;
  if (!stages.every(stage => stage && typeof stage.id === 'string' &&
      ['requires', 'conditional', 'produces', 'consumes', 'acceptance'].every(key => Array.isArray(stage[key])))) {
    return { ok: false, errors: ['Invalid stage registry arrays or stage record'] };
  }
  const expectedIds = Array.from({ length: 12 }, (_, i) => 'S' + i);
  check(JSON.stringify(stages.map(s => s.id)) === JSON.stringify(expectedIds),
    'Stage registry must contain S0-S11 exactly once in order');
  const byId = new Map(stages.map(stage => [stage.id, stage]));
  const producers = new Map();
  const caseIds = new Set();

  for (const stage of stages) {
    check(['Pending', 'In progress', 'Blocked', 'Verified', 'Shipped'].includes(stage.status),
      stage.id + ': invalid implementation status');
    if (['Verified', 'Shipped'].includes(stage.status)) {
      check(Array.isArray(stage.evidence) && stage.evidence.length > 0,
        stage.id + ': implementation acceptance is not established without per-case evidence');
    }
    for (const field of ['requires', 'conditional', 'produces', 'consumes', 'acceptance']) {
      check(Array.isArray(stage[field]), stage.id + ': missing registry array ' + field);
    }
    if (!['requires', 'conditional', 'produces', 'consumes', 'acceptance'].every(k => Array.isArray(stage[k]))) continue;
    for (const dependency of [...stage.requires, ...stage.conditional.map(item => item.stage)]) {
      check(byId.has(dependency), stage.id + ': unknown dependency ' + dependency);
      check(dependency !== stage.id, stage.id + ': self dependency');
    }
    for (const item of stage.conditional) check(typeof item.when === 'string' && item.when.length > 0,
      stage.id + ': conditional dependency needs an explicit condition');
    for (const contract of stage.produces) {
      check(!producers.has(contract), 'Multiple producers for handoff ' + contract);
      producers.set(contract, stage.id);
    }
    check(stage.acceptance.length >= 3 && stage.acceptance.length <= 8,
      stage.id + ': needs 3-8 acceptance cases');
    for (const id of stage.acceptance) {
      check(!caseIds.has(id), 'Duplicate acceptance case ' + id);
      caseIds.add(id);
    }
  }

  const completed = new Set();
  const visiting = new Set();
  function visit(id) {
    if (visiting.has(id)) { errors.push('Dependency cycle at ' + id); return; }
    if (completed.has(id)) return;
    const stage = byId.get(id);
    if (!stage) return;
    visiting.add(id);
    for (const dependency of [...(stage.requires || []), ...(stage.conditional || []).map(item => item.stage)]) visit(dependency);
    visiting.delete(id);
    completed.add(id);
  }
  for (const stage of stages) visit(stage.id);

  function ancestors(id, seen = new Set()) {
    for (const dependency of byId.get(id)?.requires || []) {
      if (!seen.has(dependency)) { seen.add(dependency); ancestors(dependency, seen); }
    }
    return seen;
  }
  for (const stage of stages) {
    const available = ancestors(stage.id);
    for (const contract of stage.consumes || []) {
      const producer = producers.get(contract);
      check(Boolean(producer), stage.id + ': missing producer for handoff ' + contract);
      if (producer) check(available.has(producer),
        stage.id + ': handoff ' + contract + ' is not supplied by a mandatory prerequisite');
    }
  }
  check(!ancestors('S5').has('S4'), 'Manual-job evaluation must not require automated discovery');
  check(ancestors('S11').has('S6'), 'Full product acceptance must require browser assistance');
  check(!ancestors('S6').has('S10'), 'Optional interview practice must not block application assistance');

  const documents = primaryDocs.map(name => path.join(root, 'roadmap', name));
  documents.push(path.join(stageRoot, 'README.md'), path.join(stageRoot, 'contracts.md'),
    path.join(root, 'roadmap', 'reviews', '2026-11-16_DRIFT_REPORT.md'),
    path.join(root, 'roadmap', 'reviews', 'roadmap-refinement.md'));

  for (const stage of stages) {
    if (typeof stage.file !== 'string') { errors.push(stage.id + ': missing stage file'); continue; }
    const absolute = path.resolve(stageRoot, stage.file);
    if (!isInside(stageRoot, absolute)) { errors.push(stage.id + ': stage path escapes stage directory'); continue; }
    try {
      if (!isInside(stageRoot, fs.realpathSync(absolute))) {
        errors.push(stage.id + ': stage symlink escapes stage directory'); continue;
      }
      const text = read(absolute);
      check(text.startsWith('# ' + stage.id + ': ' + stage.title + '\n'), stage.id + ': title/registry mismatch');
      for (const heading of requiredSections) check(text.includes('\n## ' + heading + '\n'),
        stage.id + ': missing section ' + heading);
      check(/^## Scope(?: And Contracts)?$/m.test(text), stage.id + ': missing scope');
      check(text.includes('## Ordered Implementation Slices'), stage.id + ': missing implementation slices');
      const caseRows = [...text.matchAll(/^- \[([ xX])\] \*\*([A-Z]+-\d+):\*\*/gm)];
      const cases = caseRows.map(match => match[2]);
      check(JSON.stringify(cases) === JSON.stringify(stage.acceptance), stage.id + ': acceptance case/registry mismatch');
      const checked = new Set(caseRows.filter(match => match[1] !== ' ').map(match => match[2]));
      const supported = new Set();
      for (const evidence of Array.isArray(stage.evidence) ? stage.evidence : []) {
        if (!evidence || typeof evidence.record !== 'string') {
          errors.push(stage.id + ': invalid evidence record'); continue;
        }
        const target = path.resolve(root, evidence.record);
        if (!isInside(root, target)) {
          errors.push(stage.id + ': evidence path escapes repository'); continue;
        }
        const valid = typeof evidence.caseId === 'string' && stage.acceptance.includes(evidence.caseId) &&
          evidence.result === 'passed' && typeof evidence.command === 'string' && evidence.command.length > 0 &&
          typeof evidence.environment === 'string' && evidence.environment.length > 0 &&
          typeof evidence.verifiedAt === 'string' && Number.isFinite(Date.parse(evidence.verifiedAt)) &&
          fs.existsSync(target) && isInside(root, fs.realpathSync(target));
        check(valid, stage.id + ': evidence must name a case, passed result, command, environment, date and existing local record');
        if (valid) supported.add(evidence.caseId);
      }
      for (const id of checked) check(supported.has(id), stage.id + ': checked case lacks evidence ' + id);
      if (stage.status === 'Pending') check(checked.size === 0, stage.id + ': pending stage has checked implementation cases');
      if (['Verified', 'Shipped'].includes(stage.status)) {
        check(stage.acceptance.every(id => checked.has(id) && supported.has(id)),
          stage.id + ': delivered status requires all acceptance cases checked with evidence');
      }
      const statusLine = text.split('\n').find(line => line.startsWith('**Status:**')) || '';
      check(statusLine.includes(stage.status), stage.id + ': document/registry status mismatch');
      const requiresLine = text.split('\n').find(line => line.startsWith('**Requires:**')) || '';
      const declared = [...requiresLine.matchAll(/\[(S\d+)\]\(/g)].map(match => match[1]);
      check(JSON.stringify(declared) === JSON.stringify(stage.requires), stage.id + ': prerequisite header/registry mismatch');
      check(/proposed/i.test(text), stage.id + ': proposed work must be labeled');
      documents.push(absolute);
    } catch (error) { errors.push(stage.id + ': cannot read stage file: ' + error.message); }
  }

  for (const document of documents) {
    const label = path.relative(root, document);
    let text;
    try { text = read(document); } catch (error) { errors.push(label + ': ' + error.message); continue; }
    stats.documents++;
    check(!/[^\x00-\x7f]/.test(text), label + ': non-ASCII planning content');
    check(!text.includes('*** Begin Patch'), label + ': stray patch markers');
    check(!/[ \t]+$/m.test(text), label + ': trailing whitespace');
    let fence = null;
    for (const line of text.split('\n')) {
      const match = line.match(/^(\x60{3,}|~{3,})/);
      if (!match) continue;
      const marker = match[1][0];
      if (fence === null) fence = marker;
      else if (marker === fence) fence = null;
    }
    check(fence === null, label + ': unbalanced code fences');
    const sections = text.split(/(?=^## \d+\.)/m).slice(1);
    let expected = 1;
    for (const section of sections) {
      check(Number(section.match(/^## (\d+)\./)?.[1]) === expected++,
        label + ': numbered section sequence');
      check(section.includes('> **Comments**'), label + ': numbered section missing comment block');
    }
    stats.numberedSections += sections.length;
    stats.commentBlocks += [...text.matchAll(/^> \*\*Comments\*\*$/gm)].length;
    for (const match of text.matchAll(/\[[^\]\n]+\]\(([^)\n]+)\)/g)) {
      const href = match[1].replace(/^<|>$/g, '');
      if (/^https?:\/\//.test(href)) { stats.externalLinks++; continue; }
      const [relative, anchor] = href.split('#');
      const target = relative ? path.resolve(path.dirname(document), decodeURIComponent(relative)) : document;
      if (!isInside(root, target)) { errors.push(label + ': local link escapes repository: ' + href); continue; }
      if (!fs.existsSync(target)) { errors.push(label + ': missing local link ' + href); continue; }
      if (!isInside(root, fs.realpathSync(target))) { errors.push(label + ': link symlink escapes repository'); continue; }
      if (anchor) {
        try { check(headingAnchors(read(target)).has(decodeURIComponent(anchor)), label + ': missing anchor ' + href); }
        catch (error) { errors.push(label + ': unreadable anchor target ' + href); }
      }
      stats.localLinks++;
    }
  }
  for (const name of ['roadmap/README.md', 'roadmap/high-level-roadmap.md', 'roadmap/stages/README.md']) {
    try { check(JSON.stringify(rowIds(read(path.join(root, name)))) === JSON.stringify(expectedIds),
      name + ': stage table/registry mismatch'); } catch {}
  }
  let originalWorkflowUnchanged = false;
  try {
    originalWorkflowUnchanged = crypto.createHash('sha256')
      .update(fs.readFileSync(path.join(root, 'roadmap', 'current-system-workflow.md'))).digest('hex') === originalHash;
    check(originalWorkflowUnchanged, 'Original user-comment source changed; review explicitly rather than silently accepting a new baseline');
  } catch (error) { errors.push('Cannot verify preserved workflow source'); }
  return { ok: errors.length === 0, ...stats, stages: stages.length, acceptanceCases: caseIds.size,
    originalWorkflowUnchanged, productAcceptanceExecuted: false, errors };
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
  const result = validateRoadmap();
  console.log(JSON.stringify(result, null, 2));
  process.exitCode = result.ok ? 0 : 1;
}
