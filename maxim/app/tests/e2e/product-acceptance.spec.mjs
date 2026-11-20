import {test,expect} from '@playwright/test';
import fs from 'node:fs';
import crypto from 'node:crypto';
import {harness} from '../support/harness.mjs';
let h;
test.beforeAll(async()=>{h=await harness();});
test.afterAll(async()=>{if(h)await h.close();});
const views=[['home','Home'],['jobs','Jobs'],['archive','Archive'],['candidate','Candidate'],['answers','Answers'],['discovery','Discovery'],['applications','Applications'],['browser','Apply Assistant'],['gmail','Gmail'],['discord','Discord'],['networking','Networking'],['interview','Interview practice'],['activity','Activity'],['settings','Settings']];
for(const width of [1600,390])test('S11 every mounted view is real, bounded and accessible at '+width,async({page},info)=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.setViewportSize({width,height:1000});
 await page.goto(h.c.origin+'/maxim');await page.getByLabel('Workspace access key').fill(h.c.bootstrapKey);await page.getByRole('button',{name:'Sign in',exact:true}).click();
 for(const [view,label]of views){
  await page.goto(h.c.origin+'/maxim?view='+view);await expect(page.getByRole('heading',{name:label,exact:true}).first()).toBeVisible();
  await expect(page.getByText(/Loading (?:application assistance|mail evidence|networking|interview)/).first()).toHaveCount(0);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),view).toBe(false);
  await page.screenshot({path:info.outputPath(view+'-'+width+'.png'),fullPage:true});
 }
 expect(errors).toEqual([]);expect(await page.evaluate(()=>localStorage.length)).toBe(0);
});

test('evaluation setup links preserve the exact intent and keep owner approval explicit',async({page})=>{
 const command=async(path,action,payload)=>{
  const r=await h.request(h.a,path,{method:'POST',body:{commandId:crypto.randomUUID(),action,payload}});
  expect(r.status).toBe(200);return (await r.json()).result;
 };
 const job=await command('/api/commands','create_job',{company:'Synthetic setup',title:'Software Engineer',location:'Reston, VA',description:'Build reliable customer software and support reviewed deployments across local environments.'});
 const app=await command('/api/commands','create_intent',{jobId:job.id});
 await command('/api/candidate/commands','manual_fact',{fieldKey:'candidate.name',value:'Synthetic Candidate',expectedFactRevision:0,modelConsent:false,reason:'Isolated setup test'});
 const old=fs.readFileSync(h.runtime);
 fs.writeFileSync(h.runtime,JSON.stringify({...h.c,model:{...h.c.model,apiKey:''}}));
 h.providerRoutes.set('/v1/models/fixture-model',{body:{id:'fixture-model'}});
 try{
  await page.goto(h.c.origin+'/maxim?view=applications&application='+app.id);
  await page.getByLabel('Workspace access key').fill(h.c.bootstrapKey);
  await page.getByRole('button',{name:'Sign in',exact:true}).click();
  await expect(page.getByRole('button',{name:'Evaluate with Career-Ops'})).toBeDisabled();
  await page.getByRole('button',{name:'Review candidate knowledge',exact:true}).click();
  await expect(page.getByRole('region',{name:'Confirmed candidate facts',exact:true})).toContainText('Synthetic Candidate');
  await page.goBack();
  await page.getByRole('button',{name:'Configure evaluation model'}).click();
  await page.getByRole('textbox',{name:/^Model ID/}).fill('fixture-model');
  await page.getByLabel('API key',{exact:true}).fill('synthetic-local-key');
  await page.getByRole('button',{name:'Save connection',exact:true}).click();
  await page.getByRole('button',{name:'Check model access',exact:true}).click();
  await expect(page.getByText('OpenAI confirmed model access. Task compatibility has not been tested; no evaluation was run.')).toBeVisible();
  await page.goBack();
  await expect(page).toHaveURL(new RegExp('application='+app.id));
  await expect(page.getByRole('button',{name:'Evaluate with Career-Ops'})).toBeDisabled();
  const candidate=(await h.sql('SELECT ownership FROM candidates WHERE workspace_id=$1',[h.c.workspaceId])).rows[0];
  expect(candidate.ownership).toBe('legacy');
 }finally{
  h.providerRoutes.delete('/v1/models/fixture-model');fs.writeFileSync(h.runtime,old);
 }
});
