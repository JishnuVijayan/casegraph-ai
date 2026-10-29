import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir:'.',testMatch:'workflow.spec.ts',fullyParallel:false,workers:1,retries:0,
  timeout:180000,expect:{timeout:15000},reporter:'line',outputDir:'../.local/e2e-artifacts',
  use:{baseURL:'http://127.0.0.1:15173',channel:'chrome',headless:true,viewport:{width:1440,height:1100},
    actionTimeout:15000,navigationTimeout:20000,trace:'off',video:'off',screenshot:'off',acceptDownloads:true},
});
