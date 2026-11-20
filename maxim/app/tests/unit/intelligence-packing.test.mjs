import test from 'node:test';
import assert from 'node:assert/strict';
import {screeningSummaries} from '../../src/server/intelligence-cycle.ts';
test('maximum Unicode/control-heavy screening pool fits the Rust input bound without raw policy payloads',()=>{
 const jobs=Array.from({length:200},(_,n)=>({id:String(n),company:'\x01"'.repeat(200),title:'\x02\\'.repeat(240),description:'Rust 😀\n'.repeat(5000),age_hours:3,discovery_policy:{flags:[{flagType:'location',severity:'positive'}],unused:'x'.repeat(50000)}}));
 const summaries=screeningSummaries(jobs);assert.equal(summaries.length,200);assert.ok(Buffer.byteLength(JSON.stringify(summaries))<=400201);
 assert.ok(summaries.every(j=>j.blocked===false&&j.hasEvaluation===false&&j.discovery_policy===undefined&&Buffer.byteLength(JSON.stringify(j))<=2000));
 assert.ok(jobs[0].description.length>2000,'packing never rewrites the full stored posting');
});
