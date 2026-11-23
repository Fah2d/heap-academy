import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { catalogCommon, courseList, coursePage, home } from "../src/messages/catalog";
import { catalogGallery } from "../src/messages/gallery";
import { saveScreen } from "./screens";

// The catalog's states that need an empty database or sample content
// (WP-5.1), on the development-only page /dev/catalog. Each state has its own
// address and is drawn alone as its whole page, so the axe check and the
// screen see that page and nothing else. Runs in the `gallery` project,
// against the development server. A read that fails ends on the shared error
// page, which e2e/gallery.spec.ts checks at /dev/error. The published pages
// themselves are in e2e/catalog-journey.spec.ts, against the local stack.

// 320 px is the narrowest width NFR-A11Y-05 names; the rest are the screenshot widths.
const WIDTHS = [320, 375, 768, 1280];

const STATES: { state: string; tags: string; check: (page: Page) => Promise<void> }[] = [
  {
    state: "home-empty",
    tags: "[FR-LND-02] [FR-CAT-04]",
    check: async (page) => {
      await expect(page.getByRole("heading", { level: 1, name: home.heading })).toBeVisible();
      await expect(page.getByText(courseList.empty)).toBeVisible();
      await expect(page.getByText(home.how)).toBeVisible();
      // An empty list draws no row.
      await expect(page.getByRole("main").getByRole("listitem")).toHaveCount(0);
    },
  },
  {
    state: "list-empty",
    tags: "[FR-CAT-04]",
    check: async (page) => {
      await expect(page.getByRole("heading", { level: 1, name: courseList.heading })).toBeVisible();
      await expect(page.getByText(courseList.empty)).toBeVisible();
      await expect(page.getByRole("main").getByRole("listitem")).toHaveCount(0);
    },
  },
  {
    state: "list-rows",
    tags: "[FR-CAT-01]",
    check: async (page) => {
      await expect(page.getByRole("link", { name: catalogGallery.longCourse })).toBeVisible();
      await expect(page.getByText(catalogCommon.lessonCount(3))).toBeVisible();
    },
  },
  {
    state: "course",
    tags: "[FR-CRS-01]",
    check: async (page) => {
      await expect(
        page.getByRole("heading", { level: 1, name: catalogGallery.sampleCourse }),
      ).toBeVisible();
      await expect(page.getByRole("heading", { name: coursePage.outcomesHeading })).toHaveCount(0);
      await expect(page.getByRole("list", { name: coursePage.chaptersHeading })).toBeVisible();
    },
  },
];

test("the catalog gallery lists every state", async ({ page }) => {
  await page.goto("/dev/catalog");
  await expect(page).toHaveTitle(new RegExp(catalogGallery.title));
  await expect(page.getByRole("heading", { level: 1, name: catalogGallery.title })).toBeVisible();
  await expect(page.getByRole("main").getByRole("listitem")).toHaveCount(STATES.length);
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
});

for (const { state, tags, check } of STATES) {
  for (const width of WIDTHS) {
    test(`${tags} [NFR-A11Y-05] the catalog state ${state} at ${String(width)} px`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.goto(`/dev/catalog?state=${state}`);
      await check(page);
      // The page alone: one main heading, no gallery text around it.
      await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
      await expect(page.getByText(catalogGallery.intro)).toHaveCount(0);

      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      expect(overflow).toBe(0);
      const axe = await new AxeBuilder({ page }).analyze();
      expect(axe.violations).toEqual([]);
      // An id named twice is reported as "incomplete", not as a violation.
      expect(axe.incomplete.filter((result) => result.id === "duplicate-id-aria")).toEqual([]);
      if (width !== 320) {
        await saveScreen(page, `catalog-${state}`, width, { workPackage: "WP-5.1" });
      }
    });
  }
}
