import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { account, signIn } from "../src/messages/sign-in";
import { saveScreen } from "./screens";

// The sign-in page on the production build, without the local stack: its
// states before any request reaches the auth service (WP-2.2). The journey
// that signs in for real is sign-in-journey.spec.ts.

const WIDTHS = [320, 375, 768, 1280];
const TARGET = 44;
const SCREENS = { workPackage: "WP-2.2" };
const INSTAGRAM =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Instagram 350.0.0.0.0";

test("[FR-AUTH-04] the header's sign-in link carries the page the visitor is on", async ({
  page,
}) => {
  await page.goto("/no-such-page");
  await expect(page.getByRole("link", { name: account.signIn })).toHaveAttribute(
    "href",
    "/sign-in?returnTo=%2Fno-such-page",
  );
});

test("[FR-AUTH-06] the header's sign-in link loads the page's own policy, so the bot challenge runs", async ({
  page,
}) => {
  // A client-side navigation would keep the not-found page's policy, which
  // does not let the challenge frame load, and no token would arrive.
  await page.goto("/no-such-page");
  await page.getByRole("link", { name: account.signIn }).click();
  await expect(page).toHaveURL(/\/sign-in\?returnTo=%2Fno-such-page$/);
  // Turnstile loads from Cloudflare: the same limit as the stack journey's.
  await expect(page.locator('input[name="cf-turnstile-response"]')).toHaveValue(/.+/, {
    timeout: 15_000,
  });
});

test("[FR-AUTH-01] [FR-AUTH-02] offers Google and the email code, and is not indexed", async ({
  page,
}) => {
  await page.goto("/sign-in");
  await expect(page.getByRole("heading", { level: 1, name: signIn.title })).toBeVisible();
  await expect(page.getByRole("button", { name: signIn.google })).toBeVisible();
  await expect(page.getByRole("textbox", { name: signIn.emailLabel })).toBeVisible();
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
});

test("[T-11] a server action posted from another site is refused", async ({ request }) => {
  // Next.js compares a server action's Origin with the host; a forged
  // cross-site form post cannot carry this site's origin.
  const response = await request.post("/sign-in", {
    headers: { origin: "https://evil.example", "next-action": "0".repeat(40) },
    data: "[]",
  });
  expect(response.status()).toBeGreaterThanOrEqual(400);
});

test("[FR-AUTH-01] [T-11] a callback without this browser's PKCE verifier goes back to sign-in", async ({
  request,
}) => {
  const response = await request.get("/auth/callback?code=forced-from-another-account", {
    maxRedirects: 0,
  });
  expect(response.status()).toBe(303);
  expect(response.headers()["location"]).toMatch(/\/sign-in\?failed=google/);
});

test("[FR-AUTH-01] says when Google sign-in did not finish", async ({ page }) => {
  await page.goto("/sign-in?failed=google&returnTo=%2Fcourses");
  await expect(page.getByText(signIn.googleFailed)).toBeVisible();
});

test.describe("in an in-app browser", () => {
  test.use({ userAgent: INSTAGRAM });

  test("[FR-AUTH-03] leads with the email code, says why, and can show Google", async ({
    page,
  }) => {
    await page.goto("/sign-in");
    await expect(page.getByText(signIn.inAppBrowser)).toBeVisible();
    await expect(page.getByRole("button", { name: signIn.google })).toHaveCount(0);
    await page.getByRole("button", { name: signIn.showGoogle }).click();
    await expect(page.getByRole("button", { name: signIn.google })).toBeVisible();
  });
});

for (const width of WIDTHS) {
  test(`[NFR-A11Y-02] the sign-in page has no axe violation at ${width} px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/sign-in");
    const results = await new AxeBuilder({ page }).analyze();
    expect(results.violations).toEqual([]);
    await saveScreen(page, "sign-in", width, SCREENS);
  });

  test(`[NFR-A11Y-06] every control on the sign-in page is at least 44 px tall at ${width} px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/sign-in");
    const controls = page.locator("main").locator("button, a[href], input:not([type=hidden])");
    for (const control of await controls.all()) {
      const box = await control.boundingBox();
      expect(box?.height ?? 0).toBeGreaterThanOrEqual(TARGET);
    }
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
    );
    expect(overflow).toBe(false);
  });
}

// The other states that need no auth service: each is checked with axe and
// saved for the design review.
const STATES = [
  { name: "sign-in-google-failed", path: "/sign-in?failed=google", userAgent: undefined },
  { name: "sign-in-in-app-browser", path: "/sign-in", userAgent: INSTAGRAM },
] as const;

for (const state of STATES) {
  for (const width of [375, 1280]) {
    test(`[NFR-A11Y-02] ${state.name} has no axe violation at ${width} px`, async ({ browser }) => {
      const context = await browser.newContext({
        viewport: { width, height: 900 },
        ...(state.userAgent !== undefined && { userAgent: state.userAgent }),
      });
      const page = await context.newPage();
      await page.goto(state.path);
      const results = await new AxeBuilder({ page }).analyze();
      expect(results.violations).toEqual([]);
      await saveScreen(page, state.name, width, SCREENS);
      await context.close();
    });
  }
}
