import { defineConfig, devices } from "@playwright/test";
export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: false,
  workers: 1,
  timeout: 40000,
  reporter: "list",
  use: {
    baseURL: "http://localhost:3001",
    channel: "chrome",
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
  },
  projects: [
    { name: "desktop", use: { viewport: { width: 1440, height: 1100 } } },
    {
      name: "mobile",
      use: {
        ...devices["iPhone 13"],
        defaultBrowserType: "chromium",
        channel: "chrome",
      },
    },
  ],
  webServer: {
    command: "node node_modules/next/dist/bin/next start --port 3001",
    url: "http://localhost:3001",
    reuseExistingServer: true,
    timeout: 30000,
  },
});
