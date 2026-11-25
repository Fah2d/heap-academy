import { test } from "@playwright/test";
import { completeALesson, programThatAsksForInput, runawayCode } from "./journeys";

// WP-7.4: journeys J-2 to J-4 on a phone, by touch, at the three widths
// FR-WSP-13 names, in the phone-workspace projects (an emulated Pixel 7, an
// iPhone in WebKit, and Firefox at a phone's size with touch). J-1 at the
// same widths, with the phone layout's own checks, is in
// e2e/workspace-phone.spec.ts. Runs against the development server.
test.describe.configure({ timeout: 120_000 });

const device = { phone: true };

for (const width of [320, 375, 430]) {
  test.describe(`at ${width} px`, () => {
    test.beforeEach(async ({ page }) => {
      await page.setViewportSize({ width, height: 740 });
    });

    test(`[NFR-COMPAT-01] [NFR-COMPAT-03] J-2 at ${width} px: run, fail, fix, pass, completion, next`, async ({
      page,
    }) => {
      await completeALesson(page, device);
    });

    test(`[NFR-COMPAT-01] [NFR-COMPAT-03] J-3 at ${width} px: a program that asks for input twice`, async ({
      page,
    }) => {
      await programThatAsksForInput(page, device);
    });

    test(`[NFR-COMPAT-01] [NFR-COMPAT-03] J-4 at ${width} px: Stop ends a runaway loop and the next Run works`, async ({
      page,
    }) => {
      await runawayCode(page, device);
    });
  });
}
