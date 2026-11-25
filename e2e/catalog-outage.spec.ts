import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { errorPage } from "../src/messages/system";
import { saveScreen } from "./screens";

// The catalog's "Could not load" state (docs/spec/03-experience.md section 8;
// WP-5.1 decision 9): when the published courses cannot be read, each public
// page answers 500 and the browser draws the shared error page. These tests
// run against the production build served a second time with a database
// address where nothing listens (playwright.config.ts, `outagePort`), so every
// read fails here and in CI, where the local stack is running. The content
// cache is keyed by the database address, so answers the other server cached
// from the stack never answer here. Each page takes about 14 s: the database
// library tries a refused read three more times, after 1, 2 and 4 s, and a
// failed view reads twice (WP-5.1 decision 9).
// The port must match `outagePort` in playwright.config.ts.
test.use({ baseURL: "http://127.0.0.1:3102" });

// 320 px is the narrowest width NFR-A11Y-05 names; the rest are the screenshot widths.
const WIDTHS = [320, 375, 768, 1280];

const PAGES = [
  { path: "/", name: "home", offersHome: false },
  { path: "/courses", name: "courses", offersHome: true },
  { path: "/courses/python-basics", name: "course", offersHome: true },
];

for (const { path, name, offersHome } of PAGES) {
  test(`[FR-SYS-01] [NFR-A11Y-02] [NFR-A11Y-05] ${path} shows the error page when the courses cannot be read`, async ({
    page,
  }) => {
    const response = await page.goto(path);
    expect(response?.status()).toBe(500);
    await expect(page.getByRole("heading", { level: 1, name: errorPage.heading })).toBeVisible();
    await expect(page.getByRole("button", { name: errorPage.retry })).toBeVisible();
    // On the home page, a link home would lead back to the page that failed.
    await expect(page.getByRole("link", { name: errorPage.homeLink })).toHaveCount(
      offersHome ? 1 : 0,
    );
    await expect(page).toHaveTitle(new RegExp(errorPage.title));

    for (const width of WIDTHS) {
      await page.setViewportSize({ width, height: 900 });
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      expect(overflow).toBe(0);
      expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
      if (width !== 320) {
        await saveScreen(page, `catalog-error-${name}`, width, { workPackage: "WP-5.1" });
      }
    }
  });
}
