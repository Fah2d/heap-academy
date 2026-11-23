import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { courseList, coursePage, home } from "../src/messages/catalog";
import { catalogGallery } from "../src/messages/gallery";
import { saveScreen } from "./screens";

// The catalog's states that need an empty database or sample content
// (WP-5.1), on the development-only page /dev/catalog, each drawn as its whole
// page. Runs in the \`gallery\` project, against the development server. A read
// that fails ends on the shared error page, which e2e/gallery.spec.ts checks
// at /dev/error. The published pages themselves are in
// e2e/catalog-journey.spec.ts, against the local stack.

// 320 px is the narrowest width NFR-A11Y-05 names; the rest are the screenshot widths.
const WIDTHS = [320, 375, 768, 1280];

for (const width of WIDTHS) {
  test(`[FR-CAT-04] [FR-CRS-01] [NFR-A11Y-05] the catalog's empty states and sample pages at ${String(width)} px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/dev/catalog");
    await expect(page).toHaveTitle(new RegExp(catalogGallery.title));

    const region = (name: string) => page.getByRole("region", { name });
    const emptyHome = region(catalogGallery.homeEmpty);
    await expect(emptyHome.getByRole("heading", { level: 1, name: home.heading })).toBeVisible();
    await expect(emptyHome.getByText(courseList.empty)).toBeVisible();
    await expect(emptyHome.getByText(home.how)).toBeVisible();
    // An empty list draws no row.
    await expect(emptyHome.getByRole("listitem")).toHaveCount(0);
    const emptyList = region(catalogGallery.listEmpty);
    await expect(emptyList.getByText(courseList.empty)).toBeVisible();
    await expect(emptyList.getByRole("listitem")).toHaveCount(0);
    await expect(
      region(catalogGallery.listRows).getByRole("link", { name: catalogGallery.longCourse }),
    ).toBeVisible();
    await expect(
      region(catalogGallery.courseNoOutcomes).getByRole("heading", {
        name: coursePage.outcomesHeading,
      }),
    ).toHaveCount(0);

    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBe(0);
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
    if (width !== 320) await saveScreen(page, "catalog-states", width, { workPackage: "WP-5.1" });
  });
}
