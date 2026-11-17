import {test,expect} from '@playwright/test';
import {harness} from '../support/harness.mjs';
import {pdfFixture,resumeText} from '../support/documents.mjs';

let h;
test.beforeAll(async()=>{h=await harness();await h.startWorker();});
test.afterAll(async()=>{if(h)await h.close();});
async function choose(page,label,name){
 await page.getByRole('combobox',{name:label,exact:true}).click();
 await page.getByRole('option',{name,exact:true}).click();
}
async function layout(page){
 expect(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1)).toBe(false);
 const outside=await page.locator('button:visible,a:visible,h1:visible,h2:visible').evaluateAll(nodes=>nodes.filter(n=>{
  const r=n.getBoundingClientRect();return r.width>0&&(r.left< -1||r.right>innerWidth+1);
 }).map(n=>n.textContent?.slice(0,50)));
 expect(outside).toEqual([]);
}
for(const width of [1600,390]){
 test('reviewed onboarding with conflict, correction, disclosure and erasure at '+width,async({page},info)=>{
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.setViewportSize({width,height:1000});
  await page.goto(h.c.origin+'/maxim');
  await page.getByLabel('Workspace access key').fill(h.c.bootstrapKey);
  await page.getByRole('button',{name:'Sign in',exact:true}).click();
  const nav=page.locator(width>1000?'.sidebar':'.mobile-navigation');
  await nav.getByRole('button',{name:/^Candidate/}).click();
  await expect(page.getByRole('heading',{name:'Candidate',exact:true})).toBeVisible();
  await page.getByRole('button',{name:'Add fact',exact:true}).first().click();
  const manual=page.getByRole('dialog',{name:'Add candidate fact'});
  const initial='Browser Example '+width;
  await manual.getByRole('textbox',{name:/^Confirmed value\b/}).fill(initial);
  await manual.getByRole('button',{name:'Confirm declaration',exact:true}).click();
  await expect(manual).toBeHidden();
  await expect(page.getByRole('region',{name:'Confirmed candidate facts'})).toContainText(initial);
  await choose(page,'Knowledge view','Sources');
  const pdf=await pdfFixture({text:resumeText+'\nUnique viewport fixture '+width});
  await page.getByLabel('Upload candidate source').setInputFiles({name:'browser-'+width+'.pdf',mimeType:'application/pdf',buffer:pdf});
  await expect(page.locator('.source-row').filter({hasText:'browser-'+width+'.pdf'})).toContainText('review required',{timeout:30000});
  await layout(page);
  await page.screenshot({path:info.outputPath('sources-'+width+'.png'),fullPage:true});
  await choose(page,'Knowledge view','Review proposals');
  const proposal=page.locator('.fact-proposal').filter({has:page.getByText('Full name',{exact:true})}).first();
  await expect(proposal).toContainText('Conflict');
  await proposal.getByRole('button',{name:'Review fact'}).click();
  const review=page.getByRole('dialog',{name:'Review candidate fact'});
  await expect(review).toContainText(initial);
  await expect(review.getByRole('button',{name:'Replace confirmed value'})).toBeDisabled();
  await review.getByRole('checkbox',{name:'I reviewed the conflict and intend to replace the current value.'}).check();
  await review.getByRole('button',{name:'Replace confirmed value'}).click();
  await expect(review).toBeHidden();
  await choose(page,'Knowledge view','Confirmed knowledge');
  await page.getByRole('button',{name:'Correct Full name',exact:true}).click();
  const correction=page.getByRole('dialog',{name:'Correct candidate fact'});
  const final='Corrected Browser '+width;
  await correction.getByRole('textbox',{name:/^Confirmed value\b/}).fill(final);
  await correction.getByRole('textbox',{name:/Correction reason/}).fill('Corrected exact synthetic display name');
  await correction.getByRole('button',{name:'Confirm correction'}).click();
  await expect(correction).toBeHidden();
  await page.reload();
  await choose(page,'Knowledge view','Confirmed knowledge');
  await expect(page.getByRole('region',{name:'Confirmed candidate facts'})).toContainText(final);
  await choose(page,'Knowledge view','Sources');
  const row=page.locator('.source-row').filter({hasText:'browser-'+width+'.pdf'});
  await row.getByRole('button',{name:'Allow model consent'}).click();
  const disclosure=page.getByRole('dialog',{name:'Allow source disclosure?'});
  await expect(disclosure).toContainText('Minimized, redacted text');
  await disclosure.getByRole('button',{name:'Cancel',exact:true}).click();
  await row.getByRole('button',{name:'Delete browser-'+width+'.pdf'}).click();
  const erase=page.getByRole('dialog',{name:'Delete candidate source?'});
  await erase.getByRole('button',{name:'Delete source',exact:true}).click();
  await expect(erase).toBeHidden();
  await expect(row).toHaveCount(0);
  await expect(page.locator('.source-row').filter({hasText:'Deleted source'}).last()).toContainText('deleted');
  await layout(page);
  await page.screenshot({path:info.outputPath('knowledge-'+width+'.png'),fullPage:true});
  expect(errors).toEqual([]);
 });
}

