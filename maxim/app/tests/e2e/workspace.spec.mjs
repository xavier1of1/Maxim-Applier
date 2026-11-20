import {test,expect} from '@playwright/test';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import {harness} from '../support/harness.mjs';

let h;
test.beforeAll(async()=>{h=await harness();});
test.afterAll(async()=>{if(h)await h.close();});
async function signIn(page){
 await page.goto(h.c.origin+'/maxim');
 await page.getByLabel('Workspace access key').fill(h.c.bootstrapKey);
 await page.getByRole('button',{name:'Sign in',exact:true}).click();
 await expect(page.getByRole('heading',{name:'Jobs',exact:true})).toBeVisible();
 await expect(page.getByRole('region',{name:'Job records',exact:true})).toBeVisible();
}
async function create(page,company,title){
 await page.getByRole('button',{name:'New role',exact:true}).first().click();
 const dialog=page.getByRole('dialog',{name:'New role'});
 await expect(dialog).toBeVisible();
  await dialog.getByRole('textbox',{name:/^Company\b/}).fill(company);
  await dialog.getByRole('textbox',{name:/^Role title\b/}).fill(title);
 await dialog.getByLabel('Location',{exact:true}).fill('Arlington, VA');
 await dialog.getByLabel('Posting URL',{exact:true}).fill('https://example.org/jobs/qa');
 await dialog.getByLabel('Job description',{exact:true}).fill('Deploy useful customer software with a small engineering team.');
 await dialog.getByRole('button',{name:'Create role',exact:true}).click();
 await expect(dialog).toBeHidden();
 await expect(page.getByRole('article',{name:title+' at '+company})).toBeVisible();
 return new URL(page.url()).searchParams.get('job');
}
async function layout(page){
 const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1);
 expect(overflow).toBe(false);
 const invalid=await page.locator('button:visible,a:visible,h1:visible,h2:visible').evaluateAll(nodes=>nodes.filter(n=>{
  const r=n.getBoundingClientRect();return r.width>0&&(r.left< -1||r.right>innerWidth+1);
 }).map(n=>n.textContent?.slice(0,50)));
 expect(invalid).toEqual([]);
}
test('desktop real intake, intent, note, artifact, streamed tools and human confirmation',async({page},info)=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await signIn(page);
 await expect(page.getByRole('heading',{name:'No roles yet'})).toBeVisible();
 const jobId=await create(page,'UI Robotics','Forward Deployed Engineer');
 expect(jobId).toMatch(/^[0-9a-f-]{36}$/);
 await page.getByRole('button',{name:'Create intent',exact:true}).click();
 await expect(page.getByRole('button',{name:'Application intent',exact:true})).toBeVisible();
 await page.getByRole('textbox',{name:'Working note',exact:true}).fill('Research the team before the conversation.');
 await page.getByRole('button',{name:'Save note',exact:true}).click();
 await expect(page.getByText('rev 2',{exact:true})).toBeVisible();
 await page.getByLabel('Upload reference file').setInputFiles({name:'research.md',mimeType:'text/markdown',buffer:Buffer.from('Private UI fixture')});
 await expect(page.getByRole('link',{name:'Download research.md'})).toBeVisible();
 await page.reload();
 await expect(page.getByRole('textbox',{name:'Working note',exact:true})).toHaveValue('Research the team before the conversation.');
 await page.getByRole('textbox',{name:'Message agent',exact:true}).fill('List my saved roles.');
 await page.getByRole('button',{name:'Send message',exact:true}).click();
 await expect(page.locator('.message-assistant').filter({hasText:'Saved roles: UI Robotics'})).toBeVisible();
 await page.getByRole('textbox',{name:'Message agent',exact:true}).fill('[case:note] '+jobId);
 await page.getByRole('button',{name:'Send message',exact:true}).click();
 await page.getByRole('button',{name:'Review proposal',exact:true}).click();
 const review=page.getByRole('dialog',{name:'Review note update'});
 await expect(review).toBeVisible();
 await expect(review.getByText('Follow up with the hiring team.',{exact:true})).toBeVisible();
 await review.getByRole('button',{name:'Confirm update',exact:true}).click();
 await expect(review).toBeHidden();
 await expect(page.getByRole('textbox',{name:'Working note',exact:true})).toHaveValue('Follow up with the hiring team.');
 await expect(page.getByText('rev 3',{exact:true})).toBeVisible();
 const conversationId=new URL(page.url()).searchParams.get('conversation');expect(conversationId).toBeTruthy();
 await page.reload();await expect(page.getByRole('textbox',{name:'Message agent'})).toBeVisible();
 expect(new URL(page.url()).searchParams.get('conversation')).toBe(conversationId);
 await expect(page.locator('.message-assistant').filter({hasText:'A note change is ready for your review.'})).toBeVisible();
 await layout(page);await page.screenshot({path:info.outputPath('desktop-workspace.png'),fullPage:true});
 await page.locator('.sidebar').getByRole('button',{name:/^Applications/}).click();
 await expect(page.getByRole('table')).toContainText('UI Robotics');
 await page.locator('.sidebar').getByRole('button',{name:/^Activity/}).click();
 await expect(page.locator('.event-list')).toContainText(/Job note confirmed/i);
 await page.locator('.sidebar').getByRole('button',{name:'Settings',exact:true}).click();
 for(const name of ['Open Gmail','Open Discord','Open Apply Assistant'])await expect(page.getByRole('button',{name,exact:true})).toBeEnabled();
 await expect(page.getByLabel('Replace API key')).toHaveValue('');
 await expect(page.locator('body')).not.toContainText('fixture-provider-key');
 await layout(page);await page.screenshot({path:info.outputPath('desktop-settings.png'),fullPage:true});
 expect(errors).toEqual([]);
});
test('keyboard focus, form cancellation and dirty-note protection',async({page})=>{
 await signIn(page);
 const trigger=page.getByRole('button',{name:'New role',exact:true}).first();
 await trigger.focus();await page.keyboard.press('Enter');
 const dialog=page.getByRole('dialog',{name:'New role'});
 await expect(dialog.getByRole('textbox',{name:/^Company\b/})).toBeFocused();
 for(let i=0;i<12;i++)await page.keyboard.press('Tab');
 expect(await dialog.evaluate(n=>n.contains(document.activeElement))).toBe(true);
 await dialog.getByRole('textbox',{name:/^Company\b/}).focus();
 await expect(page.locator('[role="tooltip"]:visible')).toHaveCount(0);
 await page.keyboard.press('Escape');await expect(dialog).toBeHidden();
 await expect(trigger).toBeFocused();
 await create(page,'Keyboard Systems','Implementation Engineer');
 await page.getByRole('textbox',{name:'Working note',exact:true}).fill('Unsaved draft');
 await page.locator('.sidebar').getByRole('button',{name:'Settings',exact:true}).click();
 const guard=page.getByRole('dialog',{name:'Discard unsaved note?'});
 await expect(guard).toBeVisible();
 await guard.getByRole('button',{name:'Keep editing'}).click();
 await expect(page.getByRole('textbox',{name:'Working note',exact:true})).toHaveValue('Unsaved draft');
 await page.getByRole('button',{name:'Discard note changes'}).click();
});
test('truthful backend failure, model failure, empty result, and sign-out states',async({page})=>{
 await signIn(page);
 await page.route('**/api/workspace',route=>route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({error:{code:'service_unavailable',message:'Workspace storage is unavailable.'}})}));
 await page.getByRole('button',{name:'Refresh workspace',exact:true}).click();
 await expect(page.locator('.banner-error')).toContainText('Showing the last loaded workspace.');
 await expect(page.getByRole('button',{name:'New role',exact:true}).first()).toBeDisabled();
 await page.unroute('**/api/workspace');
 await page.getByRole('button',{name:'Refresh workspace',exact:true}).click();
 await expect(page.locator('.banner-error')).toBeHidden();
 await page.getByRole('searchbox',{name:'Search roles'}).fill('Not an existing company');
 await expect(page.getByRole('heading',{name:'No matching roles'})).toBeVisible();
 await page.getByRole('button',{name:'Clear search',exact:true}).click();
 await page.getByRole('textbox',{name:'Message agent'}).fill('[case:failure]');
 await page.getByRole('button',{name:'Send message'}).click();
 await expect(page.locator('.agent-panel').getByRole('alert')).toContainText('provider rate or quota limit');
 await expect(page.locator('body')).not.toContainText('fixture_provider_body_secret');
 await page.locator('.sidebar').getByRole('button',{name:'Settings',exact:true}).click();
 await page.getByRole('button',{name:'Sign out',exact:true}).click();
 await expect(page.getByLabel('Workspace access key')).toBeVisible();
 const response=await page.request.get(h.c.origin+'/api/workspace');expect(response.status()).toBe(401);
});
test('mobile intake and navigation fit the viewport without hidden overlapping controls',async({page},info)=>{
 await page.setViewportSize({width:390,height:844});
 await signIn(page);
 await create(page,'Mobile Systems With A Long Company Name','Software Engineer, Customer Platforms');
 await expect(page.getByRole('article',{name:'Software Engineer, Customer Platforms at Mobile Systems With A Long Company Name'})).toBeVisible();
 await layout(page);await page.screenshot({path:info.outputPath('mobile-role.png'),fullPage:true});
 await page.getByRole('button',{name:'Discuss role with agent'}).click();
 const agent=page.getByRole('dialog',{name:'Workspace agent',exact:true});
 await expect(agent).toBeVisible();
 const bounds=await agent.boundingBox();expect(Math.round(bounds.width)).toBe(390);expect(Math.round(bounds.height)).toBe(844);
 await agent.getByRole('textbox',{name:'Message agent'}).fill('List my roles.');
 await agent.getByRole('button',{name:'Send message'}).click();
 await expect(agent.locator('.message-assistant').filter({hasText:'Saved roles:'})).toBeVisible();
 await layout(page);await page.screenshot({path:info.outputPath('mobile-agent.png'),fullPage:true});
 await agent.getByRole('button',{name:'Close agent'}).click();
 await page.locator('.mobile-navigation').getByRole('button',{name:'More',exact:true}).click();
 await page.getByRole('dialog',{name:'Navigation',exact:true}).getByRole('button',{name:'Settings',exact:true}).click();
 await expect(page.getByRole('heading',{name:'Model connection'})).toBeVisible();await layout(page);
});
test('no model key disables agent but leaves real manual intake available',async({page})=>{
 const original=fs.readFileSync(h.runtime,'utf8');
 try{
  fs.writeFileSync(h.runtime,JSON.stringify({...h.c,model:{...h.c.model,apiKey:''}}));
  await signIn(page);await expect(page.getByRole('textbox',{name:'Message agent'})).toBeDisabled();
  await expect(page.getByRole('button',{name:'New role',exact:true}).first()).toBeEnabled();
  await page.locator('.sidebar').getByRole('button',{name:'Settings',exact:true}).click();
  await expect(page.getByLabel('API key',{exact:true})).toHaveValue('');
 }finally{fs.writeFileSync(h.runtime,original);}
});
test('compact desktop, tablet and narrow mobile preserve usable navigation and text',async({page},info)=>{
 await signIn(page);
 for(const width of [1280,768,320]){
  await page.setViewportSize({width,height:850});await layout(page);
  await page.screenshot({path:info.outputPath('viewport-'+width+'.png'),fullPage:true});
 }
});
