import { defineConfig, devices } from "@playwright/test";

// Journeys J-1 to J-13 live in e2e/, one file per journey, with axe on every
// screen (docs/spec/05-engineering-handbook.md section 8). Chromium runs on
// every pull request; Firefox and WebKit on main and before launch.
const port = 3100;

export default defineConfig({
  testDir: "./e2e",
  forbidOnly: !!process.env["CI"],
  reporter: process.env["CI"] ? [["list"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: `http://127.0.0.1:${port}`,
    trace: "retain-on-failure",
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "firefox", use: { ...devices["Desktop Firefox"] } },
    { name: "webkit", use: { ...devices["Desktop Safari"] } },
  ],
  webServer: {
    command: `pnpm build && pnpm start --port ${port}`,
    url: `http://127.0.0.1:${port}`,
    reuseExistingServer: !process.env["CI"],
  },
});
