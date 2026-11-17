import test from 'node:test';
import assert from 'node:assert/strict';
import {packetHtml,normalizedPdfText} from '../../src/worker/packet.ts';
import {canonicalJobUrl} from '../../src/server/application-duplicates.ts';
test('packet HTML is extractive, escaped and professionally grouped without source-key headings',()=>{
 const html=packetHtml([{field_key:'candidate.name',value:'Fixture <Candidate>'},{field_key:'projects.source123abc',value:'Built a customer tool with Rust & TypeScript.'}]);
 assert.ok(html.includes('Fixture &lt;Candidate&gt;')&&html.includes('Rust &amp; TypeScript.'));
 assert.ok(html.includes('<h2>Projects</h2>'));assert.ok(!html.includes('source123abc'));
 assert.ok(!html.includes('<script>')&&!html.includes('Willing to relocate'));
});
test('unresolved placeholders are withheld and ATS normalization changes typography, not claims',()=>{
 for(const value of ['TODO: complete this','{{years_of_experience}}','[INSERT achievement]','TBD']){
  assert.throws(()=>packetHtml([{field_key:'candidate.name',value:'Fixture'},{field_key:'projects.summary',value}]),e=>e.code==='packet_placeholder');
 }
 assert.equal(normalizedPdfText('Rust\u2014TypeScript\n  customer work'),'Rust-TypeScript customer work');
});
test('duplicate identity ignores tracking only, not distinct opening IDs',()=>{
 assert.equal(canonicalJobUrl('https://example.com/job/123?utm_source=test#apply'),canonicalJobUrl('https://example.com/job/123'));
 assert.notEqual(canonicalJobUrl('https://example.com/job?id=123'),canonicalJobUrl('https://example.com/job?id=124'));
 assert.notEqual(canonicalJobUrl('https://example.com/job/123'),canonicalJobUrl('https://example.com/job/124'));
});
