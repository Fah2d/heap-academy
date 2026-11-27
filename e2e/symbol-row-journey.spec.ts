import { devices, expect, test, type Page } from "@playwright/test";
import { symbolRow, workspace as words } from "../src/messages/workspace";
import { noAxeViolations } from "./journeys";
import { saveScreen } from "./screens";

// WP-7.5, FR-WSP-21: on a phone, the Code view has a row of the symbols that
// are slow to reach, above the keyboard. Each key goes in at the cursor and
// the editor keeps focus, so the on-screen keyboard stays open. At 768 px and
// wider there is no row. On the seed's published lesson, on the production
// build; runs in the `stack` project with a Pixel 7's touch and density.

const LESSON = "/learn/sample-course/say-hello-by-name";
const WORK_PACKAGE = "WP-7.5";
const pixel7 = devices["Pixel 7"];

const editor = (page: Page) => page.locator(".cm-content");
const row = (page: Page) => page.getByRole("group", { name: symbolRow.label });
const key = (page: Page, name: string) => row(page).getByRole("button", { name });
const view = (page: Page, name: string) =>
  page.getByRole("tablist", { name: words.views }).getByRole("tab", { name });

for (const width of [320, 375]) {
  test.describe(`on a phone, ${String(width)} px`, () => {
    test.use({
      viewport: { width, height: 740 },
      userAgent: pixel7.userAgent,
      deviceScaleFactor: pixel7.deviceScaleFactor,
      isMobile: pixel7.isMobile,
      hasTouch: pixel7.hasTouch,
    });

    test(`[FR-WSP-21] at ${String(width)} px each key goes in at the cursor and the editor keeps focus`, async ({
      page,
    }) => {
      await page.goto(LESSON);
      await expect(row(page)).toHaveCount(0);
      await view(page, words.viewCode).tap();
      await expect(row(page)).toBeVisible();
      await expect(row(page).getByRole("button")).toHaveCount(symbolRow.keys.length);

      // Replace the starter with one line, the cursor at its end.
      await editor(page).tap();
      await page.keyboard.press("ControlOrMeta+A");
      await page.keyboard.press("Delete");
      await page.keyboard.insertText("print");
      for (const name of [
        "Opening bracket",
        "Double quote",
        "Hash",
        "Double quote",
        "Closing bracket",
      ]) {
        await key(page, name).tap();
        // Focus never left the editor, so a phone's keyboard stays open.
        expect(
          await page.evaluate(() => document.activeElement?.closest(".cm-editor") !== null),
        ).toBe(true);
      }
      await page.keyboard.press("Enter");
      await key(page, "Tab").tap();
      await page.keyboard.insertText("x");
      await key(page, "Equals sign").tap();
      await expect(editor(page)).toHaveText('print("#")    x=');

      // The row scrolls inside itself; the page never scrolls sideways.
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      expect(overflow).toBeLessThanOrEqual(0);
      await noAxeViolations(page);
      // The screen shows the row from its first key.
      await row(page).evaluate((element) => {
        element.scrollLeft = 0;
      });
      await saveScreen(page, "symbol-row", width, { workPackage: WORK_PACKAGE, fullPage: false });

      // With an on-screen keyboard (about 300 px), the bar rides on it and
      // the editor keeps room above. Set as the workspace sets it from the
      // visual viewport, which an emulated phone has no keyboard to change.
      await page.locator("[data-workspace]").evaluate((element) => {
        (element as HTMLElement).style.setProperty("--keyboard-inset", "300px");
      });
      await expect(row(page)).toBeInViewport();
      await expect(editor(page)).toBeInViewport();
      await saveScreen(page, "symbol-row-keyboard", width, {
        workPackage: WORK_PACKAGE,
        fullPage: false,
      });
    });
  });
}

test.describe("at 768 px", () => {
  test.use({ viewport: { width: 768, height: 900 } });

  test("[FR-WSP-21] there is no symbol row", async ({ page }) => {
    await page.goto(LESSON);
    await expect(editor(page)).toBeVisible();
    await expect(row(page)).toHaveCount(0);
  });
});
