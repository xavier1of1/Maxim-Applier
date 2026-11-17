import {test,expect} from '@playwright/test';
import crypto from 'node:crypto';
import {harness} from '../support/harness.mjs';

let h;
test.beforeAll(async()=>{
 h=await harness();
 const command={commandId:crypto.randomUUID(),action:'manual_fact',payload:{fieldKey:'candidate.name',value:'UI Memory Example',expectedFactRevision:0,modelConsent:true,reason:'Synthetic onboarding prerequisite'}};
 expect((await h.request(h.a,'/api/candidate/commands',{method:'POST',body:command})).ok).toBe(true);
 const candidate=await (await h.request(h.a,'/api/candidate')).json();
 const transition=await (await h.request(h.a,'/api/candidate/cutover',{method:'POST',body:{commandId:crypto.randomUUID(),action:'prepare',expectedRevision:candidate.candidate.revision}})).json();
 expect((await h.request(h.a,'/api/candidate/cutover',{method:'POST',body:{commandId:crypto.randomUUID(),action:'activate',transitionId:transition.result.id,expectedRevision:candidate.candidate.revision}})).ok).toBe(true);
});
test.afterAll(async()=>{if(h)await h.close();});
async function choose(page,label,option){
 await page.getByRole('combobox',{name:label}).click();
 await page.getByRole('option',{name:option,exact:true}).click();
}
async function layout(page){
 expect(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1)).toBe(false);
 const outside=await page.locator('button:visible,a:visible,h1:visible,h2:visible').evaluateAll(nodes=>nodes.filter(n=>{const r=n.getBoundingClientRect();return r.width>0&&(r.left< -1||r.right>innerWidth+1);}).map(n=>n.textContent?.slice(0,70)));
 expect(outside).toEqual([]);
}
for(const width of [1600,390]){
 test('answer once, approve, recall across companies, confirm reuse, correct and erase at '+width,async({page},info)=>{
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.setViewportSize({width,height:1000});await page.goto(h.c.origin+'/maxim');
  await page.getByLabel('Workspace access key').fill(h.c.bootstrapKey);
  await page.getByRole('button',{name:'Sign in',exact:true}).click();
  if(width>1000)await page.locator('.sidebar').getByRole('button',{name:'Answers',exact:true}).click();
  else{await page.getByRole('button',{name:'Open navigation',exact:true}).click();await page.getByRole('dialog',{name:'Navigation',exact:true}).getByRole('button',{name:'Answers',exact:true}).click();}
  const q='Describe your customer integration '+width+'?',answer='I built the reviewed integration '+width+'.';
  await page.getByRole('textbox',{name:/^Company\b/}).fill('UI Alpha '+width);
  await page.getByRole('textbox',{name:/^Role lane\b/}).fill('fde');
  await page.getByRole('textbox',{name:/^Exact application question\b/}).fill(q);
  await page.getByRole('button',{name:'Find answer',exact:true}).click();
  await expect(page.getByRole('region',{name:'Answer recall'})).toContainText('ask user');
  await page.getByRole('button',{name:'Record answer',exact:true}).click();
  const draft=page.getByRole('dialog',{name:'Record an answer'});
  await draft.getByRole('textbox',{name:/^Exact answer\b/}).fill(answer);
  await choose(draft,/^Reuse permission\b/,'Compatible cross-company context');
  await draft.getByRole('button',{name:'Save answer draft',exact:true}).click();
  await expect(draft).toBeHidden();
  let row=page.locator('.answer-row').filter({hasText:answer});
  await expect(row).toContainText('draft');
  await row.getByRole('button',{name:'Inspect answer',exact:true}).click();
  let inspect=page.getByRole('dialog',{name:'Inspect answer'});
  await expect(inspect.getByRole('button',{name:'Approve answer'})).toBeDisabled();
  await inspect.getByRole('checkbox',{name:'I confirm this exact answer, evidence and reuse permissions.'}).check();
  await inspect.getByRole('button',{name:'Approve answer'}).click();await expect(inspect).toBeHidden();
  await expect(row).toContainText('approved');await expect(row).toContainText('rev 2');
  await choose(page,/^Answer view\b/,'Recall');
  await page.getByRole('textbox',{name:/^Company\b/}).fill('UI Beta '+width);
  await page.getByRole('button',{name:'Find answer',exact:true}).click();
  await expect(page.getByRole('region',{name:'Recall result'})).toContainText(answer);
  await expect(page.getByRole('region',{name:'Recall result'})).toContainText('explicit cross company');
  await page.getByRole('button',{name:'Review reuse',exact:true}).click();
  const reuse=page.getByRole('dialog',{name:'Review answer reuse'});
  await expect(reuse).toContainText('ui beta '+width);
  await expect(reuse.getByRole('button',{name:'Confirm reuse'})).toBeDisabled();
  await reuse.getByRole('checkbox',{name:'I reviewed the exact target context and answer revision.'}).check();
  await reuse.getByRole('button',{name:'Confirm reuse'}).click();await expect(reuse).toBeHidden();
  await expect(page.getByRole('region',{name:'Answer reuse history'})).toContainText('confirmed');
  await layout(page);await page.screenshot({path:info.outputPath('reuse-'+width+'.png'),fullPage:true});
  await page.reload();await choose(page,/^Answer view\b/,'Answer library');
  row=page.locator('.answer-row').filter({hasText:answer});await row.getByRole('button',{name:'Inspect answer'}).click();
  inspect=page.getByRole('dialog',{name:'Inspect answer'});await inspect.getByRole('button',{name:'Draft correction'}).click();
  const correction=page.getByRole('dialog',{name:'Draft answer correction'}),revised='Corrected integration answer '+width+'.';
  await correction.getByRole('textbox',{name:/^Exact answer\b/}).fill(revised);
  await correction.getByRole('button',{name:'Save answer draft'}).click();await expect(correction).toBeHidden();
  const revisedRow=page.locator('.answer-row').filter({hasText:revised});
  await revisedRow.getByRole('button',{name:'Inspect answer'}).click();
  inspect=page.getByRole('dialog',{name:'Inspect answer'});
  await inspect.getByRole('checkbox',{name:'I confirm this exact answer, evidence and reuse permissions.'}).check();
  await inspect.getByRole('button',{name:'Approve answer'}).click();await expect(inspect).toBeHidden();
  await choose(page,/^Answer view\b/,'Reuse history');
  await expect(page.getByRole('region',{name:'Answer reuse history'})).toContainText('invalidated');
  await choose(page,/^Answer view\b/,'Answer library');
  await revisedRow.getByRole('button',{name:'Inspect answer'}).click();inspect=page.getByRole('dialog',{name:'Inspect answer'});
  await inspect.getByRole('textbox',{name:/^Revocation or deletion reason\b/}).fill('Erase this synthetic declaration');
  await inspect.getByRole('button',{name:'Delete answer'}).click();await expect(inspect).toBeHidden();
  await expect(page.getByRole('region',{name:'Stored answers'})).not.toContainText(revised);
  await layout(page);await page.screenshot({path:info.outputPath('answer-library-'+width+'.png'),fullPage:true});
  expect(errors).toEqual([]);
 });
}

