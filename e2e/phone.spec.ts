import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { gallery } from "../src/messages/gallery";
import { errorPage, notFound } from "../src/messages/system";
import { saveScreen } from "./screens";

// The primitive gallery, the not-found page and the browser error page on an
// emulated phone: the `phone`, `phone-375` and `phone-360` projects, Pixel 7
// at 412, 375 and 360 px, with touch and the phone's pixel density (WP-1.4
// design review 2, MINOR 9; WP-7.3). Runs against the development server.

const TARGET = 44;

const width = (page: Page) => page.viewportSize()?.width ?? 0;

test("[NFR-A11Y-05] [NFR-A11Y-02] the gallery fits the phone and has no axe violation", async ({
  page,
}) => {
  await page.goto("/dev/primitives");
  await expect(page.getByRole("heading", { level: 1, name: gallery.title })).toBeVisible();
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBe(0);
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await saveScreen(page, "phone-gallery", width(page));
});

test("[NFR-A11Y-06] every control can be tapped: at least 44 by 44 px", async ({ page }) => {
  await page.goto("/dev/primitives");
  const controls = page.locator("main :is(a[href], button, input, [role=tab], [role=button])");
  for (const control of await controls.all()) {
    // WCAG 2.5.8 exempts a link inside a sentence; its size is the text's.
    if (await control.evaluate((element) => element.closest("p") !== null)) continue;
    // A control with display: none has no box to tap. A box squashed to zero
    // is still drawn, so it is measured and fails.
    if (!(await control.evaluate((element) => element.checkVisibility()))) continue;
    const box = await control.boundingBox();
    const name = (await control.getAttribute("aria-label")) ?? (await control.textContent());
    expect(box?.width, `${name} width`).toBeGreaterThanOrEqual(TARGET);
    expect(box?.height, `${name} height`).toBeGreaterThanOrEqual(TARGET);
  }
});

test("[NFR-A11Y-06] the dialog's buttons can be tapped: at least 44 by 44 px", async ({ page }) => {
  await page.goto("/dev/primitives");
  await page.getByRole("button", { name: gallery.openDialog }).click();
  const dialog = page.getByRole("dialog", { name: gallery.dialogTitle });
  await expect(dialog).toBeVisible();
  const buttons = await dialog.getByRole("button").all();
  expect(buttons.length).toBeGreaterThan(0);
  for (const button of buttons) {
    const box = await button.boundingBox();
    const name = await button.textContent();
    expect(box?.width, `${name} width`).toBeGreaterThanOrEqual(TARGET);
    expect(box?.height, `${name} height`).toBeGreaterThanOrEqual(TARGET);
  }
});

test("[NFR-A11Y-05] the full-width button spans the content column", async ({ page }) => {
  await page.goto("/dev/primitives");
  const fullWidth = page.locator("#buttons button.w-full");
  await expect(fullWidth).toHaveText(gallery.check);
  const box = await fullWidth.boundingBox();
  const column = await page.locator("#buttons").boundingBox();
  expect(box?.width).toBeCloseTo(column?.width ?? 0, 0);
});

test("[FR-SYS-01] [NFR-A11Y-02] the not-found page fits the phone and has no axe violation", async ({
  page,
}) => {
  await page.goto("/no-such-page");
  await expect(page.getByRole("heading", { level: 1, name: notFound.heading })).toBeVisible();
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBe(0);
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await saveScreen(page, "phone-not-found", width(page));
});

test("[FR-SYS-01] [NFR-A11Y-02] a browser error's reference fits the phone and has no axe violation", async ({
  page,
}) => {
  const stored = page.waitForResponse("**/api/client-error");
  await page.goto("/dev/client-error");
  const reference = (await stored).headers()["x-request-id"] ?? "";
  await expect(page.getByRole("heading", { level: 1, name: errorPage.heading })).toBeVisible();
  await page.evaluate(() => {
    document.querySelectorAll("nextjs-portal").forEach((element) => {
      element.remove();
    });
  });
  await expect(page.locator("code")).toHaveText(reference);
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBe(0);
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await saveScreen(page, "phone-error-browser", width(page), { folder: "WP-7.3" });
});
