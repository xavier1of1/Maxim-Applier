import test from 'node:test';
import assert from 'node:assert/strict';
import {structuredPosting,enrichPosting} from '../../src/server/discovery-details.ts';
const row={title:'Customer Delivery Builder',company:'New Labs',url:'https://board.example/jobs/42',description:'A short teaser.'};
const posting={'@type':'JobPosting',title:row.title,hiringOrganization:{name:row.company},description:'<p>Integrate REST APIs and automate workflows. Deliver production software to customers with reliable observability and practical implementation.</p>',jobLocation:{address:{addressLocality:'Arlington',addressRegion:'VA',addressCountry:'US'}},datePosted:'2026-11-21',baseSalary:{currency:'USD',value:{unitText:'YEAR',minValue:90000,maxValue:120000}}};
const html=p=>'<script type="application/ld+json">'+JSON.stringify(p)+'</script>';
test('full posting extraction requires unambiguous matching employer/title and real structured description',()=>{
 const p=structuredPosting(html({'@graph':[posting]}),row);assert.match(p.description,/Integrate REST APIs/);assert.equal(p.location,'Arlington, VA, US');assert.equal(p.salary.min,90000);
 assert.equal(structuredPosting(html({...posting,title:'Different role'}),row),null);
 assert.equal(structuredPosting(html({...posting,hiringOrganization:{name:'Different Employer'}}),row),null);
 assert.equal(structuredPosting(html([posting,posting]),row),null);
 assert.equal(structuredPosting('<main>'+posting.description.repeat(3)+'</main>',row),null,'long page text alone is not a complete posting');
 assert.equal(structuredPosting(html({...posting,validThrough:'2000-01-01'}),row),null);
 assert.ok(structuredPosting(html(posting).replace('ld+json','ld&#x2B;json'),row),'HTML-encoded script MIME is decoded, not silently missed');
});
test('publisher-declared expired postings are explicit holds rather than new full evidence',async()=>{
 const r=await enrichPosting(row,async()=>({text:html({...posting,validThrough:'2000-01-01'})}),()=>{});
 assert.equal(r.full,false);assert.equal(r.status,'posting_expired');assert.equal(r.row.description,row.description);
});

test('known ATS details verify identity, preserve real requirements and refuse restricted destinations',async()=>{
 const gh={...row,url:'https://job-boards.greenhouse.io/newlabs/jobs/42'};const urls=[];
 const r=await enrichPosting(gh,async url=>{urls.push(url);return {text:JSON.stringify({id:42,title:gh.title,content:'&lt;p&gt;Build software integrations. An active TS/SCI clearance is required. Deliver customer workflows.&lt;/p&gt;'})};},()=>{});
 assert.equal(r.full,true);assert.match(r.row.description,/active TS\/SCI/);assert.ok(!r.row.description.includes('<p>'));assert.match(urls[0],/boards-api.greenhouse.io\/v1\/boards\/newlabs\/jobs\/42$/);
 const wrong=await enrichPosting(gh,async()=>({text:JSON.stringify({id:43,title:gh.title,content:posting.description})}),()=>{});assert.equal(wrong.full,false);assert.equal(wrong.errorCode,'posting_changed');
 const denied=await enrichPosting({...row,url:'https://www.linkedin.com/jobs/view/42'},async()=>{throw Error('Must not request');},()=>{});assert.equal(denied.status,'restricted_destination');
});
test('missing, malformed and challenged detail responses remain held, not fabricated full descriptions',async()=>{
 for(const response of ['not-json','<html>Generic careers</html>']){const r=await enrichPosting(row,async()=>({text:response}),()=>{});assert.equal(r.full,false);}
 const r=await enrichPosting(row,async()=>{throw Object.assign(Error('Stop'),{code:'auth_or_challenge'});},()=>{});assert.equal(r.full,false);assert.equal(r.errorCode,'auth_or_challenge');
});
test('board detail API preserves actual application link and rejects closed or changed identities',async()=>{
 const source={...row,url:'https://speedrun-talent-network.com/jobs/example-42',externalId:'42'};
 const payload={id:'42',title:row.title,company:row.company,status:'open',description_text:'Build customer software integrations with REST APIs and automate workflows for production users.',apply:{kind:'external',url:'https://jobs.ashbyhq.com/newlabs/opening-42/application'}};
 let called='';const r=await enrichPosting(source,async url=>{called=url;return {text:JSON.stringify({job:payload})};},()=>{});
 assert.equal(r.full,true);assert.equal(r.row.applicationUrl,payload.apply.url);assert.match(called,/\/api\/v1\/jobs\/42\?source=career-ops/);
 const closed=await enrichPosting(source,async()=>({text:JSON.stringify({job:{...payload,status:'closed'}})}),()=>{});assert.equal(closed.status,'posting_closed');assert.equal(closed.full,false);
});
