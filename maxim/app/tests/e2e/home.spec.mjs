import {test,expect} from '@playwright/test';
import crypto from 'node:crypto';
import {harness} from '../support/harness.mjs';
import {preparedApplication} from '../support/assisted-application.mjs';
let h;
test.beforeAll(async()=>{
 h=await harness();
 for(const outcome of ['submitted','responded','interviewing','offer','rejected','withdrawn']){
  const id=crypto.randomUUID();await h.sql("INSERT INTO jobs(id,workspace_id,company,title,location,description) VALUES($1,$2,'Home Fixture','Software Engineer','Reston, VA','Synthetic journey fixture')",[id,h.c.workspaceId]);
  await h.sql('INSERT INTO applications(id,workspace_id,job_id,outcome,applied_at) VALUES($1,$2,$3,$4,now())',[crypto.randomUUID(),h.c.workspaceId,id,outcome]);
 }
 const old=crypto.randomUUID();await h.sql("INSERT INTO jobs(id,workspace_id,company,title,description) VALUES($1,$2,'Older Home Fixture','Software Engineer','Historical cohort fixture')",[old,h.c.workspaceId]);
 await h.sql("INSERT INTO applications(id,workspace_id,job_id,outcome,applied_at) VALUES($1,$2,$3,'submitted',now()-interval '70 days')",[crypto.randomUUID(),h.c.workspaceId,old]);
});

test('an older cohort response cannot overwrite the selected cohort',async({page})=>{
 await page.goto(h.c.origin+'/maxim?view=home');await page.getByLabel('Workspace access key').fill(h.c.bootstrapKey);await page.getByRole('button',{name:'Sign in',exact:true}).click();
 await expect(page.locator('#flow-description')).toContainText('7 unique');let started;const dispatched=new Promise(resolve=>{started=resolve;});
 await page.route('**/api/home?days=90',async route=>{const response=await route.fetch();started();await new Promise(resolve=>setTimeout(resolve,800));await route.fulfill({response});});
 await page.getByRole('button',{name:'Refresh workspace',exact:true}).click();await dispatched;
 await page.getByRole('combobox',{name:'Submission cohort',exact:true}).click();await page.getByRole('option',{name:'Past 30 days',exact:true}).click();
 await expect(page.locator('#flow-description')).toContainText('6 unique');await page.waitForTimeout(1000);await expect(page.locator('#flow-description')).toContainText('6 unique');
});

test('a high-fit recommendation clears conflicting job filters',async({page})=>{
 await h.startWorker();const f=await preparedApplication(h);await h.sql('UPDATE jobs SET posted_at=now(),last_seen_at=now() WHERE id=$1',[f.job.id]);
 await page.goto(h.c.origin+'/maxim?view=home&fit=unscored&maxScore=3.4&company=NoMatch&q=irrelevant');
 await page.getByLabel('Workspace access key').fill(h.c.bootstrapKey);await page.getByRole('button',{name:'Sign in',exact:true}).click();
 await page.getByRole('button',{name:'View Software engineering openings',exact:true}).click();
 await expect(page.getByRole('article',{name:'Software Engineer at Assisted Fixture',exact:true})).toBeVisible();
 const q=new URL(page.url()).searchParams;for(const key of ['fit','maxScore','company','q'])expect(q.has(key)).toBe(false);expect(q.get('minScore')).toBe('4');
 await h.sql("UPDATE evaluations SET status='stale' WHERE job_id=$1",[f.job.id]);
});
test.afterAll(async()=>{if(h)await h.close();});
for(const width of [1600,390])test('brand is the Home destination without a redundant tab at '+width,async({page})=>{
 await page.setViewportSize({width,height:1000});await page.goto(h.c.origin+'/maxim?view=jobs');
 await page.getByLabel('Workspace access key').fill(h.c.bootstrapKey);await page.getByRole('button',{name:'Sign in',exact:true}).click();
 await expect(page.getByRole('button',{name:'Home',exact:true})).toHaveCount(0);
 const brand=width===1600?page.locator('.sidebar .brand-home'):page.locator('.topbar .brand-home');
 await expect(brand).toHaveAttribute('href','/maxim?view=home');await brand.focus();await page.keyboard.press('Enter');
 await expect(page.getByRole('heading',{name:'Home',exact:true})).toBeVisible();await expect(brand).toHaveAttribute('aria-current','page');
 if(width===1600){
  await page.locator('.sidebar .nav-item').filter({hasText:/^Jobs/}).click();await page.locator('.role-row').first().click();
  await page.getByRole('textbox',{name:'Working note',exact:true}).fill('Unsaved brand navigation fixture');await brand.click();
  await expect(page.getByRole('heading',{name:'Discard unsaved note?',exact:true})).toBeVisible();
  await page.getByRole('button',{name:'Keep editing',exact:true}).click();
  await expect(page.getByRole('textbox',{name:'Working note',exact:true})).toHaveValue('Unsaved brand navigation fixture');
  await brand.click();await page.getByRole('button',{name:'Discard changes',exact:true}).click();
  await expect(page.getByRole('heading',{name:'Home',exact:true})).toBeVisible();
 }
 if(width===390){
  await page.getByRole('button',{name:'Jobs',exact:true}).click();await page.getByRole('button',{name:'Open navigation',exact:true}).click();
  await page.locator('.navigation-dialog .brand-home').click();
  await expect(page.getByRole('heading',{name:'Home',exact:true})).toBeVisible();await expect(page.locator('.navigation-dialog')).toBeHidden();
 }
});
for(const width of [1600,390])test('Home flow is nonblank, truthful and bounded at '+width,async({page},info)=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.setViewportSize({width,height:1000});await page.goto(h.c.origin+'/maxim');
 await page.getByLabel('Workspace access key').fill(h.c.bootstrapKey);await page.getByRole('button',{name:'Sign in',exact:true}).click();
 await expect(page.getByRole('heading',{name:'Home',exact:true})).toBeVisible();
 await expect(page.locator('.home-metrics>div')).toHaveCount(8);await expect(page.locator('.workspace-stats')).toHaveCount(0);
 const svg=page.getByRole('img',{name:'Application journey'});await expect(svg).toBeVisible();expect(await svg.locator('path').count()).toBeGreaterThan(5);
 expect(await svg.locator('rect').evaluateAll(nodes=>new Set(nodes.map(n=>n.getAttribute('fill'))).size)).toBeGreaterThan(4);
 await page.getByText('Flow records',{exact:true}).click();await expect(page.locator('.flow-table table')).toContainText('Awaiting response');
 await expect(page.getByRole('heading',{name:'No current high-fit shortlist'})).toBeVisible();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1)).toBe(false);expect(errors).toEqual([]);
 await page.locator('#workspace-content').evaluate(el=>el.scrollTo(0,0));
 await page.screenshot({path:info.outputPath('home-flow-'+width+'.png'),fullPage:true});
});
