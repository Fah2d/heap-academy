import { expect, test } from "@playwright/test";
import { ADMIN_STATE_PATH, ADMIN_STATES } from "../src/features/admin/components/admin-states";
import { expectEveryControlReached } from "./keyboard";

// WP-7.2: the keyboard walkthrough (NFR-A11Y-03) of the catalog's states and
// every admin state, on their development-only pages. Tab reaches each
// control once, in document order (the reading order of
// docs/spec/03-experience.md), each with its focus ring, and focus is never
// lost. Runs in the `gallery` project, against the development server. The
// sign-in and not-found pages are walked on the production build, in
// e2e/sign-in.spec.ts and e2e/shell.spec.ts.

const PAGES = [
  { name: "the catalog gallery", path: "/dev/catalog" },
  { name: "the home page with no course", path: "/dev/catalog?state=home-empty" },
  { name: "the empty course list", path: "/dev/catalog?state=list-empty" },
  { name: "the course list", path: "/dev/catalog?state=list-rows" },
  { name: "the course page", path: "/dev/catalog?state=course" },
];

for (const { name, path } of PAGES) {
  for (const width of [375, 1280]) {
    test(`[NFR-A11Y-03] the keyboard reaches every control on ${name}, in order, at ${String(width)} px`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.goto(path);
      await expectEveryControlReached(page);
    });
  }
}

for (const { state, title } of ADMIN_STATES) {
  test(`[NFR-A11Y-03] the keyboard reaches every control in the admin state "${state}", in order, at 1280 px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto(`${ADMIN_STATE_PATH}?state=${state}`);
    await expect(page.getByRole("region", { name: title })).toBeVisible();
    await expectEveryControlReached(page);
  });
}
