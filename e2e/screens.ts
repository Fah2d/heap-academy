import { join } from "node:path";
import { test, type Page } from "@playwright/test";

// Every state the axe checks pass through is also saved as a screenshot, so the
// design review looks at what was measured (docs/spec/05-engineering-handbook.md
// section 3.3). The folder is the work package that last changed these screens.
const FOLDER = join("docs", "reports", "screens", "WP-1.4");
// One engine's pictures, so Firefox and WebKit runs do not overwrite them.
const SCREENSHOT_PROJECTS = new Set(["chromium", "gallery"]);

export async function saveScreen(page: Page, name: string, width: number): Promise<void> {
  if (!SCREENSHOT_PROJECTS.has(test.info().project.name)) return;
  await page.screenshot({ path: join(FOLDER, `${name}-${width}.png`), fullPage: true });
}
