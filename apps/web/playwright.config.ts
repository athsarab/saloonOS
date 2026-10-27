import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './tests', timeout: 120000, workers: 1, fullyParallel: false,
  expect: { timeout: 15000 }, reporter: [['list']], use: { baseURL: 'http://localhost:3001', headless: true, actionTimeout: 20000, channel: 'msedge', trace: 'retain-on-failure' },
  outputDir: './test-results',
});
