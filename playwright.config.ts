import { defineConfig, devices } from "@playwright/test";

// Journeys J-1 to J-13 live in e2e/, one file per journey, with axe on every
// screen (docs/spec/05-engineering-handbook.md section 8). Chromium runs on
// every pull request; Firefox and WebKit on main and before launch.
const port = 3100;
// The primitive gallery and the error page exist only on the development
// server, so e2e/gallery.spec.ts runs against one beside the production build.
const developmentPort = 3101;
const gallery = /gallery\.spec\.ts$/;
// The servers under test get the fake values of .env.example unless the
// environment sets real ones. None of them is a secret, and no test reaches
// Supabase or Resend.
const environment = {
  NEXT_PUBLIC_SUPABASE_URL: process.env["NEXT_PUBLIC_SUPABASE_URL"] ?? "http://127.0.0.1:54321",
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:
    process.env["NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"] ?? "sb_publishable_example",
  RESEND_API_KEY: process.env["RESEND_API_KEY"] ?? "re_example_not_a_real_key",
};

export default defineConfig({
  testDir: "./e2e",
  forbidOnly: !!process.env["CI"],
  reporter: process.env["CI"] ? [["list"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: `http://127.0.0.1:${port}`,
    trace: "retain-on-failure",
  },
  projects: [
    { name: "chromium", testIgnore: gallery, use: { ...devices["Desktop Chrome"] } },
    { name: "firefox", testIgnore: gallery, use: { ...devices["Desktop Firefox"] } },
    { name: "webkit", testIgnore: gallery, use: { ...devices["Desktop Safari"] } },
    {
      name: "gallery",
      testMatch: gallery,
      use: { ...devices["Desktop Chrome"], baseURL: `http://127.0.0.1:${developmentPort}` },
    },
  ],
  // In order: the production build must finish before the development server
  // starts writing beside it.
  webServer: [
    {
      command: `pnpm build && pnpm start --hostname 127.0.0.1 --port ${port}`,
      // Readiness by port: the site has no page at "/" until WP-5.1, and
      // Playwright does not count a 404 there as ready.
      port,
      env: environment,
      reuseExistingServer: !process.env["CI"],
    },
    {
      command: `pnpm dev --hostname 127.0.0.1 --port ${developmentPort}`,
      url: `http://127.0.0.1:${developmentPort}/dev/primitives`,
      env: environment,
      reuseExistingServer: !process.env["CI"],
    },
  ],
});
