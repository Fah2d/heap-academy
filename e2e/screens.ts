import { join } from "node:path";
import { test, type Page } from "@playwright/test";

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
]);

// A state with a fixed overlay, such as an open dialog, is saved at the size
// of the viewport: a full-page capture paints the overlay as a band across it.
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
  }: { fullPage?: boolean; workPackage?: string } = {},
): Promise<void> {
  if (!savesScreens(test.info().project.name)) return;
  // The development server's indicator and overlay are not part of the
  // product, and the indicator covers content in the corner it sits in.
  await page.evaluate(() => {
    document.querySelectorAll("nextjs-portal").forEach((element) => {
      element.remove();
    });
  });
  await page.screenshot({
    path: join("docs", "reports", "screens", workPackage, `${name}-${width}.png`),
    fullPage,
  });
}
