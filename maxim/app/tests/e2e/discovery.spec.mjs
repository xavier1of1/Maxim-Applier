import {test,expect} from '@playwright/test';
import crypto from 'node:crypto';
import {harness} from '../support/harness.mjs';
let h;
test.beforeAll(async()=>{h=await harness();await h.startWorker();});
test.afterAll(async()=>{if(h)await h.close();});
async function choose(page,label,option){await page.getByRole('combobox',{name:label}).click();await page.getByRole('option',{name:option,exact:true}).click();}
for(const width of [1600,390]){
 test('real discovery, history, save, dismiss and health at '+width,async({page},info)=>{
  const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.setViewportSize({width,height:1000});
  await page.goto(h.c.origin+'/maxim?view=discovery');
  await page.getByLabel('Workspace access key').fill(h.c.bootstrapKey);await page.getByRole('button',{name:'Sign in',exact:true}).click();
  await expect(page.getByRole('heading',{name:'Discovery',exact:true})).toBeVisible();
  await page.getByRole('button',{name:'Add source',exact:true}).click();
  const dialog=page.getByRole('dialog',{name:'Add discovery source'}),board='ui'+width;
  await dialog.getByRole('textbox',{name:/^Company name/}).fill('UI Discovery '+width);
  await dialog.getByRole('textbox',{name:/^Board slug/}).fill(board);
  h.providerRoutes.set('/v1/boards/'+board+'/jobs',{body:{jobs:[
   {id:width,title:'Software Engineer '+width,absolute_url:'https://job-boards.greenhouse.io/'+board+'/jobs/'+width,location:{name:'Manassas, VA'},content:'<p>Build customer software.</p>'},
   {id:width+1,title:'Software Engineer outside '+width,absolute_url:'https://job-boards.greenhouse.io/'+board+'/jobs/'+(width+1),location:{name:'London, United Kingdom'},content:'<p>Build software.</p>'},
   {id:width+2,title:'Accounting job '+width,absolute_url:'https://job-boards.greenhouse.io/'+board+'/jobs/'+(width+2),location:{name:'Reston, VA'},content:'<p>Work with a software engineer.</p>'},
  ]}});
  await dialog.getByRole('button',{name:'Add source',exact:true}).click();await expect(dialog).toBeHidden();
  await page.getByRole('textbox',{name:/^Role terms/}).fill('Software');
  await choose(page,'Match role terms in','Titles');
  await page.getByRole('checkbox',{name:'UI Discovery '+width+' greenhouse'}).check();
  await page.getByRole('button',{name:'Search jobs',exact:true}).click();
  const jobs=page.getByRole('region',{name:'Discovered jobs'});await expect(jobs).toContainText('Software Engineer '+width,{timeout:30000});
  await expect(jobs).not.toContainText('Software Engineer outside '+width);
  await choose(page,'Filter discovery by location','All locations');
  await expect(jobs).toContainText('Software Engineer outside '+width);
  await expect(jobs).toContainText('Policy blocked');
  await expect(jobs).not.toContainText('Accounting job '+width);
  await choose(page,'Filter discovery by location','Local + tracked');
  const row=page.locator('.discovery-job').filter({hasText:'Software Engineer '+width});
  await expect(row).toContainText('Posted unknown');await row.getByRole('button',{name:'Save opening',exact:true}).click();
  await choose(page,'Discovery view','Saved');await expect(row).toBeVisible();
  await row.getByRole('button',{name:'Dismiss opening',exact:true}).click();
  await choose(page,'Discovery view','Dismissed');await expect(row).toBeVisible();await row.getByRole('button',{name:'Restore opening',exact:true}).click();
  await choose(page,'Discovery view','Past searches');await expect(page.getByRole('region',{name:'Search history'})).toContainText('completed');
  await expect(jobs).toContainText('Software Engineer '+width);
  await page.getByText('Query and coverage lineage',{exact:true}).click();await expect(page.locator('.discovery-lineage')).toContainText('maxRequests');
  expect(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1)).toBe(false);
  await page.screenshot({path:info.outputPath('discovery-'+width+'.png'),fullPage:true});
  await choose(page,'Discovery view','Source health');await expect(page.getByRole('region',{name:'Source health'})).toContainText('UI Discovery '+width);
  await page.reload();await choose(page,'Discovery view','Source health');await expect(page.getByRole('region',{name:'Source health'})).toContainText('UI Discovery '+width);
  const data=await(await h.request(h.a,'/api/discovery')).json();const job=data.jobs.find(j=>j.title==='Software Engineer '+width);expect(job.discovery_state).toBe('none');
  expect((await h.sql('SELECT id FROM jobs WHERE workspace_id=$1 AND id=$2',[h.c.workspaceId,job.id])).rowCount).toBe(1);expect(errors).toEqual([]);
 });
}
