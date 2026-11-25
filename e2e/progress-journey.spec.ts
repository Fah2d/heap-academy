import {
  type APIRequestContext,
  type BrowserContext,
  devices,
  expect,
  type Page,
  test,
} from "@playwright/test";
import { EXAMPLE_LESSON } from "../src/grader/example-lesson";
import { catalogCommon, coursePage } from "../src/messages/catalog";
import { profile } from "../src/messages/profile";
import { account } from "../src/messages/sign-in";
import { sql, sqlRows } from "./admin-helpers";
import { noAxeViolations, passLesson, type Target } from "./journeys";
import { signInWithCode } from "./sign-in-helpers";
import { LESSON_XP, stackCourse } from "./stack-course";

// WP-7.4 part 2b: J-5 (save my progress) and J-6 (another device), in
// docs/spec/01-requirements.md section 2, on the production build against the
// local stack (the `stack` project). Three browser contexts stand for three
// devices, all signed in to one account by email code:
//
// 1. Device A, a laptop, signs in, passes the second lesson, which is stored
//    in the account, and signs out; its device progress is cleared at
//    sign-out.
// 2. Device B, a laptop, as a guest passes the first lesson, then signs in.
//    The device's completion joins the account's: two rows, nothing lost, and
//    the XP is the sum of the rows (FR-PRG-03).
// 3. Device C, a fresh phone browser, signs in and sees the same
//    completions, XP and streak as device B (J-6, FR-PRG-02).
//
// The provider sends at most one code a minute to one address
// (supabase/config.toml, max_frequency), so each sign-in after the first
// waits until the provider's own record of the last email is a minute old.
test.describe.configure({ timeout: 360_000 });

const stamp = String(Date.now());
const course = stackCourse(
  `progress-${stamp}`,
  `Progress ${stamp}`,
  [
    { slug: "first", title: EXAMPLE_LESSON.title },
    { slug: "second", title: "Say hello again" },
  ],
  "A course made by the progress journey.",
);
const [firstLesson, secondLesson] = course.lessons as [Target, Target];
const address = `progress-${stamp}@example.test`;
const XP = String(LESSON_XP);
const laptop = { phone: false };

// A Pixel 7 at the 375 px review width, as e2e/lesson-route-journey.spec.ts
// emulates it.
const pixel7 = devices["Pixel 7"];
const phone = {
  viewport: { width: 375, height: 740 },
  userAgent: pixel7.userAgent,
  deviceScaleFactor: pixel7.deviceScaleFactor,
  isMobile: pixel7.isMobile,
  hasTouch: pixel7.hasTouch,
};

const user = `(select id from auth.users where email = '${address}')`;

/** The account's completions of this course's lessons: slug and XP, in slug order. */
function accountCompletions(): string[][] {
  return sqlRows(`select lessons.slug, completions.xp
from public.completions
join public.lessons on lessons.id = completions.lesson_id
join public.courses on courses.id = lessons.course_id
where completions.user_id = ${user} and courses.slug = '${course.slug}'
order by lessons.slug;`);
}

/**
 * "t" once the provider would send this address another code: no account
 * yet, or its last code email (a confirmation for a new address, a magic
 * link after that) is more than a minute old.
 */
function codeAllowed(): string[][] {
  return sqlRows(`select coalesce((
  select now() - greatest(
    coalesce(confirmation_sent_at, '-infinity'),
    coalesce(recovery_sent_at, '-infinity')
  ) > interval '61 seconds'
  from auth.users where email = '${address}'), true);`);
}

async function signIn(page: Page, request: APIRequestContext) {
  await expect.poll(codeAllowed, { timeout: 75_000, intervals: [2_000] }).toEqual([["t"]]);
  await signInWithCode(page, request, address);
}

async function expectCourseCount(page: Page, completed: number) {
  await page.goto(`/courses/${course.slug}`);
  await expect(page.getByText(catalogCommon.progress(completed, 2), { exact: true })).toBeVisible();
  await expect(
    page.getByText(coursePage.xpEarned(completed * LESSON_XP, 2 * LESSON_XP), { exact: true }),
  ).toBeVisible();
  await expect(page.getByText(coursePage.lessonState.completed, { exact: true })).toHaveCount(
    completed,
  );
  await noAxeViolations(page);
}

/** The profile's XP and both streaks, as the page shows them. */
async function profileNumbers(page: Page): Promise<string[]> {
  await page.goto("/profile");
  await expect(page.getByRole("heading", { level: 1, name: profile.heading })).toBeVisible();
  await noAxeViolations(page);
  return page.getByRole("main").locator("dl dd").allTextContents();
}

const contexts: BrowserContext[] = [];

test.beforeAll(() => {
  course.write();
});

// A device whose sync is still retrying could write a completion after the
// cleanup, which would keep the course's lessons from being deleted.
test.afterEach(async () => {
  await Promise.all(contexts.map((context) => context.close()));
  contexts.length = 0;
});

test.afterAll(() => {
  // The account's profile and completions go with it (on delete cascade).
  sql(`delete from auth.users where email = '${address}';`);
  course.remove();
});

test("[FR-PRG-02] [FR-PRG-03] J-5 and J-6: a guest's progress joins the account on sign-in, and another device sees it", async ({
  browser,
  request,
}) => {
  // Device A: an account with one completion, then signed out.
  const deviceA = await browser.newContext();
  contexts.push(deviceA);
  const pageA = await deviceA.newPage();
  await signIn(pageA, request);
  await passLesson(pageA, laptop, secondLesson);
  await expect.poll(accountCompletions, { timeout: 15_000 }).toEqual([["second", XP]]);
  await pageA.getByRole("button", { name: account.signOut }).click();
  await expect(pageA.getByRole("link", { name: account.signIn })).toBeVisible();
  // Signing out forgot this device's completion (approved by the owner on 2026-11-24).
  await expectCourseCount(pageA, 0);

  // Device B: a guest completes the first lesson; the account does not have it yet.
  const deviceB = await browser.newContext();
  contexts.push(deviceB);
  const pageB = await deviceB.newPage();
  await passLesson(pageB, laptop, firstLesson);
  await expectCourseCount(pageB, 1);
  expect(accountCompletions()).toEqual([["second", XP]]);

  // J-5: sign in; the device's completion joins the account's.
  await signIn(pageB, request);
  await expect.poll(accountCompletions, { timeout: 15_000 }).toEqual([
    ["first", XP],
    ["second", XP],
  ]);
  await expectCourseCount(pageB, 2);
  // The table's key allows one row per lesson; the reload shows a second sync
  // changes nothing the learner sees.
  await pageB.reload();
  await expectCourseCount(pageB, 2);
  const numbersB = await profileNumbers(pageB);
  // XP is the sum of the account's rows. Both passes were made minutes apart,
  // so both streaks are one day (a run across midnight would fail here).
  expect(numbersB).toEqual([profile.xpValue(2 * LESSON_XP), profile.days(1), profile.days(1)]);

  // J-6: a second browser, a phone with nothing on the device, sees the same.
  const deviceC = await browser.newContext(phone);
  contexts.push(deviceC);
  const pageC = await deviceC.newPage();
  await signIn(pageC, request);
  await expectCourseCount(pageC, 2);
  expect(await profileNumbers(pageC)).toEqual(numbersB);
  expect(accountCompletions()).toHaveLength(2);
});
