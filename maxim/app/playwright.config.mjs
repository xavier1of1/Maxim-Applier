import { defineConfig } from '@playwright/test';
export default defineConfig({
 testDir:'./tests/e2e',fullyParallel:false,workers:1,timeout:60000,
 expect:{timeout:10000},retries:0,reporter:[['list'],['html',{open:'never'}]],
 use:{browserName:'chromium',viewport:{width:1600,height:1000},trace:'retain-on-failure',screenshot:'only-on-failure'},
});
