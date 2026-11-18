import {test,expect} from '@playwright/test';
import {harness} from '../support/harness.mjs';
let h;
test.beforeAll(async()=>{h=await harness();});
test.afterAll(async()=>{if(h)await h.close();});
const views=[['jobs','Jobs'],['candidate','Candidate'],['answers','Answers'],['discovery','Discovery'],['applications','Applications'],['browser','Apply Assistant'],['gmail','Gmail'],['discord','Discord'],['networking','Networking'],['interview','Interview practice'],['activity','Activity'],['settings','Settings']];
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
