import {test,expect} from '@playwright/test';
import fs from 'node:fs';
import {harness} from '../support/harness.mjs';
let h;
test.beforeAll(async()=>{h=await harness();});
test.afterAll(async()=>{if(h)await h.close();});
for(const width of [1600,390])test('discover and save unknown API model without disclosure at '+width,async({page},info)=>{
 const original=fs.readFileSync(h.runtime);h.providerRoutes.set('/v1/models',{body:{data:[{id:'future-text-model'},{id:'gpt-4.1-mini'}]}});
 h.providerRoutes.set('/v1/models/future-text-model',{body:{id:'future-text-model'}});
 try{
  await page.setViewportSize({width,height:1000});await page.goto(h.c.origin+'/maxim?view=settings');
  await page.getByLabel('Workspace access key').fill(h.c.bootstrapKey);await page.getByRole('button',{name:'Sign in',exact:true}).click();
  await page.getByRole('textbox',{name:/^Model ID/}).fill('GPT-6.1 Terra');
  await page.getByRole('button',{name:'Save connection',exact:true}).click();
  await expect(page.getByText('Enter the exact API model ID without spaces, not a display name.')).toBeVisible();
  await page.getByLabel('Replace API key').fill('synthetic-unsaved-key');
  await page.getByRole('button',{name:'Load models',exact:true}).click();
  await page.getByRole('button',{name:/^Available API models/}).click();
  await page.getByRole('combobox',{name:'Search options',exact:true}).fill('future');
  await page.getByRole('option',{name:'future-text-model',exact:true}).click();
  await expect(page.getByRole('textbox',{name:/^Model ID/})).toHaveValue('future-text-model');
  expect(fs.readFileSync(h.runtime).equals(original)).toBe(true);
  await page.getByRole('button',{name:'Save connection',exact:true}).click();
  await expect(page.getByText('Connection settings saved.')).toBeVisible();
  await expect(page.getByLabel('Replace API key')).toHaveValue('');
  await page.getByRole('button',{name:'Check model access',exact:true}).click();
  await expect(page.getByText(/OpenAI confirmed model access/)).toBeVisible();
  expect(h.captured).toHaveLength(0);expect(JSON.parse(fs.readFileSync(h.runtime)).model.api).toBe('responses');
  await page.reload();await expect(page.getByRole('textbox',{name:/^Model ID/})).toHaveValue('future-text-model');
  h.providerRoutes.set('/v1/models',{status:401,body:{error:{message:'secret-provider-message'}}});
  await page.getByRole('button',{name:'Load models',exact:true}).click();
  await expect(page.getByText(/Could not load models/)).toBeVisible();
  await expect(page.getByRole('textbox',{name:/^Model ID/})).toBeEnabled();
  await expect(page.locator('body')).not.toContainText('secret-provider-message');
  await expect(page.locator('body')).not.toContainText('synthetic-unsaved-key');
  expect(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1)).toBe(false);
  await page.screenshot({path:info.outputPath('model-settings-'+width+'.png'),fullPage:true});
 }finally{fs.writeFileSync(h.runtime,original);h.providerRoutes.clear();}
});
