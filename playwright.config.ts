import { defineConfig, devices } from "@playwright/test";

// Journeys J-1 to J-13 live in e2e/, with axe on every screen. J-1 to J-4
// are written once in e2e/journeys.ts and walked at phone and laptop sizes (docs/spec/05-engineering-handbook.md section 8). Chromium runs on
// every pull request; Firefox and WebKit on main and before launch.
const port = 3100;
// The same production build, served with a database address where nothing
// listens (port 1), so every content read fails: e2e/catalog-outage.spec.ts
// sees the catalog's "Could not load" state there, even when the local stack
// is running. e2e/catalog-outage.spec.ts names the same port.
const outagePort = 3102;
// The primitive gallery, the error page and the Python runtime page (WP-3.1)
// are not in the production build (the runtime page is also in Vercel
// preview builds, WP-3.4), so e2e/gallery.spec.ts and the runtime tests run
// against the development server beside it.
const developmentPort = 3101;
const gallery = /gallery\.spec\.ts$/;
// Journeys that need the local Supabase stack (`supabase start`) run in the
// `stack` project, which the `e2e` job runs after starting it.
const stack = /-journey\.spec\.ts$/;
const runtime = /runtime\.spec\.ts$/;
// The same development pages on an emulated phone: a mobile viewport, touch,
// and the phone's pixel density, not a resized desktop window.
const phone = /(?<!workspace-|journeys-)phone\.spec\.ts$/;
// The workspace on a phone (WP-5.3) and the journeys on a phone (WP-7.4) set
// their own widths, 320, 375 and 430 px, so they run once per engine on an
// emulated phone, not in each phone project.
const workspacePhone = /(workspace|journeys)-phone\.spec\.ts$/;
// The throttled load profile (WP-7.2) uses the Chrome DevTools Protocol, so
// it runs once, in Chromium, against the development server.
const loadProfile = /load-profile\.spec\.ts$/;
const notDesktop = [gallery, phone, workspacePhone, stack, runtime, loadProfile];

const engines = [
  ["chromium", devices["Desktop Chrome"]],
  ["firefox", devices["Desktop Firefox"]],
  ["webkit", devices["Desktop Safari"]],
] as const;
// The servers under test get the fake values of .env.example unless the
// environment sets real ones. Playwright also hands each server the whole of
// its own environment, so in CI's e2e job they get the local stack's secret
// key and the two notice addresses, and J-10 can delete an account; elsewhere
// those stay unset and the profile shows no delete control. Only the stack
// journeys reach the local Supabase, and only J-10's deletion notice reaches
// Resend, which refuses the fake key.
const environment = {
  NEXT_PUBLIC_SUPABASE_URL: process.env["NEXT_PUBLIC_SUPABASE_URL"] ?? "http://127.0.0.1:54321",
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:
    process.env["NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"] ?? "sb_publishable_example",
  NEXT_PUBLIC_TURNSTILE_SITE_KEY:
    process.env["NEXT_PUBLIC_TURNSTILE_SITE_KEY"] ?? "1x00000000000000000000AA",
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
    ...engines.map(([name, device]) => ({
      name,
      testIgnore: notDesktop,
      use: { ...device },
    })),
    { name: "stack", testMatch: stack, use: { ...devices["Desktop Chrome"] } },
    {
      name: "gallery",
      testMatch: gallery,
      use: { ...devices["Desktop Chrome"], baseURL: `http://127.0.0.1:${developmentPort}` },
    },
    // The runtime's "Done when" names all three engines (WP-3.1).
    ...engines.map(([name, device]) => ({
      name: `runtime-${name}`,
      testMatch: runtime,
      use: { ...device, baseURL: `http://127.0.0.1:${developmentPort}` },
    })),
    // Pixel 7 as it is (412 px), then at the 375 px review width and the
    // common 360 px Android width, with the same touch and pixel density.
    ...[undefined, 375, 360].map((width) => ({
      name: width === undefined ? "phone" : `phone-${width}`,
      testMatch: phone,
      use: {
        ...devices["Pixel 7"],
        ...(width !== undefined && { viewport: { width, height: 667 } }),
        baseURL: `http://127.0.0.1:${developmentPort}`,
      },
    })),
    {
      name: "phone-workspace",
      testMatch: workspacePhone,
      use: { ...devices["Pixel 7"], baseURL: `http://127.0.0.1:${developmentPort}` },
    },
    // The same on the other two engines (WP-7.4): Safari on an iPhone, and
    // Firefox at a phone's size with touch (Firefox has no mobile mode).
    {
      name: "phone-workspace-webkit",
      testMatch: workspacePhone,
      use: { ...devices["iPhone 13"], baseURL: `http://127.0.0.1:${developmentPort}` },
    },
    {
      name: "phone-workspace-firefox",
      testMatch: workspacePhone,
      use: {
        ...devices["Desktop Firefox"],
        viewport: { width: 390, height: 740 },
        hasTouch: true,
        baseURL: `http://127.0.0.1:${developmentPort}`,
      },
    },
    {
      name: "profile",
      testMatch: loadProfile,
      use: { ...devices["Desktop Chrome"], baseURL: `http://127.0.0.1:${developmentPort}` },
    },
  ],
  // In order: the production build must finish before the outage server
  // serves it and before the development server starts writing beside it.
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
      command: `pnpm start --hostname 127.0.0.1 --port ${outagePort}`,
      port: outagePort,
      env: { ...environment, NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:1" },
      reuseExistingServer: !process.env["CI"],
    },
    {
      command: `pnpm dev --hostname 127.0.0.1 --port ${developmentPort}`,
      url: `http://127.0.0.1:${developmentPort}/dev/runtime`,
      env: environment,
      reuseExistingServer: !process.env["CI"],
      timeout: 180_000,
    },
  ],
});
