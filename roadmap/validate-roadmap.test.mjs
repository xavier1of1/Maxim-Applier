import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { validateRoadmap } from './validate-roadmap.mjs';

const registry = JSON.parse(fs.readFileSync(new URL('./stages/manifest.json', import.meta.url), 'utf8'));
const altered = edit => {
  const manifest = structuredClone(registry);
  edit(manifest.stages);
  return validateRoadmap({ manifest });
};

test('current roadmap has valid links, stage graph, handoffs, cases and preserved comments', () => {
  const result = validateRoadmap();
  assert.deepEqual(result.errors, []);
  assert.equal(result.ok, true);
  assert.equal(result.stages, 12);
  assert.equal(result.acceptanceCases, 92);
  assert.equal(result.originalWorkflowUnchanged, true);
  assert.equal(result.productAcceptanceExecuted, false);
});

test('mandatory dependency cycle is rejected', () => {
  const result = altered(stages => { stages[1].requires.push('S11'); });
  assert(result.errors.some(error => error.includes('Dependency cycle')));
});

test('unknown dependency is rejected', () => {
  const result = altered(stages => { stages[4].requires.push('S99'); });
  assert(result.errors.some(error => error.includes('unknown dependency S99')));
});

test('missing handoff producer is rejected', () => {
  const result = altered(stages => { stages[1].produces = stages[1].produces.filter(x => x !== 'job-registry'); });
  assert(result.errors.some(error => error.includes('missing producer for handoff job-registry')));
});

test('handoff without its mandatory producer dependency is rejected', () => {
  const result = altered(stages => { stages[4].requires = ['S1']; });
  assert(result.errors.some(error => error.includes('not supplied by a mandatory prerequisite')));
});

test('duplicate handoff producers are rejected', () => {
  const result = altered(stages => { stages[3].produces.push('workspace'); });
  assert(result.errors.some(error => error.includes('Multiple producers for handoff workspace')));
});

test('unregistered acceptance case is rejected', () => {
  const result = altered(stages => { stages[3].acceptance.pop(); });
  assert(result.errors.some(error => error.includes('acceptance case/registry mismatch')));
});

test('stage path traversal is rejected without opening the target', () => {
  const result = altered(stages => { stages[0].file = '../../.env'; });
  assert(result.errors.some(error => error.includes('stage path escapes stage directory')));
});

test('search cannot become a hidden prerequisite for manual evaluation', () => {
  const result = altered(stages => { stages[5].requires.push('S4'); });
  assert(result.errors.some(error => error.includes('Manual-job evaluation must not require')));
});

test('full acceptance cannot silently drop browser assistance', () => {
  const result = altered(stages => { stages[11].requires = ['S3']; });
  assert(result.errors.some(error => error.includes('Full product acceptance must require')));
});

test('conditional dependencies must name a known stage and condition', () => {
  const result = altered(stages => { stages[8].conditional.push({ stage: 'S99', when: '' }); });
  assert(result.errors.some(error => error.includes('unknown dependency S99')));
  assert(result.errors.some(error => error.includes('conditional dependency needs an explicit condition')));
});

test('conditional dependency cycles are rejected', () => {
  const result = altered(stages => {
    stages[5].conditional.push({ stage: 'S8', when: 'invalid reverse notification dependency' });
  });
  assert(result.errors.some(error => error.includes('Dependency cycle')));
});

test('planning cannot promote an implementation stage without evidence', () => {
  const result = altered(stages => { stages[6].status = 'Shipped'; });
  assert(result.errors.some(error => error.includes('implementation acceptance is not established')));
});

test('malformed registry arrays return a validation failure', () => {
  const result = altered(stages => { stages[2].requires = null; });
  assert.equal(result.ok, false);
  assert(result.errors.some(error => error.includes('Invalid stage registry arrays')));
});

test('unknown implementation status is rejected', () => {
  const result = altered(stages => { stages[0].status = 'Done enough'; });
  assert(result.errors.some(error => error.includes('invalid implementation status')));
});

test('evidence cannot reference files outside the repository', () => {
  const result = altered(stages => {
    stages[0].evidence = [{ caseId: 'OWN-01', record: '../.env', result: 'passed' }];
  });
  assert(result.errors.some(error => error.includes('evidence path escapes repository')));
});
