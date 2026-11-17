import { defineConfig, devices } from "@playwright/test";

// Journeys J-1 to J-13 live in e2e/, one file per journey, with axe on every
// screen (docs/spec/05-engineering-handbook.md section 8). Chromium runs on
// every pull request; Firefox and WebKit on main and before launch.
const port = 3100;
// Development-only pages, such as the Python runtime page (WP-3.1), exist
// only under the development server, so their tests run against it.
const developmentPort = 3101;
const runtime = /runtime\.spec\.ts$/;

const engines = [
  ["chromium", devices["Desktop Chrome"]],
  ["firefox", devices["Desktop Firefox"]],
  ["webkit", devices["Desktop Safari"]],
] as const;

export default defineConfig({
  testDir: "./e2e",
  forbidOnly: !!process.env["CI"],
  reporter: process.env["CI"] ? [["list"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: `http://127.0.0.1:${port}`,
    trace: "retain-on-failure",
  },
  projects: [
    ...engines.map(([name, device]) => ({ name, testIgnore: runtime, use: { ...device } })),
    // The runtime's "Done when" names all three engines (WP-3.1).
    ...engines.map(([name, device]) => ({
      name: `runtime-${name}`,
      testMatch: runtime,
      use: { ...device, baseURL: `http://127.0.0.1:${developmentPort}` },
    })),
  ],
  webServer: [
    {
      command: `pnpm build && pnpm start --port ${port}`,
      url: `http://127.0.0.1:${port}`,
      reuseExistingServer: !process.env["CI"],
    },
    {
      command: `pnpm dev --hostname 127.0.0.1 --port ${developmentPort}`,
      url: `http://127.0.0.1:${developmentPort}/dev/runtime`,
      reuseExistingServer: !process.env["CI"],
      timeout: 180_000,
    },
  ],
});
