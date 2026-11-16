import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { errorPage } from "../src/messages/system";
import { gallery } from "../src/messages/gallery";
import { saveScreen } from "./screens";

// The development-only primitive gallery and error page (WP-1.4). This file
// runs against the development server: the production build has neither page.

// 320 px is the narrowest width NFR-A11Y-05 names; the rest are the screenshot widths.
const WIDTHS = [320, 375, 768, 1280];
const TARGET = 44;

// The overlay the development server draws over a page that threw. It is not
// part of the product, so it is removed before the page is checked.
async function hideDevelopmentOverlay(page: Page) {
  await page.evaluate(() => {
    document.querySelectorAll("nextjs-portal").forEach((element) => {
      element.remove();
    });
  });
}

async function openDialog(page: Page) {
  await page.getByRole("button", { name: gallery.openDialog }).click();
  await expect(page.getByRole("dialog", { name: gallery.dialogTitle })).toBeVisible();
}

for (const width of WIDTHS) {
  test.describe(`at ${width} px`, () => {
    test.beforeEach(async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
    });

    test("[NFR-A11Y-02] the gallery has no axe violation", async ({ page }) => {
      await page.goto("/dev/primitives");
      expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
      await saveScreen(page, "gallery", width);
    });

    test("[NFR-A11Y-02] the gallery with the dialog open has no axe violation", async ({
      page,
    }) => {
      await page.goto("/dev/primitives");
      await openDialog(page);
      expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
      await saveScreen(page, "gallery-dialog", width);
    });

    test("[NFR-A11Y-06] every control is at least 44 by 44 px", async ({ page }) => {
      await page.goto("/dev/primitives");
      const controls = page.locator("main :is(a[href], button, input, [role=tab], [role=button])");
      for (const control of await controls.all()) {
        // WCAG 2.5.8 exempts a link inside a sentence; its size is the text's.
        if (await control.evaluate((element) => element.closest("p") !== null)) continue;
        const box = await control.boundingBox();
        const name = (await control.getAttribute("aria-label")) ?? (await control.textContent());
        expect(box?.width, `${name} width`).toBeGreaterThanOrEqual(TARGET);
        expect(box?.height, `${name} height`).toBeGreaterThanOrEqual(TARGET);
      }
    });

    test("[NFR-A11Y-05] the gallery does not scroll sideways", async ({ page }) => {
      await page.goto("/dev/primitives");
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      expect(overflow).toBe(0);
    });

    test("[FR-SYS-01] [NFR-A11Y-02] the error page offers a retry and has no axe violation", async ({
      page,
    }) => {
      await page.goto("/dev/error");
      await expect(page.getByRole("heading", { level: 1, name: errorPage.heading })).toBeVisible();
      await hideDevelopmentOverlay(page);
      await expect(page.getByRole("button", { name: errorPage.retry })).toBeVisible();
      expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
      await saveScreen(page, "error", width);
    });
  });
}

test.describe("motion", () => {
  async function buttonTransition(page: Page) {
    await page.goto("/dev/primitives");
    return page
      .getByRole("button", { name: gallery.openDialog })
      .evaluate((element) => getComputedStyle(element).transitionDuration);
  }

  test("[NFR-A11Y-08] controls change state with a short transition by default", async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: "no-preference" });
    expect(await buttonTransition(page)).not.toBe("0s");
  });

  test("[NFR-A11Y-08] every transition stops under reduced motion", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    expect(await buttonTransition(page)).toBe("0s");
    const moving = await page.evaluate(
      () =>
        [...document.querySelectorAll("*")].filter((element) => {
          const style = getComputedStyle(element);
          return style.transitionDuration
            .split(",")
            .concat(style.animationDuration.split(","))
            .some((duration) => Number.parseFloat(duration) > 0);
        }).length,
    );
    expect(moving).toBe(0);
  });
});
