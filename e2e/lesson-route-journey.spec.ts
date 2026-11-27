import { devices, expect, test } from "@playwright/test";
import { EXAMPLE_LESSON } from "../src/grader/example-lesson";
import { catalogCommon } from "../src/messages/catalog";
import { shell } from "../src/messages/shell";
import { workspace } from "../src/messages/workspace";
import {
  completeALesson,
  programThatAsksForInput,
  runawayCode,
  type Target,
  videoToFirstRun,
} from "./journeys";
import { ON_SITE_MS, stackCourse } from "./stack-course";

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

// The course list is cached, so a new course reaches the site up to about
// 75 s later; every test here opens it at once (stack-course.ts).
test.beforeAll(async ({ request }) => {
  test.setTimeout(ON_SITE_MS + 15_000);
  course.write();
  await course.onSite(request);
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

// The workspace's compact bar holds the way back and the lesson's title
// (docs/spec/03-experience.md section 4). A move to another page inside the
// app brings back the site's bar, and Back brings back the lesson's (WP-8.2).
test("[FR-WSP-08] the lesson's bar gives way to the site's bar on the next page, and back", async ({
  page,
}) => {
  const banner = page.getByRole("banner");
  const siteBar = async () => {
    await expect(banner.getByRole("link", { name: shell.productName })).toBeVisible();
    await expect(banner.getByRole("link", { name: catalogCommon.coursesLink })).toBeVisible();
    await expect(banner.getByRole("heading")).toHaveCount(0);
  };
  const lessonBar = async () => {
    await expect(banner.getByRole("heading", { level: 1 })).toHaveText(EXAMPLE_LESSON.title);
    await expect(banner.getByRole("link", { name: shell.productName })).toHaveCount(0);
  };

  await page.goto(firstLesson.address);
  await lessonBar();
  await banner.getByRole("link", { name: workspace.backToCourse(course.title) }).click();
  await expect(page).toHaveURL(new RegExp(`/courses/${course.slug}$`));
  await siteBar();
  await page.goBack();
  await lessonBar();
  await page.getByRole("contentinfo").getByRole("link", { name: shell.footer.privacy }).click();
  await expect(page).toHaveURL(/\/privacy$/);
  await siteBar();
});
