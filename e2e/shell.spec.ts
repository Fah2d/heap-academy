import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { notFound } from "../src/messages/system";
import { shell } from "../src/messages/shell";
import { saveScreen } from "./screens";

// The shell and the not-found page on the production build (WP-1.4).

// 320 px is the narrowest width NFR-A11Y-05 names; the rest are the screenshot widths.
const WIDTHS = [320, 375, 768, 1280];
const TARGET = 44;

test("[FR-SYS-01] an unknown address answers 404 with the not-found page", async ({ page }) => {
  const response = await page.goto("/no-such-page");
  expect(response?.status()).toBe(404);
  await expect(page.getByRole("heading", { level: 1, name: notFound.heading })).toBeVisible();
  await expect(page.getByRole("link", { name: notFound.homeLink })).toHaveAttribute("href", "/");
  await expect(page.getByRole("banner")).toBeVisible();
  await expect(page.getByRole("main")).toBeVisible();
});

test("[WP-1.4] the development-only pages are absent from the production build", async ({
  request,
}) => {
  for (const path of ["/dev/primitives", "/dev/error", "/dev/runtime"]) {
    const response = await request.get(path);
    expect(response.status(), path).toBe(404);
  }
});

test("[NFR-I18N-03] the document carries its language and direction", async ({ page }) => {
  await page.goto("/no-such-page");
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  await expect(page.locator("html")).toHaveAttribute("dir", "ltr");
});

test("[NFR-A11Y-03] the skip link is first and moves focus to the main landmark", async ({
  page,
}) => {
  await page.goto("/no-such-page");
  await page.keyboard.press("Tab");
  const skip = page.getByRole("link", { name: shell.skipLink });
  await expect(skip).toBeFocused();
  await expect(skip).toBeInViewport();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/#main$/);
  await page.keyboard.press("Tab");
  await expect(page.getByRole("link", { name: shell.productName })).not.toBeFocused();
});

for (const width of WIDTHS) {
  test(`[NFR-A11Y-02] the not-found page has no axe violation at ${width} px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/no-such-page");
    const results = await new AxeBuilder({ page }).analyze();
    expect(results.violations).toEqual([]);
    await saveScreen(page, "not-found", width);
  });

  test(`[NFR-A11Y-06] every control on the not-found page is at least 44 px at ${width} px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/no-such-page");
    // The skip link has a size only while it has focus.
    await page.keyboard.press("Tab");
    for (const control of await page.locator("a[href], button").all()) {
      if (!(await control.isVisible())) continue;
      if (
        (await control.getAttribute("href")) === "#main" &&
        !(await control.evaluate((element) => element === document.activeElement))
      ) {
        continue;
      }
      const box = await control.boundingBox();
      const name = await control.textContent();
      expect(box?.width, `${name} width`).toBeGreaterThanOrEqual(TARGET);
      expect(box?.height, `${name} height`).toBeGreaterThanOrEqual(TARGET);
    }
  });

  test(`[NFR-A11Y-05] the not-found page does not scroll sideways at ${width} px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/no-such-page");
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBe(0);
  });
}
