import { expect, test } from "@playwright/test";
import { courseEditor } from "../src/messages/admin";
import { removeAdmin, signInAsAdmin, sql, sqlRows } from "./admin-helpers";
import { noAxeViolations } from "./journeys";
import { saveScreen } from "./screens";

// WP-7.5, FR-ADM-13: the course editor shows, per lesson, how many learners
// completed it, as public.lesson_completion_counts() counts them. The course,
// its lessons and three learners with their completions are written straight
// into the local stack, so no other journey's learners change the counts.
// Runs in the `stack` project; the dashboard's screen is at 1280 px.

const stamp = String(Date.now());
const SLUG = `counts-${stamp}`;
// One fixed title for the screen; the address is unique to this run.
const TITLE = "Python basics";
const LEARNERS = [1, 2, 3].map((n) => `counts-${stamp}-${String(n)}@example.test`);

test.beforeAll(() => {
  sql(`do $journey$
declare
  course uuid := gen_random_uuid();
  chapter uuid := gen_random_uuid();
  print_lesson uuid := gen_random_uuid();
  ask_lesson uuid := gen_random_uuid();
  draft_lesson uuid := gen_random_uuid();
begin
  insert into public.courses (id, slug, title, summary) values
    (course, '${SLUG}', '${TITLE}', 'A course made by the completion counts journey.');
  insert into public.chapters (id, course_id, title, position) values (chapter, course, 'First steps', 0);
  insert into public.lessons (id, course_id, chapter_id, slug, title, position) values
    (print_lesson, course, chapter, 'print', 'Print a line', 0),
    (ask_lesson, course, chapter, 'ask', 'Ask a question', 1),
    (draft_lesson, course, chapter, 'draft', 'Not finished', 2);
  insert into auth.users (id, email, aud, role)
    select gen_random_uuid(), address, 'authenticated', 'authenticated'
    from unnest(array['${LEARNERS.join("','")}']) as address;
  -- Three learners passed the first lesson and one the second.
  insert into public.completions (user_id, lesson_id)
    select id, print_lesson from auth.users where email like 'counts-${stamp}-%';
  insert into public.completions (user_id, lesson_id)
    select id, ask_lesson from auth.users where email = '${LEARNERS[0] ?? ""}';
end;
$journey$;`);
});

test.afterAll(() => {
  sql(`delete from auth.users where email like 'counts-${stamp}-%';
delete from public.lessons where course_id = (select id from public.courses where slug = '${SLUG}');
delete from public.chapters where course_id = (select id from public.courses where slug = '${SLUG}');
delete from public.courses where slug = '${SLUG}';`);
});

test("[FR-ADM-13] the course editor shows each lesson's completion count from the database", async ({
  page,
  request,
}) => {
  test.setTimeout(120_000);
  const address = `admin-counts-${stamp}@example.test`;
  await signInAsAdmin(page, request, address);
  try {
    const course = sqlRows(`select id from public.courses where slug = '${SLUG}'`)[0]?.[0] ?? "";
    await page.goto(`/admin/courses/${course}`);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(courseEditor.editTitle(TITLE));
    const rows = page
      .getByRole("list", { name: courseEditor.chapterLessonsLabel("First steps") })
      .getByRole("listitem");
    await expect(rows).toHaveCount(3);
    await expect(rows.nth(0)).toContainText(courseEditor.completions(3));
    await expect(rows.nth(1)).toContainText(courseEditor.completions(1));
    await expect(rows.nth(2)).toContainText(courseEditor.completions(0));
    await noAxeViolations(page);
    await saveScreen(page, "admin-completion-counts", 1280, { workPackage: "WP-7.5" });

    // A new completion shows on the next read.
    sql(`insert into public.completions (user_id, lesson_id)
      select u.id, l.id from auth.users as u, public.lessons as l
      join public.courses as c on c.id = l.course_id
      where u.email = '${LEARNERS[1] ?? ""}' and c.slug = '${SLUG}' and l.slug = 'ask'`);
    await page.reload();
    await expect(rows.nth(1)).toContainText(courseEditor.completions(2));
  } finally {
    removeAdmin(address);
  }
});
