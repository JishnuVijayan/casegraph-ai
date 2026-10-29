import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir:'.',testMatch:'workflow.spec.ts',fullyParallel:false,workers:1,retries:0,
  timeout:180000,expect:{timeout:15000},reporter:'line',outputDir:'../.local/e2e-artifacts',
  // Use Playwright's bundled Chromium — never channel:'chrome', which attaches to the
  // user's installed Google Chrome and can force-quit it during e2e teardown.
  use:{baseURL:'http://127.0.0.1:15173',headless:true,viewport:{width:1440,height:1100},
    actionTimeout:15000,navigationTimeout:20000,trace:'off',video:'off',screenshot:'off',acceptDownloads:true},
});
