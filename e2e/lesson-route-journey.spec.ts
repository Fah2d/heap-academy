import { devices, test } from "@playwright/test";
import { EXAMPLE_LESSON } from "../src/grader/example-lesson";
import {
  completeALesson,
  programThatAsksForInput,
  runawayCode,
  type Target,
  videoToFirstRun,
} from "./journeys";
import { stackCourse } from "./stack-course";

// WP-7.4 part 2: journeys J-1 to J-4 as a guest on real lesson addresses, on
// the production build, read from the local stack through the public content
// client. e2e/journeys-phone.spec.ts and e2e/journeys-wide-runtime.spec.ts
// walk the same journeys on the development page /dev/workspace, which needs
// no database. Runs in the stack project, which is Chromium only for now.
//
// Each worker writes its own course with two published lessons
// (e2e/stack-course.ts). J-2 passes the first and follows Next to the second;
// on the second, the last, Next is shown disabled. The course is removed at
// the end.
test.describe.configure({ timeout: 120_000 });

const stamp = String(Date.now());
const course = stackCourse(
  `journeys-${stamp}`,
  `Journeys ${stamp}`,
  [
    { slug: "first", title: EXAMPLE_LESSON.title },
    { slug: "second", title: "Say hello again" },
  ],
  "A course made by the lesson route journey.",
);
const [firstLesson, lastLesson] = course.lessons as [Target, Target];

test.beforeAll(() => {
  course.write();
});

test.afterAll(() => {
  course.remove();
});

// A Pixel 7 at the 375 px review width, as the phone projects emulate it.
const pixel7 = devices["Pixel 7"];
const sizes = [
  {
    name: "a phone, 375 px",
    phone: true,
    use: {
      viewport: { width: 375, height: 740 },
      userAgent: pixel7.userAgent,
      deviceScaleFactor: pixel7.deviceScaleFactor,
      isMobile: pixel7.isMobile,
      hasTouch: pixel7.hasTouch,
    },
  },
  { name: "a laptop, 1280 px", phone: false, use: { viewport: { width: 1280, height: 800 } } },
] as const;

for (const { name, phone, use } of sizes) {
  test.describe(`on ${name}`, () => {
    test.use(use);
    const device = { phone };

    test(`[NFR-COMPAT-03] J-1 on ${name}: a guest reads the lesson, writes before Python is ready, runs`, async ({
      page,
    }) => {
      await videoToFirstRun(page, device, firstLesson);
    });

    test(`[NFR-COMPAT-03] [FR-WSP-11] J-2 on ${name}: run, fail, fix, pass, completion, Next to the second lesson`, async ({
      page,
    }) => {
      await completeALesson(page, device, firstLesson);
    });

    test(`[NFR-COMPAT-03] [FR-WSP-11] J-2 on ${name}: on the course's last lesson, Next is shown disabled`, async ({
      page,
    }) => {
      await completeALesson(page, device, lastLesson);
    });

    test(`[NFR-COMPAT-03] J-3 on ${name}: a program that asks for input twice`, async ({
      page,
    }) => {
      await programThatAsksForInput(page, device, firstLesson);
    });

    test(`[NFR-COMPAT-03] J-4 on ${name}: Stop ends a runaway loop and the next Run works`, async ({
      page,
    }) => {
      await runawayCode(page, device, firstLesson);
    });
  });
}
