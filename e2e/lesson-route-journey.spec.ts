import { devices, test } from "@playwright/test";
import { EXAMPLE_LESSON } from "../src/grader/example-lesson";
import { sql } from "./admin-helpers";
import {
  completeALesson,
  programThatAsksForInput,
  runawayCode,
  type Target,
  videoToFirstRun,
} from "./journeys";

// WP-7.4 part 2: journeys J-1 to J-4 as a guest on real lesson addresses, on
// the production build, read from the local stack through the public content
// client. e2e/journeys-phone.spec.ts and e2e/journeys-wide-runtime.spec.ts
// walk the same journeys on the development page /dev/workspace, which needs
// no database. Runs in the stack project, which is Chromium only for now.
//
// Each worker writes its own course with two published lessons, both the
// example lesson with their own titles, as the seed writes its sample course:
// saved through save_lesson as validated, then published, so the publish rule
// holds. J-2 passes the first and follows Next to the second; on the second,
// the last, Next is shown disabled. The addresses are new, so no cached read
// answers for them. The course is removed at the end.
test.describe.configure({ timeout: 120_000 });

const stamp = String(Date.now());
const SLUG = `journeys-${stamp}`;
const COURSE = { title: `Journeys ${stamp}`, slug: SLUG };
const XP = 10;
const LESSONS = [
  { slug: "first", title: EXAMPLE_LESSON.title },
  { slug: "second", title: "Say hello again" },
] as const;
const [FIRST, LAST] = LESSONS;
const address = (slug: string) => `/learn/${SLUG}/${slug}`;

const firstLesson: Target = {
  address: address(FIRST.slug),
  title: FIRST.title,
  xp: XP,
  course: COURSE,
  next: { href: address(LAST.slug), title: LAST.title, follow: true },
};
const lastLesson: Target = {
  address: address(LAST.slug),
  title: LAST.title,
  xp: XP,
  course: COURSE,
  next: null,
};

function lessonStatements(slug: string, title: string, position: number): string {
  const tests = EXAMPLE_LESSON.testCases.map(({ id, name, stdin, expected }) => ({
    id,
    name,
    stdin,
    expected,
  }));
  const wrongAnswers = [
    { label: EXAMPLE_LESSON.wrongAnswer.label, code: EXAMPLE_LESSON.wrongAnswer.code },
  ];
  return `
  insert into public.lessons (course_id, chapter_id, slug, title, position)
    values (course, chapter, '${slug}', '${title}', ${String(position)})
    returning id into lesson;
  perform public.save_lesson(
    lesson, (select updated_at from public.lessons where id = lesson), chapter,
    '${slug}', '${title}', ${String(position)}, ${String(XP)},
    $md$${EXAMPLE_LESSON.instructions}$md$,
    $json$${JSON.stringify(EXAMPLE_LESSON.hints)}$json$,
    $py$${EXAMPLE_LESSON.starter}$py$,
    $json$${JSON.stringify(tests)}$json$,
    $py$${EXAMPLE_LESSON.solution}$py$,
    $json$${JSON.stringify(wrongAnswers)}$json$,
    true);
  update public.lessons set status = 'published' where id = lesson;`;
}

test.beforeAll(() => {
  sql(`do $journey$
declare
  course uuid := gen_random_uuid();
  chapter uuid := gen_random_uuid();
  lesson uuid;
begin
  insert into public.courses (id, slug, title, summary) values (
    course, '${SLUG}', '${COURSE.title}', 'A course made by the lesson route journey.');
  insert into public.chapters (id, course_id, title) values (chapter, course, 'Input and output');
  ${LESSONS.map(({ slug, title }, position) => lessonStatements(slug, title, position)).join("\n")}
  update public.courses set status = 'published' where id = course;
end;
$journey$;`);
});

test.afterAll(() => {
  const course = `(select id from public.courses where slug = '${SLUG}')`;
  sql(`delete from public.lessons where course_id = ${course};
delete from public.chapters where course_id = ${course};
delete from public.courses where slug = '${SLUG}';`);
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
