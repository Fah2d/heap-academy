import { join } from "node:path";
import { test, type Locator, type Page } from "@playwright/test";

// Every state the axe checks pass through is also saved as a screenshot, so the
// design review looks at what was measured (docs/spec/05-engineering-handbook.md
// section 3.3). The folder is the work package that last changed the screen.
const DEFAULT_PACKAGE = "WP-1.4";
// One engine's pictures, so Firefox and WebKit runs do not overwrite them.
// `stack` runs the journeys against the local stack in Desktop Chrome too.
const SCREENSHOT_PROJECTS = new Set([
  "chromium",
  "gallery",
  "stack",
  "phone",
  "phone-375",
  "phone-360",
  "phone-workspace",
  "runtime-chromium",
]);

/** Whether a project saves the review screens; the others leave them as committed. */
export function savesScreens(project: string): boolean {
  return SCREENSHOT_PROJECTS.has(project);
}

export async function saveScreen(
  page: Page,
  name: string,
  width: number,
  {
    fullPage = true,
    workPackage = DEFAULT_PACKAGE,
    clip,
    element,
  }: {
    fullPage?: boolean;
    workPackage?: string;
    /** Only this part of the viewport, such as the area above an on-screen keyboard. */
    clip?: { x: number; y: number; width: number; height: number };
    /**
     * Only this element, such as one example of a gallery page that holds
     * many: a whole-page capture of such a page is too tall to judge.
     */
    element?: Locator;
  } = {},
): Promise<void> {
  if (!savesScreens(test.info().project.name)) return;
  // The development server's indicator and overlay are not part of the
  // product, and the indicator covers content in the corner it sits in.
  await page.evaluate(() => {
    document.querySelectorAll("nextjs-portal").forEach((element) => {
      element.remove();
    });
  });
  const path = join("docs", "reports", "screens", workPackage, `${name}-${width}.png`);
  if (element !== undefined) {
    await element.screenshot({ path });
    return;
  }
  // A page with a fixed bar, such as the workspace's action bar on a phone,
  // or an open dialog's backdrop, is saved at the window's size: a
  // full-page capture paints the fixed element mid-page (WP-8.1 design
  // review, m12).
  const fixed = await page.evaluate(() =>
    [...document.body.querySelectorAll("*")].some((node) => {
      if (getComputedStyle(node).position !== "fixed") return false;
      const box = node.getBoundingClientRect();
      return box.width > 0 && box.height > 0;
    }),
  );
  await page.screenshot({
    path,
    ...(clip === undefined ? { fullPage: fullPage && !fixed } : { clip }),
  });
}
