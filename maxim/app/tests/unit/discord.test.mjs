import {test} from 'node:test';
import assert from 'node:assert/strict';
import {scheduleWindow,validateSchedule} from '../../src/server/integrations/discord/schedule.ts';
import {retryDelay} from '../../src/server/integrations/discord/transport.ts';

test('Discord calendar schedule preserves weekly wall time across DST and coalesces misses',()=>{
 const spec={kind:'weekly_review',timezone:'America/New_York',anchorDate:'2026-10-25',localTime:'09:00'};
 let r=scheduleWindow(spec,new Date('2026-10-30T10:00:00Z'));
 assert.equal(r.previous.toISOString(),'2026-10-25T13:00:00.000Z');assert.equal(r.next.toISOString(),'2026-11-01T14:00:00.000Z');
 r=scheduleWindow(spec,new Date('2027-01-20T10:00:00Z'));
 assert.equal(r.previous.toISOString(),'2027-01-17T14:00:00.000Z');assert.equal(r.next.toISOString(),'2027-01-24T14:00:00.000Z');
});
test('Discord Saturday interval is 21 calendar days, not UTC hours',()=>{
 const spec={kind:'resume_review',timezone:'America/New_York',anchorDate:'2026-10-24',localTime:'09:00'};
 const r=scheduleWindow(spec,new Date('2026-11-01T12:00:00Z'));
 assert.equal(r.previous.toISOString(),'2026-10-24T13:00:00.000Z');assert.equal(r.next.toISOString(),'2026-11-14T14:00:00.000Z');
 assert.throws(()=>validateSchedule({...spec,anchorDate:'2026-10-25'}),/Saturday/);
});
test('Discord DST gap rolls forward, fold runs once, anchor before first tick is respected',()=>{
 const gap={kind:'weekly_review',timezone:'America/New_York',anchorDate:'2026-03-08',localTime:'02:30'};
 assert.equal(scheduleWindow(gap,new Date('2026-03-08T06:00:00Z')).next.toISOString(),'2026-03-08T07:00:00.000Z');
 const fold={...gap,anchorDate:'2026-11-01',localTime:'01:30'};
 assert.equal(scheduleWindow(fold,new Date('2026-11-01T06:15:00Z')).previous.toISOString(),'2026-11-01T05:30:00.000Z');
 assert.equal(scheduleWindow(fold,new Date('2026-10-01T00:00:00Z')).previous,null);
 assert.throws(()=>validateSchedule({...gap,timezone:'not/a-zone'}));
 assert.throws(()=>validateSchedule({...gap,anchorDate:'2026-02-30'}));
});
test('Discord backoff honors hints without retrying earlier than excessive remote cooldown',()=>{
 assert.equal(retryDelay(1),5);assert.equal(retryDelay(5),80);assert.equal(retryDelay(2,120.1),121);
 assert.equal(retryDelay(1,86401),null);assert.equal(retryDelay(1,NaN),null);assert.equal(retryDelay(1,-1),null);
});
