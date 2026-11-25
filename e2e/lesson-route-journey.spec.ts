import { test } from "@playwright/test";
import {
  completeALesson,
  programThatAsksForInput,
  runawayCode,
  SEEDED_LESSON,
  videoToFirstRun,
} from "./journeys";

// WP-7.4 part 2: journeys J-1 to J-4 as a guest on a real lesson address,
// the seeded sample lesson read from the local stack through the public
// content client, on the production build. e2e/journeys-phone.spec.ts and
// e2e/journeys-wide-runtime.spec.ts walk the same journeys on the
// development page /dev/workspace, which needs no database. Runs in the
// stack project. The phone size is a 375 px window with touch, the review
// width, as phone-workspace-firefox does, so the same test also runs where
// an engine has no mobile mode.
test.describe.configure({ timeout: 120_000 });

const sizes = [
  { name: "a phone, 375 px", phone: true, viewport: { width: 375, height: 740 } },
  { name: "a laptop, 1280 px", phone: false, viewport: { width: 1280, height: 800 } },
] as const;

for (const { name, phone, viewport } of sizes) {
  test.describe(`on ${name}`, () => {
    test.use({ viewport, hasTouch: phone });
    const device = { phone };

    test(`[NFR-COMPAT-01] [NFR-COMPAT-03] J-1 on ${name}: a guest reads the lesson, writes before Python is ready, runs`, async ({
      page,
    }) => {
      await videoToFirstRun(page, device, SEEDED_LESSON);
    });

    test(`[NFR-COMPAT-01] [NFR-COMPAT-03] J-2 on ${name}: run, fail, fix, pass, completion, no Next after the last lesson`, async ({
      page,
    }) => {
      await completeALesson(page, device, SEEDED_LESSON);
    });

    test(`[NFR-COMPAT-01] [NFR-COMPAT-03] J-3 on ${name}: a program that asks for input twice`, async ({
      page,
    }) => {
      await programThatAsksForInput(page, device, SEEDED_LESSON);
    });

    test(`[NFR-COMPAT-01] [NFR-COMPAT-03] J-4 on ${name}: Stop ends a runaway loop and the next Run works`, async ({
      page,
    }) => {
      await runawayCode(page, device, SEEDED_LESSON);
    });
  });
}
