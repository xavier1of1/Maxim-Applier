import {test,expect} from '@playwright/test';
import crypto from 'node:crypto';
import {harness} from '../support/harness.mjs';
import {preparedApplication,apiCommand,until} from '../support/assisted-application.mjs';
let h,f,low;
const create=async(title,score)=>{
 const r=await h.request(h.a,'/api/commands',{method:'POST',body:{commandId:crypto.randomUUID(),action:'create_job',payload:{company:'Fit Fixture',title,location:'Reston, VA',description:'Build customer integrations with Rust and TypeScript in Reston, VA. [score:'+score+']'}}});
 expect(r.status).toBe(200);return (await r.json()).result;
};
test.beforeAll(async()=>{
 h=await harness();await h.startWorker();f=await preparedApplication(h);low=await create('Qualified Software Engineer',4.2);
 await apiCommand(h,'evaluations','start_evaluation',{jobId:low.id,expectedJobRevision:1,expectedCandidateRevision:f.candidate.revision});
 await until(async()=>{const d=await(await h.request(h.a,'/api/workspace')).json();return d.jobs.find(j=>j.id===low.id)?.fit?.current;},'lower score');
});
test.afterAll(async()=>{if(h)await h.close();});
for(const width of [1600,390])test('score sorting, selected fit, unscored evaluation and stale evidence at '+width,async({page},info)=>{
 const job=await create('Unscored Software Engineer '+width,4.0);
 await page.setViewportSize({width,height:1000});await page.goto(h.c.origin+'/maxim?view=jobs');
 await page.getByLabel('Workspace access key').fill(h.c.bootstrapKey);await page.getByRole('button',{name:'Sign in',exact:true}).click();
 const rows=page.locator('.role-row');await expect(rows.first()).toContainText('4.6/5 / T3');
 await expect(rows.filter({hasText:job.title})).toContainText('Not evaluated');
 await page.getByRole('combobox',{name:'Sort roles',exact:true}).click();await page.getByRole('option',{name:'Score: lowest first',exact:true}).click();
 await expect(page).toHaveURL(/sort=score_asc/);await expect(rows.first()).toContainText('4.2/5 / T2');
 await page.reload();await expect(rows.first()).toContainText('4.2/5 / T2');
 await rows.filter({hasText:job.title}).click();
 const fit=page.getByRole('region',{name:'Career-Ops fit',exact:true});await expect(fit).toContainText('Not evaluated');
 await fit.getByRole('button',{name:'Evaluate with Career-Ops',exact:true}).click();
 await expect(fit).toContainText('4.0/5 / T2',{timeout:30000});
 await expect(fit.getByRole('link',{name:'Full evaluation report'})).toBeVisible();
 await page.screenshot({path:info.outputPath('selected-fit-'+width+'.png'),fullPage:true});
 if(width<1000)await page.getByRole('button',{name:'All roles',exact:true}).click();
 await expect(rows.first()).toContainText('4.0/5 / T2');
 await h.sql("UPDATE evaluations SET status='stale' WHERE job_id=$1",[job.id]);
 await page.reload();await expect(rows.filter({hasText:job.title})).toContainText('Re-evaluation needed');
 await expect(rows.first()).toContainText('4.2/5 / T2');
 expect(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1)).toBe(false);
 await page.screenshot({path:info.outputPath('score-list-'+width+'.png'),fullPage:true});
});
