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

test("[FR-AUTH-01] [FR-AUTH-02] offers Google and the email code, and is not indexed", async ({
  page,
}) => {
  await page.goto("/sign-in");
  await expect(page.getByRole("heading", { level: 1, name: signIn.title })).toBeVisible();
  await expect(page.getByRole("button", { name: signIn.google })).toBeVisible();
  await expect(page.getByRole("textbox", { name: signIn.emailLabel })).toBeVisible();
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
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
