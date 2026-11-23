import { defineConfig, devices } from "@playwright/test";

// Journeys J-1 to J-13 live in e2e/, one file per journey, with axe on every
// screen (docs/spec/05-engineering-handbook.md section 8). Chromium runs on
// every pull request; Firefox and WebKit on main and before launch.
const port = 3100;
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
const phone = /phone\.spec\.ts$/;
const notDesktop = [gallery, phone, stack, runtime];

const engines = [
  ["chromium", devices["Desktop Chrome"]],
  ["firefox", devices["Desktop Firefox"]],
  ["webkit", devices["Desktop Safari"]],
] as const;
// The servers under test get the fake values of .env.example unless the
// environment sets real ones. None of them is a secret, and no test reaches
// Supabase or Resend.
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
      url: `http://127.0.0.1:${developmentPort}/dev/runtime`,
      env: environment,
      reuseExistingServer: !process.env["CI"],
      timeout: 180_000,
    },
  ],
});
