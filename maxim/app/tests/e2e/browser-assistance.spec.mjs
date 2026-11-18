import {test,expect} from '@playwright/test';
import {harness} from '../support/harness.mjs';
import {preparedApplication,apiCommand,applicationForm} from '../support/assisted-application.mjs';
let h,fixture;
test.beforeAll(async()=>{h=await harness();h.providerRoutes.set('/browser-form',(_req,res)=>{res.setHeader('Content-Type','text/html');res.end(applicationForm);});await h.startWorker();fixture=await preparedApplication(h);});
test.afterAll(async()=>{if(h)await h.close();});
for(const width of [1600,390])test('reviewed agent-browser workflow and remembered unknown at '+width,async({page},info)=>{
 await page.setViewportSize({width,height:1000});const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(h.c.origin+'/maxim?view=browser');await page.getByLabel('Workspace access key').fill(h.c.bootstrapKey);await page.getByRole('button',{name:'Sign in',exact:true}).click();
 await expect(page.getByRole('heading',{name:'Application Assistance',exact:true})).toBeVisible();
 await page.getByRole('checkbox',{name:/I authorize this dedicated application session/}).check();
 await page.getByRole('checkbox',{name:/Allow my approved private contact/}).check();
 await page.getByRole('button',{name:'Open application browser',exact:true}).click();
 const bulk=page.getByRole('button',{name:'Fill approved fields and PDF',exact:true});await expect(bulk).toBeEnabled({timeout:30000});await bulk.click();
 await expect(page.locator('.pill').filter({hasText:'attachment selected'})).toBeVisible({timeout:30000});
 const project=page.locator('article').filter({has:page.getByText('Describe a customer project?',{exact:true})});
 await expect(project.getByRole('button',{name:'Save question',exact:true})).toBeVisible();
 const q=await apiCommand(h,'answers','save_question',{text:'Describe a customer project?',company:'Assisted Fixture',roleLane:'unspecified',answerType:'text',options:[],tags:[]});
 let library=await(await h.request(h.a,'/api/answers')).json();
 if(!library.answers.some(a=>a.question_id===q.id&&a.status==='approved')){
  const a=await apiCommand(h,'answers','draft_answer',{questionId:q.id,text:'I built customer integrations using Rust and TypeScript.',facts:[],expectedCandidateRevision:fixture.candidate.revision,permission:'company',modelConsent:false});
  await apiCommand(h,'answers','approve_answer',{answerId:a.id,expectedRevision:a.revision,contentHash:a.content_hash,declarationConfirmed:true});
 }
 await project.getByRole('button',{name:'Find approved answer',exact:true}).click();
 const dialog=page.getByRole('dialog',{name:'Review reusable answer'});await expect(dialog).toContainText('I built customer integrations using Rust and TypeScript.');
 await dialog.getByRole('button',{name:'Confirm and fill this answer',exact:true}).click();await expect(dialog).toBeHidden();
 await expect(project).toContainText('filled locally',{timeout:30000});
 await page.reload();await expect(project).toContainText('filled locally');
 expect(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1)).toBe(false);
 await page.screenshot({path:info.outputPath('application-review-'+width+'.png'),fullPage:true});
 await page.getByRole('button',{name:'Review and take manual control',exact:true}).click();
 const manual=page.getByRole('dialog',{name:'Manual application review'});await expect(manual).toContainText('Only you submit.');
 await manual.getByRole('button',{name:'Take manual control',exact:true}).click();await expect(manual).toBeHidden();
 await expect(page.locator('.pill').filter({hasText:/^manual handoff$/})).toBeVisible({timeout:30000});
 const state=await(await h.request(h.a,'/api/applications')).json();expect(state.applications.find(a=>a.id===fixture.app.id).outcome).toBe('not_submitted');
 await page.getByRole('button',{name:'Close dedicated browser',exact:true}).click();
 await expect(page.getByRole('button',{name:'Open application browser',exact:true})).toBeVisible({timeout:30000});
 expect(errors).toEqual([]);
});
