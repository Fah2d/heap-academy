import { test } from "@playwright/test";
import {
  completeALesson,
  DEV_WORKSPACE,
  programThatAsksForInput,
  runawayCode,
  videoToFirstRun,
} from "./journeys";

// WP-7.4: journeys J-1 to J-4 above the phone layout: at 768 px, where it
// starts, at 1024 px, the dashboard's floor, and at 2560 px, the top of
// NFR-COMPAT-03's range. Runs in the runtime-* projects, one per engine,
// against the development server. e2e/workspace-runtime.spec.ts walks the
// same states at 1280 px.
test.describe.configure({ timeout: 120_000 });

const device = { phone: false };

for (const width of [768, 1024, 2560]) {
  test.describe(`at ${width} px`, () => {
    test.beforeEach(async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
    });

    test(`[NFR-COMPAT-01] [NFR-COMPAT-03] J-1 at ${width} px: read, write before Python is ready, run`, async ({
      page,
    }) => {
      await videoToFirstRun(page, device, DEV_WORKSPACE);
    });

    test(`[NFR-COMPAT-01] [NFR-COMPAT-03] J-2 at ${width} px: run, fail, fix, pass, completion, next`, async ({
      page,
    }) => {
      await completeALesson(page, device, DEV_WORKSPACE);
    });

    test(`[NFR-COMPAT-01] [NFR-COMPAT-03] J-3 at ${width} px: a program that asks for input twice`, async ({
      page,
    }) => {
      await programThatAsksForInput(page, device, DEV_WORKSPACE);
    });

    test(`[NFR-COMPAT-01] [NFR-COMPAT-03] J-4 at ${width} px: Stop ends a runaway loop and the next Run works`, async ({
      page,
    }) => {
      await runawayCode(page, device, DEV_WORKSPACE);
    });
  });
}
