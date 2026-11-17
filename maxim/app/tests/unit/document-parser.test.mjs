import test from 'node:test';
import assert from 'node:assert/strict';
import {extractDocument,validateDocument} from '../../src/server/document-parser.ts';
import {validateFacts} from '../../src/server/domain.ts';
import {pdfFixture,docxFixture,resumeText} from '../support/documents.mjs';

test('four supported formats extract representative real source text',async()=>{
 for(const[name,bytes]of [['resume.txt',Buffer.from(resumeText)],['resume.md',Buffer.from(resumeText)],['resume.pdf',await pdfFixture()],['resume.docx',await docxFixture()]]){
  const result=await extractDocument(name,bytes);
  assert.ok(result.text.includes('Alex Example'));assert.ok(result.text.includes('Rust'));
 }
});
test('real encrypted, blank and over-page PDFs have explicit safe outcomes',async()=>{
 const encrypted=await pdfFixture({encrypted:true}),blank=await pdfFixture({blank:true}),long=await pdfFixture({pages:31});
 await assert.rejects(()=>extractDocument('encrypted.pdf',encrypted),{code:'unsupported_pdf'});
 await assert.rejects(()=>extractDocument('blank.pdf',blank),{code:'no_extractable_text'});
 await assert.rejects(()=>extractDocument('long.pdf',long),{code:'page_limit'});
});
test('source validation rejects active, corrupt, non-UTF8, traversal and oversize input',async()=>{
 for(const[name,bytes]of [['../resume.txt',Buffer.from('data')],['run.html',Buffer.from('<script>')],['corrupt.pdf',Buffer.from('not pdf')],['binary.txt',Buffer.from([0xff])],['oversize.txt',Buffer.alloc(10*1024*1024+1,65)]]){
  assert.throws(()=>validateDocument(name,bytes));
 }
 await assert.rejects(()=>extractDocument('corrupt.pdf',Buffer.from('%PDF-1.7\nbroken')));
});
test('DOCX bombs, traversal, macros and external entity declarations are refused',async()=>{
 for(const extra of [{'../outside.txt':'outside'},{'word/vbaProject.bin':'macro'},{'word/large.xml':'x'.repeat(31*1024*1024)},{'word/entity.xml':'<!DOCTYPE x [<!ENTITY e SYSTEM "file:///private">]><x>&e;</x>'}]){
  const bytes=await docxFixture(extra);
  await assert.rejects(()=>extractDocument('unsafe.docx',bytes));
 }
});
test('native YAML import is explicit and never becomes public file support',async()=>{
 const bytes=Buffer.from('candidate:\n  full_name: Alex Example\n  email: synthetic@example.org\n');
 assert.throws(()=>validateDocument('profile.yml',bytes));
 const parsed=await extractDocument('profile.yml',bytes,true);
 assert.ok(parsed.text.includes('candidate.name: "Alex Example"'));
});
test('Rust fact boundary preserves booleans and rejects credential/prototype-style fields',()=>{
 assert.equal(validateFacts([{field_key:'authorization.active_clearance',value:false}])[0].value,false);
 assert.throws(()=>validateFacts([{field_key:'authorization.active_clearance',value:'false'}]));
 assert.throws(()=>validateFacts([{field_key:'candidate.api_key',value:'private'}]));
});
