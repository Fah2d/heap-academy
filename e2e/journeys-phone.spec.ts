import { test } from "@playwright/test";
import { completeALesson, programThatAsksForInput, runawayCode, videoToFirstRun } from "./journeys";

// WP-7.4: journeys J-1 to J-4 on an emulated phone, by touch: the `phone`,
// `phone-375` and `phone-360` projects (Pixel 7 at 412, 375 and 360 px).
// J-1 at 320 px is in e2e/workspace-phone.spec.ts. Runs against the
// development server.
test.describe.configure({ timeout: 120_000 });

const device = { phone: true };

test("[NFR-COMPAT-03] [FR-WSP-13] J-1 on a phone: read, write before Python is ready, run", async ({
  page,
}) => {
  await videoToFirstRun(page, device);
});

test("[NFR-COMPAT-03] [FR-WSP-05] [FR-WSP-06] J-2 on a phone: fail, fix, pass, completion, next", async ({
  page,
}) => {
  await completeALesson(page, device);
});

test("[NFR-COMPAT-03] [FR-WSP-08] J-3 on a phone: a program that asks for input twice", async ({
  page,
}) => {
  await programThatAsksForInput(page, device);
});

test("[NFR-COMPAT-03] [FR-WSP-07] J-4 on a phone: Stop ends a runaway loop and the next Run works", async ({
  page,
}) => {
  await runawayCode(page, device);
});
