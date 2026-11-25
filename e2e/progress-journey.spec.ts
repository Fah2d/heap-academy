import { type APIRequestContext, expect, type Page, test } from "@playwright/test";
import { EXAMPLE_LESSON } from "../src/grader/example-lesson";
import { catalogCommon, coursePage } from "../src/messages/catalog";
import { profile } from "../src/messages/profile";
import { account } from "../src/messages/sign-in";
import { sql, sqlRows } from "./admin-helpers";
import { passLesson, type Target } from "./journeys";
import { signInWithCode } from "./sign-in-helpers";
import { LESSON_XP, stackCourse } from "./stack-course";

// WP-7.4 part 2b: J-5 (save my progress) and J-6 (another device), in
// docs/spec/01-requirements.md section 2, on the production build against the
// local stack (the `stack` project). Three browser contexts stand for three
// devices, all signed in to one account by email code:
//
// 1. Device A signs in, passes the second lesson, which is stored in the
//    account, and signs out; its device progress is cleared at sign-out.
// 2. Device B, as a guest, passes the first lesson, then signs in. The
//    device's completion joins the account's: two rows, nothing lost, nothing
//    doubled, and the XP is the sum of the rows (FR-PRG-03, FR-PRG-04).
// 3. Device C, a fresh browser, signs in and sees the same completions, XP
//    and streak as device B (J-6, FR-PRG-02).
//
// The provider sends at most one code a minute to one address
// (supabase/config.toml, max_frequency), so each sign-in after the first
// waits until a minute has passed since the one before.
const CODE_INTERVAL_MS = 61_000;
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
const laptop = { phone: false };

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

async function expectCourseCount(page: Page, completed: number) {
  await page.goto(`/courses/${course.slug}`);
  await expect(page.getByText(catalogCommon.progress(completed, 2), { exact: true })).toBeVisible();
  await expect(
    page.getByText(coursePage.xpEarned(completed * LESSON_XP, 2 * LESSON_XP), { exact: true }),
  ).toBeVisible();
}

/** The profile's XP and both streaks, as the page shows them. */
async function profileNumbers(page: Page): Promise<string[]> {
  await page.goto("/profile");
  await expect(page.getByRole("heading", { level: 1, name: profile.heading })).toBeVisible();
  return page.getByRole("main").locator("dl dd").allTextContents();
}

let lastCode = 0;

async function signIn(page: Page, request: APIRequestContext) {
  const wait = lastCode + CODE_INTERVAL_MS - Date.now();
  if (lastCode > 0 && wait > 0) await page.waitForTimeout(wait);
  lastCode = Date.now();
  await signInWithCode(page, request, address);
}

test.beforeAll(() => {
  course.write();
});

test.afterAll(() => {
  sql(`delete from public.completions where user_id = ${user};`);
  course.remove();
});

test("[FR-PRG-02] [FR-PRG-03] [FR-PRG-04] J-5 and J-6: a guest's progress joins the account on sign-in, and another device sees it", async ({
  browser,
  request,
}) => {
  // Device A: an account with one completion, then signed out.
  const deviceA = await browser.newContext();
  const pageA = await deviceA.newPage();
  await signIn(pageA, request);
  await passLesson(pageA, laptop, secondLesson);
  await expect.poll(accountCompletions, { timeout: 15_000 }).toEqual([["second", "10"]]);
  await pageA.getByRole("button", { name: account.signOut }).click();
  await expect(pageA.getByRole("link", { name: account.signIn })).toBeVisible();
  // Signing out forgot this device's completion (approved by the owner on 2026-11-24).
  await expectCourseCount(pageA, 0);
  await deviceA.close();

  // Device B: a guest completes the first lesson; the account does not have it yet.
  const deviceB = await browser.newContext();
  const pageB = await deviceB.newPage();
  await passLesson(pageB, laptop, firstLesson);
  await expectCourseCount(pageB, 1);
  expect(accountCompletions()).toEqual([["second", "10"]]);

  // J-5: sign in; the device's completion joins the account's.
  await signIn(pageB, request);
  await expect.poll(accountCompletions, { timeout: 15_000 }).toEqual([
    ["first", "10"],
    ["second", "10"],
  ]);
  await expectCourseCount(pageB, 2);
  await expect(pageB.getByText(coursePage.lessonState.completed, { exact: true })).toHaveCount(2);
  // A reload syncs again and doubles nothing.
  await pageB.reload();
  await expectCourseCount(pageB, 2);
  expect(accountCompletions()).toHaveLength(2);
  const numbersB = await profileNumbers(pageB);
  // XP is the sum of the account's rows (FR-PRG-04); both passes were today.
  expect(numbersB[0]).toBe(profile.xpValue(2 * LESSON_XP));
  expect(numbersB.slice(1)).not.toContain(profile.days(0));
  await deviceB.close();

  // J-6: a second browser, with nothing on the device, sees the same.
  const deviceC = await browser.newContext();
  const pageC = await deviceC.newPage();
  await signIn(pageC, request);
  await expectCourseCount(pageC, 2);
  await expect(pageC.getByText(coursePage.lessonState.completed, { exact: true })).toHaveCount(2);
  expect(await profileNumbers(pageC)).toEqual(numbersB);
  expect(accountCompletions()).toHaveLength(2);
  await deviceC.close();
});
