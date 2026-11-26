import { existsSync, statSync } from "node:fs";
import { join } from "node:path";
import { expect, test, type Page } from "@playwright/test";
import { courseEditor } from "../src/messages/admin";
import { catalogCommon, courseList, coursePage, home } from "../src/messages/catalog";
import { shell } from "../src/messages/shell";
import { removeAdmin, signInAsAdmin, sql, sqlRows } from "./admin-helpers";
import { saveScreen, savesScreens } from "./screens";
import { noAxeViolations } from "./journeys";

// WP-5.1 against the local stack: the home page, the course list and a course
// page show only published content, with the counts the database holds
// (FR-LND-02, FR-CAT-01, FR-CAT-04, FR-CRS-01); each page has its title and
// canonical address and may be indexed (FR-SEO-01); nothing scrolls sideways
// at 320 px (NFR-A11Y-05). Screens at 375, 768 and 1280 px.
//
// The lessons are written straight into the database as the seed writes its
// sample course: each saved through save_lesson as validated, then published,
// so the publish rule holds. The course itself is published, and moved back
// to draft at the end, by an admin in the dashboard: that expires the
// published-content cache as a real change does, so no test waits for the
// cache's minute.

test.describe.configure({ mode: "serial" });

const ORIGIN = "https://heapacademy.dev";
const WIDTHS = [320, 375, 768, 1280];
const SHOT_WIDTHS = [375, 768, 1280];

const stamp = Date.now();
const SLUG = `catalog-${String(stamp)}`;
const DRAFT_SLUG = `catalog-draft-${String(stamp)}`;
const COURSE = {
  title: "Catalog check",
  summary: "A course made by the catalog journey.",
  outcomes: ["Read a course page", "Count its lessons"],
  publishedChapter: "Published chapter",
  publishedChapterSummary: "Two published lessons and one draft.",
  draftChapter: `Draft chapter ${String(stamp)}`,
  lessons: ["Print a line", "Print two lines"],
  draftLesson: `Draft lesson ${String(stamp)}`,
  draftCourse: `Draft course ${String(stamp)}`,
};
// Text that only an admin may read: none of it may reach a public response,
// in the HTML or in the page data sent with it (T-21).
const SOLUTION_MARK = `solution-mark-${String(stamp)}`;
const WRONG_MARK = `wrong-answer-mark-${String(stamp)}`;
const PRIVATE_MARKS = [
  COURSE.draftLesson,
  COURSE.draftChapter,
  COURSE.draftCourse,
  SOLUTION_MARK,
  WRONG_MARK,
];

/** One lesson, saved as validated like the seed's, then published or left a draft. */
function lessonStatements(
  course: string,
  chapter: string,
  slug: string,
  title: string,
  position: number,
  publish: boolean,
): string {
  return `
  insert into public.lessons (course_id, chapter_id, slug, title, position)
    values (${course}, ${chapter}, '${slug}', '${title}', ${String(position)})
    returning id into lesson;
  perform public.save_lesson(
    lesson, (select updated_at from public.lessons where id = lesson), ${chapter},
    '${slug}', '${title}', ${String(position)}, 10, 'Print one line.', '[]', '',
    '[{"id": "prints", "name": "Prints the line", "stdin": "", "expected": "hello"}]',
    'print("hello")  # ${SOLUTION_MARK}',
    '[{"label": "Prints nothing", "code": "pass  # ${WRONG_MARK}"}]', true);
  ${publish ? "update public.lessons set status = 'published' where id = lesson;" : ""}`;
}

function seedCourses() {
  sql(`do $journey$
declare
  course uuid := gen_random_uuid();
  draft_course uuid := gen_random_uuid();
  published_chapter uuid := gen_random_uuid();
  draft_chapter uuid := gen_random_uuid();
  other_chapter uuid := gen_random_uuid();
  lesson uuid;
begin
  insert into public.courses (id, slug, title, summary, outcomes) values (
    course, '${SLUG}', '${COURSE.title}', '${COURSE.summary}',
    '${JSON.stringify(COURSE.outcomes)}');
  insert into public.chapters (id, course_id, title, summary, position) values
    (published_chapter, course, '${COURSE.publishedChapter}', '${COURSE.publishedChapterSummary}', 0),
    (draft_chapter, course, '${COURSE.draftChapter}', '', 1);
  ${lessonStatements("course", "published_chapter", "first", COURSE.lessons[0] ?? "", 0, true)}
  ${lessonStatements("course", "published_chapter", "second", COURSE.lessons[1] ?? "", 1, true)}
  ${lessonStatements("course", "published_chapter", "draft", COURSE.draftLesson, 2, false)}
  ${lessonStatements("course", "draft_chapter", "only-draft", COURSE.draftLesson, 0, false)}

  -- A draft course with a published lesson: the course's own status hides it.
  insert into public.courses (id, slug, title, summary) values (
    draft_course, '${DRAFT_SLUG}', '${COURSE.draftCourse}', '${COURSE.summary}');
  insert into public.chapters (id, course_id, title) values
    (other_chapter, draft_course, '${COURSE.publishedChapter}');
  ${lessonStatements("draft_course", "other_chapter", "first", COURSE.lessons[0] ?? "", 0, true)}
end;
$journey$;`);
}

function removeCourses() {
  const slugs = `('${SLUG}', '${DRAFT_SLUG}')`;
  const ids = `(select id from public.courses where slug in ${slugs})`;
  sql(`delete from public.lessons where course_id in ${ids};
delete from public.chapters where course_id in ${ids};
delete from public.courses where slug in ${slugs};`);
}

// The seed's course and this spec's own. Other stack journeys write and
// delete published courses while this one runs, and the course list is cached
// for up to a minute, so the whole list matches the database only by chance.
const KNOWN_SLUGS = `('sample-course', '${SLUG}', '${DRAFT_SLUG}')`;

/** The known published courses with their published lesson counts, as the database holds them. */
function publishedCounts(): Map<string, number> {
  const rows = sqlRows(`select c.title, count(l.id)
from public.courses c
join public.lessons l on l.course_id = c.id and l.status = 'published'
where c.status = 'published' and c.slug in ${KNOWN_SLUGS}
group by c.id, c.title`);
  return new Map(rows.map(([title, count]) => [title ?? "", Number(count)]));
}

async function noSidewaysScroll(page: Page) {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBe(0);
}

async function indexableAt(page: Page, path: string) {
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
    "href",
    path === "/" ? ORIGIN : `${ORIGIN}${path}`,
  );
  await expect(page.locator('meta[name="robots"]')).toHaveCount(0);
}

/**
 * Each known published course has one row under `heading` with the
 * database's count, and the known draft course has none.
 */
async function expectRowsMatchDatabase(page: Page, heading: string) {
  const counts = publishedCounts();
  expect(counts.get(COURSE.title)).toBe(COURSE.lessons.length);
  expect(counts.has(COURSE.draftCourse)).toBe(false);
  expect(counts.size, "the seed's course and this spec's").toBe(2);
  const list = page.getByRole("list", { name: heading });
  await expect(list.getByRole("listitem").filter({ hasText: COURSE.draftCourse })).toHaveCount(0);
  for (const [title, count] of counts) {
    const row = list
      .getByRole("listitem")
      .filter({ has: page.getByRole("link", { name: title, exact: true }) });
    await expect(row).toHaveCount(1);
    // A new browser has completed nothing on this device (WP-5.4, FR-CAT-02).
    await expect(row.getByText(catalogCommon.progress(0, count), { exact: true })).toBeVisible();
  }
}

const ADMIN = `admin-catalog-${String(stamp)}@example.test`;
let admin: Page | undefined;

/**
 * The page asks not to be indexed. A not-found answer carries two robots
 * tags, the page's own and the one Next.js adds to every not-found response,
 * so every tag there is must say noindex.
 */
async function expectNoindex(page: Page, label: string) {
  const robots = page.locator('meta[name="robots"]');
  await expect(robots.first(), label).toBeAttached();
  const contents = await robots.evaluateAll((metas) =>
    metas.map((meta) => meta.getAttribute("content") ?? ""),
  );
  for (const content of contents) expect(content, label).toMatch(/noindex/);
}

/** Moves the course to a status in its editor, as the owner does. */
async function setCourseStatus(page: Page, to: "published" | "draft") {
  const [row] = sqlRows(`select id from public.courses where slug = '${SLUG}'`);
  await page.goto(`/admin/courses/${row?.[0] ?? ""}`);
  await page.getByRole("button", { name: courseEditor.statusAction[to], exact: true }).click();
  const dialog = page.getByRole("dialog");
  if (to === "draft")
    await dialog.getByRole("button", { name: courseEditor.statusAction[to], exact: true }).click();
  // The editor has a status line per panel; this is the one in the Status panel.
  await expect(
    page.getByRole("group", { name: courseEditor.statusHeading, exact: true }).getByRole("status"),
  ).toHaveText(courseEditor.statusChanged(courseEditor.statusName[to]));
}

function courseStatus(): string | undefined {
  return sqlRows(`select status from public.courses where slug = '${SLUG}'`)[0]?.[0];
}

// A published course goes back to draft through the dashboard first, so the
// cache forgets it before its rows go; then later specs never see a course
// that answers 404. Safe to call twice.
async function cleanUp() {
  try {
    if (admin !== undefined && courseStatus() === "published") {
      await setCourseStatus(admin, "draft");
    }
  } finally {
    await admin?.close();
    admin = undefined;
    removeAdmin(ADMIN);
    removeCourses();
  }
}

/** No private text in a public response's body, HTML and page data alike. */
async function expectNoPrivateText(page: Page, path: string) {
  const body = await (await page.request.get(path)).text();
  for (const mark of PRIVATE_MARKS) expect(body, `${path} carries ${mark}`).not.toContain(mark);
}

test.beforeAll(async ({ browser, playwright }, testInfo) => {
  const { baseURL } = testInfo.project.use;
  if (baseURL === undefined) throw new Error("the stack project has no baseURL");
  try {
    seedCourses();
    admin = await browser.newPage({ baseURL });
    const request = await playwright.request.newContext({ baseURL });
    await signInAsAdmin(admin, request, ADMIN);
    await request.dispose();
    await setCourseStatus(admin, "published");
  } catch (error) {
    await cleanUp();
    throw error;
  }
});

test.afterAll(cleanUp);

test("[FR-CAT-01] [FR-CAT-04] the course list shows only published courses, with the database's counts", async ({
  page,
}) => {
  await page.goto("/courses");
  await expect(page.getByRole("link", { name: COURSE.title, exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(courseList.heading);
  await expectRowsMatchDatabase(page, courseList.heading);
  await expect(page.getByRole("link", { name: COURSE.draftCourse })).toHaveCount(0);
  await expect(page).toHaveTitle(`${courseList.title} | Heap Academy`);
  await indexableAt(page, "/courses");
  await expect(
    page
      .getByRole("navigation", { name: shell.mainNavigation })
      .getByRole("link", { name: catalogCommon.coursesLink }),
  ).toHaveAttribute("aria-current", "page");

  for (const width of WIDTHS) {
    await page.setViewportSize({ width, height: 900 });
    await noSidewaysScroll(page);
    await noAxeViolations(page);
    if (SHOT_WIDTHS.includes(width)) {
      await saveScreen(page, "courses", width, { workPackage: "WP-5.1" });
    }
  }
});

test("[FR-LND-02] [FR-LND-03] the home page says what this is and lists the published courses", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.getByRole("link", { name: COURSE.title, exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(home.heading);
  await expectRowsMatchDatabase(page, home.coursesHeading);
  await expect(page.getByText(home.how)).toBeVisible();
  await expect(page).toHaveTitle(home.title);
  await indexableAt(page, "/");

  for (const width of WIDTHS) {
    await page.setViewportSize({ width, height: 900 });
    await noSidewaysScroll(page);
    await noAxeViolations(page);
    if (SHOT_WIDTHS.includes(width)) {
      await saveScreen(page, "home", width, { workPackage: "WP-5.1" });
    }
  }
});

test("[FR-CRS-01] [FR-SEO-01] the course page shows the published chapters and lessons in order", async ({
  page,
}) => {
  await page.goto("/courses");
  await page.getByRole("link", { name: COURSE.title, exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`/courses/${SLUG}$`));

  await expect(page.getByRole("heading", { level: 1 })).toHaveText(COURSE.title);
  await expect(page.getByText(COURSE.summary, { exact: true })).toBeVisible();
  await expect(page.getByText(coursePage.size(COURSE.lessons.length, 1))).toBeVisible();
  await expect(page.getByRole("list", { name: coursePage.outcomesHeading })).toHaveText(
    new RegExp(COURSE.outcomes.join(".*")),
  );
  await expect(page.getByRole("heading", { level: 3 })).toHaveCount(1);
  await expect(page.getByRole("heading", { level: 3 })).toContainText(COURSE.publishedChapter);
  await expect(page.getByText(COURSE.publishedChapterSummary)).toBeVisible();
  const lessons = page
    .getByRole("list", { name: coursePage.chapterLessonsLabel(COURSE.publishedChapter) })
    .getByRole("listitem");
  // Each row: its number, its title, its XP (10 in the seed) and its state;
  // a new browser has completed nothing, so the first is next up (WP-5.4).
  await expect(lessons).toHaveText([
    `${coursePage.lessonNumber(1, 1)} ${COURSE.lessons[0] ?? ""} ${coursePage.lessonXp(10)}${coursePage.lessonState.next}`,
    `${coursePage.lessonNumber(1, 2)} ${COURSE.lessons[1] ?? ""} ${coursePage.lessonXp(10)}${coursePage.lessonState.open}`,
  ]);
  await expect(page.getByText(COURSE.draftLesson)).toHaveCount(0);
  await expect(page.getByText(COURSE.draftChapter)).toHaveCount(0);

  await expect(page).toHaveTitle(`${COURSE.title} | Heap Academy`);
  await expect(page.locator('meta[name="description"]')).toHaveAttribute("content", COURSE.summary);
  await indexableAt(page, `/courses/${SLUG}`);
  // A course page is not the course list, so Courses is not marked current.
  await expect(
    page
      .getByRole("navigation", { name: shell.mainNavigation })
      .getByRole("link", { name: catalogCommon.coursesLink }),
  ).not.toHaveAttribute("aria-current");

  for (const width of WIDTHS) {
    await page.setViewportSize({ width, height: 900 });
    await noSidewaysScroll(page);
    await noAxeViolations(page);
    if (SHOT_WIDTHS.includes(width)) {
      await saveScreen(page, "course", width, { workPackage: "WP-5.1" });
    }
  }
});

test("[FR-CAT-04] a draft course answers not found and is left out of the sitemap", async ({
  page,
  request,
}) => {
  const response = await page.goto(`/courses/${DRAFT_SLUG}`);
  expect(response?.status()).toBe(404);
  await expectNoindex(page, `/courses/${DRAFT_SLUG}`);

  const sitemap = await (await request.get("/sitemap.xml")).text();
  expect(sitemap).toContain(`${ORIGIN}/courses/${SLUG}`);
  expect(sitemap).not.toContain(DRAFT_SLUG);
});

test("[T-21] no public response carries a draft, a solution or a wrong answer", async ({
  page,
}) => {
  for (const path of ["/", "/courses", `/courses/${SLUG}`, "/sitemap.xml"]) {
    await expectNoPrivateText(page, path);
  }
  // The page data a client navigation fetches, beside the HTML.
  for (const path of ["/", "/courses", `/courses/${SLUG}`]) {
    const response = await page.request.get(path, { headers: { RSC: "1" } });
    // Page data, not the HTML again: Next.js redirects to `?_rsc` first.
    expect(response.headers()["content-type"], path).toMatch(/^text\/x-component/);
    const data = await response.text();
    for (const mark of PRIVATE_MARKS)
      expect(data, `${path} data carries ${mark}`).not.toContain(mark);
  }
});

test("the three pages' screens are saved for the design review, by the screenshot project only", () => {
  const saves = savesScreens(test.info().project.name);
  for (const name of ["home", "courses", "course"]) {
    for (const width of SHOT_WIDTHS) {
      const file = join("docs", "reports", "screens", "WP-5.1", `${name}-${String(width)}.png`);
      expect(existsSync(file), file).toBe(true);
      // Saved by this run, not left from an earlier one. Firefox and WebKit
      // save none (e2e/screens.ts), so there only the committed ones count.
      if (saves) expect(statSync(file).mtimeMs, file).toBeGreaterThanOrEqual(stamp);
    }
  }
});

test("[FR-SEO-01] sign-in and the admin door ask not to be indexed", async ({ page }) => {
  for (const path of ["/sign-in", "/admin", "/admin/setup", "/admin/verify"]) {
    await page.goto(path);
    await expectNoindex(page, path);
  }
});
