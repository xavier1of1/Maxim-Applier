import {test,expect} from '@playwright/test';
import {harness} from '../support/harness.mjs';
import {apiCommand} from '../support/assisted-application.mjs';
let h;
test.beforeAll(async()=>{
 h=await harness();await apiCommand(h,'candidate','manual_fact',{fieldKey:'projects.summary',value:'Built customer software integrations and workflow automation.',expectedFactRevision:0,modelConsent:true,reason:'Synthetic UI discovery fixture'});await apiCommand(h,'candidate','manual_fact',{fieldKey:'preferences.seniority',value:['Entry level','Junior','Associate','Mid-level'],expectedFactRevision:0,modelConsent:false,reason:'Local-only experience-level preference'});await h.startWorker();
});
test.afterAll(async()=>{if(h)await h.close();});
async function choose(page,label,option){await page.getByRole('combobox',{name:label}).click();await page.getByRole('option',{name:option,exact:true}).click();}
for(const width of [1600,390])test('reviewed broad-market setup, live coverage and provider catalog at '+width,async({page},info)=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.setViewportSize({width,height:1000});
 h.providerRoutes.set('/api/v1/jobs',{body:{jobs:[{id:width,title:'Customer Delivery Builder',company:'Market UI '+width,url:'https://speedrun-talent-network.com/jobs/'+width,location:'Arlington, VA'}],total_pages:1}});
 h.providerRoutes.set('/api/v1/jobs/'+width,{body:{job:{id:width,status:'open',title:'Customer Delivery Builder',company:'Market UI '+width,description_text:'Build production software. Use REST APIs and automate workflows for customer requirements.'}}});
 await page.goto(h.c.origin+'/maxim?view=discovery');await page.getByLabel('Workspace access key').fill(h.c.bootstrapKey);await page.getByRole('button',{name:'Sign in',exact:true}).click();
 const setup=page.getByRole('region',{name:'Broad market setup'});await expect(setup).toBeVisible();
 if(!await setup.getByRole('button',{name:'Save search profile',exact:true}).isVisible())await setup.getByText('Search profile',{exact:true}).click();
 await expect(setup.getByRole('checkbox',{name:'Junior',exact:true})).toBeChecked();await expect(setup.getByRole('checkbox',{name:'Senior',exact:true})).not.toBeChecked();
 await setup.getByRole('button',{name:'Save search profile',exact:true}).click();await expect(setup).toContainText('Profile ready');
 await setup.getByRole('button',{name:'Enable source pack',exact:true}).click();await expect(page.getByText('Selected public boards (4/10)',{exact:true})).toBeVisible();
 await page.getByRole('button',{name:'Search jobs',exact:true}).click();
 await expect(page.getByRole('region',{name:'Discovered jobs'})).toContainText('Market UI '+width,{timeout:30000});
 await expect(page.locator('.market-coverage')).toContainText('Employers');await expect(page.getByRole('region',{name:'Search history'})).toContainText('partial');
 expect(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1)).toBe(false);
 await page.screenshot({path:info.outputPath('market-'+width+'.png'),fullPage:true});
 await choose(page,'Discovery view','Provider catalog (153)');const catalog=page.getByRole('region',{name:'Provider catalog'});
 await expect(catalog).toContainText('153 installed');await catalog.getByRole('textbox',{name:'Find provider',exact:true}).fill('torre');await expect(catalog).toContainText('retired');
 await page.screenshot({path:info.outputPath('catalog-'+width+'.png'),fullPage:true});expect(errors).toEqual([]);
});
