import { test } from "@playwright/test";
import { completeALesson, programThatAsksForInput, runawayCode, videoToFirstRun } from "./journeys";

// WP-7.4: journeys J-1 to J-4 on a laptop and a wide screen, the ends of
// NFR-COMPAT-03's range above the phone layout (1024 px, the dashboard's
// floor, and 2560 px). Runs in the runtime-* projects, one per engine,
// against the development server. e2e/workspace-runtime.spec.ts walks the
// same states at 1280 px.
test.describe.configure({ timeout: 120_000 });

const device = { phone: false };

for (const width of [1024, 2560]) {
  test.describe(`at ${width} px`, () => {
    test.beforeEach(async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
    });

    test(`[NFR-COMPAT-03] [NFR-PERF-03] J-1 at ${width} px: read, write before Python is ready, run`, async ({
      page,
    }) => {
      await videoToFirstRun(page, device);
    });

    test(`[NFR-COMPAT-03] [FR-WSP-05] [FR-WSP-06] J-2 at ${width} px: fail, fix, pass, completion, next`, async ({
      page,
    }) => {
      await completeALesson(page, device);
    });

    test(`[NFR-COMPAT-03] [FR-WSP-08] J-3 at ${width} px: a program that asks for input twice`, async ({
      page,
    }) => {
      await programThatAsksForInput(page, device);
    });

    test(`[NFR-COMPAT-03] [FR-WSP-07] J-4 at ${width} px: Stop ends a runaway loop and the next Run works`, async ({
      page,
    }) => {
      await runawayCode(page, device);
    });
  });
}
