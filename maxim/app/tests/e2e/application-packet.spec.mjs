import {test,expect} from '@playwright/test';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import {harness} from '../support/harness.mjs';
import {getDocument} from 'pdfjs-dist/legacy/build/pdf.mjs';
let h;
const command=async(endpoint,action,payload)=>{
 const r=await h.request(h.a,'/api/'+endpoint+'/commands',{method:'POST',body:{commandId:crypto.randomUUID(),action,payload}});
 const v=await r.json();expect(r.status,JSON.stringify(v)).toBe(200);return v.result;
};
test.beforeAll(async()=>{
 h=await harness();
 for(const [fieldKey,value]of [['candidate.name','Application Demo'],['projects.summary','Built customer integrations using Rust and TypeScript.']]){
  await command('candidate','manual_fact',{fieldKey,value,expectedFactRevision:0,modelConsent:true,reason:'Synthetic UI proof'});
 }
 const person=await(await h.request(h.a,'/api/candidate')).json();
 const transition=await(await h.request(h.a,'/api/candidate/cutover',{method:'POST',body:{commandId:crypto.randomUUID(),action:'prepare',expectedRevision:person.candidate.revision}})).json();
 expect((await h.request(h.a,'/api/candidate/cutover',{method:'POST',body:{commandId:crypto.randomUUID(),action:'activate',transitionId:transition.result.id,expectedRevision:person.candidate.revision}})).ok).toBe(true);
 await h.startWorker();
});
test.afterAll(async()=>{if(h)await h.close();});
async function login(page,url){
 await page.goto(h.c.origin+url);await page.getByLabel('Workspace access key').fill(h.c.bootstrapKey);await page.getByRole('button',{name:'Sign in',exact:true}).click();
 await expect(page.getByRole('heading',{name:'Applications',exact:true})).toBeVisible();
}
async function choose(page,label,value){await page.getByRole('combobox',{name:label}).click();await page.getByRole('option',{name:value,exact:true}).click();}
async function layout(page){
 expect(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1)).toBe(false);
 expect(await page.locator('h1:visible,h2:visible,h3:visible,button:visible').evaluateAll(nodes=>nodes.filter(n=>{const r=n.getBoundingClientRect();return r.width>0&&(r.left< -1||r.right>innerWidth+1);}).map(n=>n.textContent?.slice(0,50)))).toEqual([]);
}
for(const width of [1600,390]){
 test('evaluate, exact packet review and manual progress at '+width,async({page},info)=>{
  const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.setViewportSize({width,height:1000});
  const job=await(await h.request(h.a,'/api/commands',{method:'POST',body:{commandId:crypto.randomUUID(),action:'create_job',payload:{company:'UI Lifecycle '+width,title:'Forward Deployed Engineer',location:'Reston, VA',url:'https://example.com/jobs/'+width,description:'Build full-stack customer integrations using Rust and TypeScript in Reston, VA. Salary: 100000 USD annually.'}}})).json();
  await command('applications','set_job_policy',{jobId:job.result.id,expectedJobRevision:1,expectedPolicyRevision:0,salary:{flat:100000,currency:'USD',period:'annual'},sourceQuote:'Salary: 100000 USD annually.'});
  const intent=await(await h.request(h.a,'/api/commands',{method:'POST',body:{commandId:crypto.randomUUID(),action:'create_intent',payload:{jobId:job.result.id}}})).json();
  await login(page,'/maxim?view=applications&application='+intent.result.id);
  const work=page.getByRole('region',{name:'Application workspace'});
  await expect(work.getByText('Unknown',{exact:true}).first()).toBeVisible();
  await work.getByRole('button',{name:'Evaluate with Career-Ops',exact:true}).click();
  await expect(work.locator('.lifecycle-summary')).toContainText('4.6/5',{timeout:30000});await expect(work.locator('.lifecycle-summary')).toContainText('T3');
  await work.getByText('Prepare PDF packet',{exact:true}).click();
  await work.getByRole('checkbox',{name:'I selected this evidence specifically for this role.'}).check();
  await work.getByRole('button',{name:'Generate PDF packet',exact:true}).click();
  await expect(work.getByRole('button',{name:'Review packet',exact:true})).toBeVisible({timeout:30000});
  if(width===1600){
   const state=await(await h.request(h.a,'/api/applications')).json(),packet=state.packets.find(p=>p.application_id===intent.result.id);
   const response=await h.request(h.a,'/api/artifacts/'+packet.pdf_artifact_id),task=getDocument({data:new Uint8Array(await response.arrayBuffer()),useSystemFonts:true,isEvalSupported:false}),doc=await task.promise;
   try{
    expect(doc.numPages).toBe(1);const pdfPage=await doc.getPage(1);expect(pdfPage.view).toEqual([0,0,612,792]);
    const text=await pdfPage.getTextContent();
    for(const item of text.items.filter(i=>i.str?.trim())){expect(item.transform[4]).toBeGreaterThanOrEqual(36);expect(item.transform[4]+item.width).toBeLessThanOrEqual(576);expect(item.transform[5]).toBeGreaterThanOrEqual(36);expect(item.transform[5]).toBeLessThanOrEqual(756);}
    const viewport=pdfPage.getViewport({scale:1.5}),surface=doc.canvasFactory.create(viewport.width,viewport.height);
    await pdfPage.render({canvas:surface.canvas,canvasContext:surface.context,viewport}).promise;
    const rgba=surface.context.getImageData(0,0,surface.canvas.width,surface.canvas.height).data;let nonwhite=0;for(let i=0;i<rgba.length;i+=4)if(rgba[i]<230&&rgba[i+1]<230&&rgba[i+2]<230)nonwhite++;expect(nonwhite).toBeGreaterThan(1000);
    fs.writeFileSync(info.outputPath('retained-resume.png'),surface.canvas.toBuffer('image/png'));doc.canvasFactory.destroy(surface);
   }finally{await task.destroy();}
  }
  await work.getByRole('button',{name:'Review packet',exact:true}).click();
  const approve=page.getByRole('dialog',{name:'Approve exact packet'});
  await expect(approve.getByRole('button',{name:'Approve packet',exact:true})).toBeDisabled();
  await expect(approve).toContainText('PDF SHA-256');await approve.getByRole('textbox',{name:/^Reason/}).fill('Reviewed the exact synthetic report, resume PDF and evidence.');
  await approve.getByRole('checkbox',{name:'I reviewed this exact report, PDF and selected evidence.'}).check();
  await layout(page);await page.screenshot({path:info.outputPath('packet-review-'+width+'.png'),fullPage:true});
  await approve.getByRole('button',{name:'Approve packet',exact:true}).click();await expect(approve).toBeHidden();
  await expect(work.locator('.lifecycle-summary')).toContainText('packet ready');
  await work.getByRole('button',{name:'Record manual start',exact:true}).click();
  let dialog=page.getByRole('dialog',{name:'Record manual start'});await dialog.getByRole('textbox',{name:/^Reason/}).fill('I opened and started the visible application manually.');await dialog.getByRole('button',{name:'Record decision',exact:true}).click();await expect(dialog).toBeHidden();
  await work.getByRole('button',{name:'Record form review',exact:true}).click();
  dialog=page.getByRole('dialog',{name:'Record form review'});await dialog.getByRole('checkbox',{name:'I manually filled and reviewed the form.'}).check();await dialog.getByRole('textbox',{name:/^Reason/}).fill('I manually filled and reviewed the synthetic form.');await dialog.getByRole('button',{name:'Record decision',exact:true}).click();await expect(dialog).toBeHidden();
  await expect(work.locator('.lifecycle-summary')).toContainText('not submitted');
  await work.getByRole('button',{name:'Record submission',exact:true}).click();
  dialog=page.getByRole('dialog',{name:'Record completed submission'});await choose(dialog,'Submission evidence','Reviewed approved packet');await dialog.getByRole('checkbox',{name:'The application has already been submitted manually.'}).check();await dialog.getByRole('textbox',{name:/^Reason/}).fill('Synthetic declaration of a manually completed application.');await dialog.getByRole('button',{name:'Record completed submission',exact:true}).click();await expect(dialog).toBeHidden();
  await page.reload();await expect(work.locator('.lifecycle-summary')).toContainText('submitted');
  await expect(work.getByRole('button',{name:'Record manual start',exact:true})).toBeDisabled();await expect(work.getByRole('button',{name:'Record form review',exact:true})).toBeDisabled();
  await layout(page);await page.screenshot({path:info.outputPath('application-progress-'+width+'.png'),fullPage:true});
  const v=await(await h.request(h.a,'/api/applications')).json(),app=v.applications.find(a=>a.id===intent.result.id);
  expect(app.workflow).toBe('review_ready');expect(app.outcome).toBe('submitted');expect(app.filled_at).toBeTruthy();expect(app.submitted_snapshot.score).toBe(4.6);expect(errors).toEqual([]);
 });
}
test('migration UI preserves raw-only records and never switches authority implicitly',async({page},info)=>{
 const native=path.join(h.c.privateRoot,'native');fs.mkdirSync(path.join(native,'data'),{recursive:true});
 fs.writeFileSync(path.join(native,'data/applications.md'),'| # | Company | Role | Status |\n|---|---|---|---|\n| 1 | Raw Company | Role | Custom raw state |\n');
 await login(page,'/maxim?view=applications');await choose(page,'Application workspace view','Legacy migration');
 const migration=page.getByRole('region',{name:'Legacy migration'});
 await migration.getByRole('checkbox',{name:'I reviewed and authorize the selected local operation.'}).check();await migration.getByRole('button',{name:'Capture native trackers for review',exact:true}).click();
 await expect(migration).toContainText('Custom raw state');await migration.getByRole('button',{name:'Review record',exact:true}).click();
 const dialog=page.getByRole('dialog',{name:'Reconcile legacy record'});await expect(dialog).toContainText('Custom raw state');
 await dialog.getByRole('textbox',{name:/^Resolution reason/}).fill('Preserve the raw historical state without inventing an outcome.');await dialog.getByRole('button',{name:'Record reviewed resolution',exact:true}).click();await expect(dialog).toBeHidden();
 await migration.getByRole('textbox',{name:/^Migration \/ ownership reason/}).fill('Reviewed raw-only fixture capture.');
 await migration.getByRole('checkbox',{name:'I reviewed and authorize the selected local operation.'}).check();await migration.getByRole('checkbox',{name:'I reviewed the raw-only source issues.'}).check();
 await migration.getByRole('button',{name:'Commit reviewed import',exact:true}).click();
 await expect(migration.getByRole('button',{name:'Commit reviewed import',exact:true})).toBeDisabled();
 expect((await(await h.request(h.a,'/api/applications/authority')).json()).authority.owner).toBe('legacy');
 await layout(page);await page.screenshot({path:info.outputPath('migration.png'),fullPage:true});
});
