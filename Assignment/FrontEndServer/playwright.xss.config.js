const { defineConfig } = require('@playwright/test');

module.exports = defineConfig({
  testDir: './tests',
  timeout: 60_000,
  use: {
    baseURL: 'https://localhost:3001',
    headless: true,
    ignoreHTTPSErrors: true
  }
});
