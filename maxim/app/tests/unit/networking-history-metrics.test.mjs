import test from 'node:test';
import assert from 'node:assert/strict';
import JSZip from 'jszip';
import {parseImport,importLimits} from '../../src/server/networking/import-parser.ts';
import {contactFromRaw,rankContact,draftParts} from '../../src/server/networking/policy.ts';
import {computeMetrics,locationBucket} from '../../src/server/networking/metrics.ts';

test('NET-01 raw CSV preserves whitespace, quotes, Unicode, empty optionals and quoted newlines',()=>{
 const bytes=Buffer.from('Name,Company,Notes,connection_strength\r\n"  Synthetic Person  ",Fixture,"line 1\r\nline ""2"" \u{1f600}",\r\n');
 const rows=parseImport('contacts.csv',bytes,'contacts');
 assert.equal(rows[0].raw.Name,'  Synthetic Person  ');assert.equal(rows[0].raw.Notes,'line 1\r\nline "2" \u{1f600}');
 assert.equal(contactFromRaw(rows[0].raw).strength,null);
 assert.throws(()=>parseImport('contacts.csv',Buffer.from('Name,Name\nA,B'),'contacts'));
 assert.throws(()=>parseImport('contacts.csv',Buffer.from('Name\n"unterminated'),'contacts'));
 assert.throws(()=>parseImport('../contacts.csv',bytes,'contacts'));
 assert.throws(()=>parseImport('contacts.csv',Buffer.alloc(importLimits.bytes+1),'contacts'));
 assert.throws(()=>parseImport('contacts.csv',Buffer.from('Name\n'+Array(5002).fill('A').join('\n')),'contacts'));
});
async function workbook(extra={}){
 const z=new JSZip(),ns='http://schemas.openxmlformats.org/spreadsheetml/2006/main';
 z.file('[Content_Types].xml','<Types/>');
 z.file('xl/workbook.xml',`<workbook xmlns="${ns}" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="History" sheetId="1" r:id="rId1"/></sheets></workbook>`);
 z.file('xl/_rels/workbook.xml.rels','<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Target="worksheets/sheet1.xml"/></Relationships>');
 z.file('xl/worksheets/sheet1.xml',`<worksheet xmlns="${ns}"><sheetData><row r="1"><c r="A1" t="inlineStr"><is><t>Company</t></is></c><c r="B1" t="inlineStr"><is><t>Interview Round</t></is></c></row><row r="2"><c r="A2" t="inlineStr"><is><t>  Synthetic  </t></is></c><c r="B2" t="inlineStr"><is><t>Phone screen</t></is></c></row></sheetData></worksheet>`);
 for(const [name,value]of Object.entries(extra))z.file(name,value);
 return z.generateAsync({type:'nodebuffer',compression:'DEFLATE'});
}
test('NET-01 bounded native XLSX and ZIP reject traversal, active XML/formulas and expansion',async()=>{
 const bytes=await workbook();assert.equal(parseImport('history.xlsx',bytes,'history')[0].raw.Company,'  Synthetic  ');
 for(const extra of [{'../outside.xml':'x'},{'xl/vbaProject.bin':'x'},{'xl/evil.xml':'<!DOCTYPE x [<!ENTITY y SYSTEM "file:///secret">]><x/>'},{'xl/_rels/external.rels':'<Relationship TargetMode="External" Target="https://example.com"/>'},{'xl/bomb.xml':'x'.repeat(200000)}]){
  const z=await workbook(extra);assert.throws(()=>parseImport('history.xlsx',z,'history'));
 }
 const z=await JSZip.loadAsync(bytes),xml=await z.file('xl/worksheets/sheet1.xml').async('string');z.file('xl/worksheets/sheet1.xml',xml.replace('<c r="A2"','<c r="A2"').replace('<is><t>  Synthetic  </t></is>','<f>HYPERLINK("https://example.com")</f><v>1</v>'));
 assert.throws(()=>parseImport('history.xlsx',Buffer.from('not an archive'),'history'));
 const formula=await z.generateAsync({type:'nodebuffer'});assert.throws(()=>parseImport('history.xlsx',formula,'history'));
 const connections=new JSZip();connections.file('Connections.csv','Notes:\nExport\n\nFirst Name,Last Name,Company\nSynthetic,Person,Fixture');
 const zip=await connections.generateAsync({type:'nodebuffer'});assert.equal(parseImport('connections.zip',zip,'contacts')[0].raw['First Name'],'Synthetic');
 assert.throws(()=>parseImport('history.zip',zip,'history'));
});
test('NET-02 strict optional strength and explained relationships; generic engineering is insufficient',()=>{
 const contact=contactFromRaw({Name:'Synthetic',Title:'Engineer',Company:'Unrelated'});
 assert.equal(rankContact({company:'Fixture',title:'Software Engineer'},contact),null);
 for(const strength of ['0','4','1.5','invalid'])assert.throws(()=>contactFromRaw({Name:'Synthetic',connection_strength:strength}));
 const ranked=rankContact({company:'Fixture',title:'Engineer'},{...contact,company:'Fixture',strength:3,recruiter:true});
 assert.equal(ranked.rankScore,95);assert.deepEqual(ranked.reasons.map(r=>r.field),['company','strength','recruiter']);
 const parts=draftParts('Reviewed person quote','Fixture','Engineer','Exact approved background','Would you speak?');
 assert.equal(Object.keys(parts).length,5);assert.ok(!JSON.stringify(parts).includes('Virginia Tech'));
});
const cohort={from:'2026-01-01T00:00:00Z',to:'2026-10-30T00:00:00Z',asOf:'2026-10-30T00:00:00Z',maturityDays:14};
const attempt=(identity,extra={})=>({identity,submitted:true,submittedAt:'2026-10-01T00:00:00Z',location:'Reston, VA',interview:'unknown',origin:'synthetic',...extra});
test('NET-06/07 unique submitted denominator, explicit exclusions, empty/small/unknown cohorts',()=>{
 const records=[attempt('a',{interview:'accepted',interviewAt:'2026-10-15T00:00:00Z',metadata:{score:4.5,tier:'T3'}}),attempt('a'),attempt('b',{location:'Arlington, TX'}),attempt('c',{location:'Arlington'}),attempt('d',{submitted:false}),attempt('e',{submittedAt:null}),attempt('f',{submittedAt:'2026-11-01T00:00:00Z'}),attempt('g',{submittedAt:'2025-12-01T00:00:00Z'}),attempt('h',{location:'Bethesda, MD'}),attempt('i',{submittedAt:'2026-10-28T00:00:00Z',outcome:'unknown'})];
 const m=computeMetrics(records,cohort);
 assert.deepEqual(m.primary,{numerator:1,denominator:2,value:0.5,smallSample:true});
 assert.deepEqual(m.exclusions,{duplicate:1,notSubmitted:1,missingSubmittedAt:1,afterAsOf:1,outsideCohort:1,unknownLocation:1,incompatibleLocation:2});
 assert.equal(m.immature,1);assert.equal(m.breakdowns.variant[0].segment,'unknown');assert.equal(m.breakdowns.freshness[0].denominator,2);
 assert.equal(computeMetrics([],cohort).primary.value,null);
 assert.equal(locationBucket('Gainesville, VA'),'compatible');assert.equal(locationBucket('Gainesville, FL'),'excluded');assert.equal(locationBucket('Remote'),'unknown');assert.equal(locationBucket('Bethesda, MD / Reston, VA'),'compatible');
 assert.equal(computeMetrics([attempt('x',{interview:'accepted',interviewAt:'2026-11-01T00:00:00Z'})],cohort).primary.numerator,0);
});
