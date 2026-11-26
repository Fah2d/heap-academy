import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { errorPage } from "../src/messages/system";
import { gallery } from "../src/messages/gallery";
import { saveScreen } from "./screens";

// The development-only primitive gallery and error pages (WP-1.4, WP-7.3).
// This file runs against the development server: the production build has
// none of these pages.

// 320 px is the narrowest width NFR-A11Y-05 names; the rest are the screenshot widths.
const WIDTHS = [320, 375, 768, 1280];
const TARGET = 44;
const REQUEST_ID = /^[A-Za-z0-9_-]{8,64}$/;

const sidewaysScroll = (page: Page) =>
  page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);

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
      await saveScreen(page, "gallery-dialog", width, { fullPage: false });
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

    test("[FR-SYS-01] [NFR-OBS-01] [NFR-A11Y-02] a browser error shows the report's reference and has no axe violation", async ({
      page,
    }) => {
      const stored = page.waitForResponse("**/api/client-error");
      await page.goto("/dev/client-error");
      const reference = (await stored).headers()["x-request-id"] ?? "";
      expect(reference).toMatch(REQUEST_ID);
      await expect(page.getByRole("heading", { level: 1, name: errorPage.heading })).toBeVisible();
      await hideDevelopmentOverlay(page);
      await expect(page.locator("code")).toHaveText(reference);
      await expect(page.getByText(errorPage.referenceHint)).toBeVisible();
      expect(await sidewaysScroll(page)).toBe(0);
      expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
      await saveScreen(page, "error-browser", width, { workPackage: "WP-7.3" });
    });

    test("[FR-SYS-01] [NFR-A11Y-02] a browser error whose report failed shows no reference", async ({
      page,
    }) => {
      await page.route("**/api/client-error", (route) => route.fulfill({ status: 503 }));
      const refused = page.waitForResponse("**/api/client-error");
      await page.goto("/dev/client-error");
      expect((await refused).status()).toBe(503);
      await expect(page.getByRole("heading", { level: 1, name: errorPage.heading })).toBeVisible();
      await hideDevelopmentOverlay(page);
      await expect(page.getByRole("button", { name: errorPage.retry })).toBeVisible();
      await expect(page.getByText(errorPage.referenceLabel, { exact: false })).toHaveCount(0);
      await expect(page.getByText(errorPage.referenceHint)).toHaveCount(0);
      expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
      await saveScreen(page, "error-browser-unreported", width, { workPackage: "WP-7.3" });
    });
  });
}

// Tailwind orders utilities in the stylesheet, not in the class attribute, so
// only the computed style shows which of two classes for one property won.
test("[ADR-0014] the current navigation link shows the text color and the amber marker", async ({
  page,
}) => {
  await page.goto("/dev/primitives");
  const navigation = page.getByRole("navigation", { name: gallery.navLabel });
  const style = (name: string) =>
    navigation.getByRole("link", { name, exact: true }).evaluate((element) => {
      const computed = getComputedStyle(element);
      return {
        color: computed.color,
        marker: computed.borderBlockEndColor,
        markerWidth: computed.borderBlockEndWidth,
        weight: computed.fontWeight,
      };
    });
  // The token values, resolved by the browser the same way.
  const token = (name: string) =>
    page.evaluate((property) => {
      const probe = document.createElement("span");
      probe.style.color = `var(${property})`;
      document.body.append(probe);
      const value = getComputedStyle(probe).color;
      probe.remove();
      return value;
    }, name);

  const current = await style(gallery.navCurrent);
  const other = await style(gallery.navOther);
  // DESIGN.md 4.2: the text color, weight 600, and a 2 px amber bar. The
  // weight is the cue that is not color. The resting link keeps a transparent
  // bar of the same width, so becoming current shifts nothing.
  expect(current).toEqual({
    color: await token("--color-text"),
    marker: await token("--color-action"),
    markerWidth: "2px",
    weight: "600",
  });
  expect(other.color).toBe(await token("--color-text-muted"));
  expect(other.marker).toBe("rgba(0, 0, 0, 0)");
  expect(other.markerWidth).toBe("2px");
});

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
