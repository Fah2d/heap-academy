import { expect, test } from "@playwright/test";
import { EXAMPLE_LESSON } from "../src/grader/example-lesson";
import { workspace as words } from "../src/messages/workspace";
import { sql, sqlRows } from "./admin-helpers";
import { noAxeViolations, passLesson, type Target } from "./journeys";
import { saveScreen } from "./screens";
import { signInWithCode } from "./sign-in-helpers";
import { stackCourse } from "./stack-course";

// WP-7.2: the workspace's "Unsynced completion" state (docs/spec/03-experience.md
// section 10, FR-PRG-06), which only a signed-in learner whose pass has not
// reached the account can see, so it needs the local stack (the `stack`
// project). Every server action the page sends is refused while the learner
// passes a lesson, so the pass stays on the device; then the actions are let
// through and the page is shown again, which makes the sync try at once.

const stamp = String(Date.now());
const course = stackCourse(
  `unsynced-${stamp}`,
  `Unsynced ${stamp}`,
  [{ slug: "first", title: EXAMPLE_LESSON.title }],
  "A course made by the unsynced journey.",
);
const [lesson] = course.lessons as [Target];
const address = `unsynced-${stamp}@example.test`;

test.beforeAll(() => {
  course.write();
});

test.afterAll(() => {
  // The account's completions go with it (on delete cascade).
  sql(`delete from auth.users where email = '${address}';`);
  course.remove();
});

test("[FR-PRG-06] [NFR-A11Y-02] a pass the account does not have yet is named, with no axe violation, and the notice goes once it is stored", async ({
  page,
  request,
}) => {
  test.setTimeout(150_000);
  await course.onSite(request);
  await signInWithCode(page, request, address);

  // A server action is a POST that names its action in this header.
  let refused = 0;
  await page.route("**/*", async (route) => {
    if (route.request().method() === "POST" && route.request().headers()["next-action"]) {
      refused += 1;
      await route.abort("connectionrefused");
      return;
    }
    await route.fallback();
  });
  await passLesson(page, { phone: false }, lesson);
  const notice = page.getByText(words.unsyncedTitle);
  await expect(notice).toBeVisible();
  expect(refused, "server actions refused").toBeGreaterThan(0);
  await noAxeViolations(page);
  await saveScreen(page, "workspace-unsynced", 1280, { workPackage: "WP-7.2" });

  await page.unroute("**/*");
  await page.evaluate(() => document.dispatchEvent(new Event("visibilitychange")));
  await expect(notice).toBeHidden();
  const stored = sqlRows(`select count(*) from public.completions c
    join auth.users u on u.id = c.user_id
    join public.lessons l on l.id = c.lesson_id
    join public.courses k on k.id = l.course_id
    where u.email = '${address}' and k.slug = '${course.slug}'`);
  expect(stored).toEqual([["1"]]);
});
