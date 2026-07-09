const { defineConfig } = require("@playwright/test");

module.exports = defineConfig({
  testDir: "./tests",
  timeout: 60_000,
  use: {
    baseURL: "https://localhost:3001",
    headless: true,
    ignoreHTTPSErrors: true
  },
  webServer: {
    command: "node server.js",
    url: "https://localhost:3001/login.html",
    reuseExistingServer: true,
    timeout: 15_000
  }
});
