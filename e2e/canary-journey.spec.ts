import { randomUUID } from "node:crypto";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { expect, test, type APIRequestContext, type Page, type Response } from "@playwright/test";
import { EXAMPLE_LESSON } from "../src/grader/example-lesson";
import { PUBLISHABLE_KEY, SUPABASE, accessToken, sql, sqlRows } from "./admin-helpers";
import { signInWithCode } from "./sign-in-helpers";
import { ON_SITE_MS } from "./stack-course";

// WP-7.1, the canary test of T-21 (docs/spec/06-security-privacy.md section 4):
// solutions, wrong answers and unpublished content never reach a guest or a
// learner. The spec writes a published course whose one published lesson
// carries a unique token in its solution and in its wrong answer, a draft and
// an archived lesson in that course, and a draft course, each with its own
// token in every field a learner would otherwise read. A guest, then a
// learner, opens every address they can reach and the admin addresses that
// must answer not-found; every text response the browser receives, the same
// addresses fetched directly as HTML and as the router's payload, and the
// Data API's tables must not hold a token, while the published course and
// lesson must be shown, so a walk of error pages cannot pass. The client
// bundles must not hold the seed lesson's wrong answer, which the source
// knows (the fixture tokens are written after the build, so only a response
// can carry them). Runs in the stack project.
test.describe.configure({ timeout: 180_000 });

/** The client files every visitor can download: the app's and the Python worker's. */
const BUNDLES = [
  join(process.cwd(), ".next", "static"),
  join(process.cwd(), "public", "_runtime", "worker"),
];

function filesUnder(folder: string): string[] {
  return readdirSync(folder).flatMap((name) => {
    const path = join(folder, name);
    return statSync(path).isDirectory() ? filesUnder(path) : [path];
  });
}

/**
 * A whole program as a bundle may spell it: raw, in a JSON string, or in a
 * string literal that escapes only its line breaks, with and without the
 * last line break. Whole programs, not lines: a line such as a call to
 * input() also appears in starter code and in the development fixtures.
 */
function spellings(code: string): string[] {
  return [code, code.trimEnd()].flatMap((text) => [
    text,
    JSON.stringify(text).slice(1, -1),
    text.replaceAll("\n", "\\n"),
  ]);
}

// The seed lesson's solution is not a needle: the example's public
// instructions show it in a code block.
test("[T-21] the client bundles do not hold the seed lesson's wrong answer", () => {
  for (const folder of BUNDLES) {
    expect(
      filesUnder(folder).filter((path) => /\.m?js$/.test(path)).length,
      `JavaScript in ${folder}`,
    ).toBeGreaterThan(0);
  }
  const files = BUNDLES.flatMap(filesUnder).filter((path) =>
    /\.(m?js|css|json|txt|html)$/.test(path),
  );
  const secrets = [...new Set(spellings(EXAMPLE_LESSON.wrongAnswer.code))];
  const found = files.flatMap((path) => {
    const text = readFileSync(path, "utf8");
    return secrets.filter((secret) => text.includes(secret)).map((secret) => `${path}: ${secret}`);
  });
  expect(found).toEqual([]);
});

test.describe("with the canary content in the database", () => {
  const stamp = randomUUID().replaceAll("-", "");
  const token = (place: string) => `canary${place}${stamp}`;
  const TOKENS = {
    solution: token("solution"),
    wrongAnswer: token("wronganswer"),
    wrongAnswerLabel: token("wronglabel"),
    draftLesson: token("draftlesson"),
    archivedLesson: token("archivedlesson"),
    draftCourse: token("draftcourse"),
  } as const;
  const tokens = Object.values(TOKENS);

  const SLUG = `canary-${stamp.slice(0, 12)}`;
  const COURSE_TITLE = `Canary ${stamp.slice(0, 12)}`;
  const DRAFT_SLUG = `canary-draft-${stamp.slice(0, 12)}`;
  const PUBLISHED = "published";
  const DRAFT = "draft";
  const ARCHIVED = "archived";

  /** Every learner-facing field of a lesson carries the token. */
  function hiddenLesson(slug: string, place: string, position: number, status: string): string {
    const tests = [{ id: "canary", name: place, stdin: place, expected: place }];
    return `
    insert into public.lessons (course_id, chapter_id, slug, title, position)
      values (course, chapter, '${slug}', '${place}', ${String(position)})
      returning id into lesson;
    perform public.save_lesson(
      lesson, (select updated_at from public.lessons where id = lesson), chapter,
      '${slug}', '${place}', ${String(position)}, 10,
      $md$${place}$md$,
      $json$${JSON.stringify([place])}$json$,
      $py$print("${place}")$py$,
      $json$${JSON.stringify(tests)}$json$,
      $py$print("${place}")$py$,
      $json$${JSON.stringify([{ label: place, code: `print("${place}")` }])}$json$,
      false);
    update public.lessons set status = '${status}' where id = lesson;`;
  }

  test.beforeAll(() => {
    const tests = EXAMPLE_LESSON.testCases.map(({ id, name, stdin, expected }) => ({
      id,
      name,
      stdin,
      expected,
    }));
    const solution = `${EXAMPLE_LESSON.solution}# ${TOKENS.solution}\n`;
    const wrongAnswers = [
      {
        label: TOKENS.wrongAnswerLabel,
        code: `${EXAMPLE_LESSON.wrongAnswer.code}# ${TOKENS.wrongAnswer}\n`,
      },
    ];
    sql(`do $canary$
declare
  course uuid := gen_random_uuid();
  chapter uuid := gen_random_uuid();
  draft_course uuid := gen_random_uuid();
  draft_chapter uuid := gen_random_uuid();
  lesson uuid;
begin
  -- Last in the list, so the journeys that move the first course never take it.
  insert into public.courses (id, slug, title, summary, position) values (
    course, '${SLUG}', '${COURSE_TITLE}', 'A course made by the canary test.', 900);
  insert into public.chapters (id, course_id, title) values (chapter, course, 'Canary chapter');
  insert into public.lessons (course_id, chapter_id, slug, title, position)
    values (course, chapter, '${PUBLISHED}', '${EXAMPLE_LESSON.title}', 0)
    returning id into lesson;
  perform public.save_lesson(
    lesson, (select updated_at from public.lessons where id = lesson), chapter,
    '${PUBLISHED}', '${EXAMPLE_LESSON.title}', 0, 10,
    $md$${EXAMPLE_LESSON.instructions}$md$,
    $json$${JSON.stringify(EXAMPLE_LESSON.hints)}$json$,
    $py$${EXAMPLE_LESSON.starter}$py$,
    $json$${JSON.stringify(tests)}$json$,
    $py$${solution}$py$,
    $json$${JSON.stringify(wrongAnswers)}$json$,
    true);
  update public.lessons set status = 'published' where id = lesson;
  ${hiddenLesson(DRAFT, TOKENS.draftLesson, 1, DRAFT)}
  ${hiddenLesson(ARCHIVED, TOKENS.archivedLesson, 2, ARCHIVED)}
  update public.courses set status = 'published' where id = course;

  insert into public.courses (id, slug, title, summary, position) values (
    draft_course, '${DRAFT_SLUG}', '${TOKENS.draftCourse}', '${TOKENS.draftCourse}', 901);
  insert into public.chapters (id, course_id, title)
    values (draft_chapter, draft_course, '${TOKENS.draftCourse}');
  course := draft_course;
  chapter := draft_chapter;
  ${hiddenLesson(DRAFT, TOKENS.draftCourse, 0, DRAFT)}
end;
$canary$;`);
  });

  // The cached course list lacks the new course for up to a minute, and the
  // course and lesson answer not-found until it has it (e2e/stack-course.ts).
  test.beforeAll(async ({ playwright }) => {
    const { baseURL } = test.info().project.use;
    const request = await playwright.request.newContext(baseURL === undefined ? {} : { baseURL });
    await expect
      .poll(
        () =>
          Promise.all(
            [SHOWN_COURSE(), SHOWN_LESSON()].map(async (path) =>
              (await request.get(path)).status(),
            ),
          ),
        { timeout: ON_SITE_MS, intervals: [1_000] },
      )
      .toEqual([200, 200]);
    await request.dispose();
  });

  test.afterAll(() => {
    const courses = `(select id from public.courses where slug in ('${SLUG}', '${DRAFT_SLUG}'))`;
    sql(`delete from public.lessons where course_id in ${courses};
delete from public.chapters where course_id in ${courses};
delete from public.courses where slug in ('${SLUG}', '${DRAFT_SLUG}');`);
  });

  function ids(table: "courses" | "lessons"): string[] {
    const course = table === "courses" ? "c.id" : "l.id";
    return sqlRows(
      `select distinct ${course} from public.courses c
       left join public.lessons l on l.course_id = c.id
       where c.slug in ('${SLUG}', '${DRAFT_SLUG}') and ${course} is not null`,
    ).map(([id]) => id ?? "");
  }

  const SHOWN_COURSE = () => `/courses/${SLUG}`;
  const SHOWN_LESSON = () => `/learn/${SLUG}/${PUBLISHED}`;

  /** The pages a visitor can reach, and the hidden ones that must answer not-found. */
  function pages(): string[] {
    const courses = ids("courses");
    const lessons = ids("lessons");
    expect(courses, "the canary courses").toHaveLength(2);
    expect(lessons, "the canary lessons").toHaveLength(4);
    return [
      "/",
      "/courses",
      SHOWN_COURSE(),
      SHOWN_LESSON(),
      `/learn/${SLUG}/${DRAFT}`,
      `/learn/${SLUG}/${ARCHIVED}`,
      `/courses/${DRAFT_SLUG}`,
      `/learn/${DRAFT_SLUG}/${DRAFT}`,
      "/sign-in",
      "/admin",
      "/admin/setup",
      "/admin/verify",
      "/admin/courses/new",
      ...courses.map((id) => `/admin/courses/${id}`),
      ...lessons.flatMap((id) => [`/admin/lessons/${id}`, `/admin/lessons/${id}/preview`]),
    ];
  }

  /** The other addresses a visitor can fetch, which have no router payload. */
  const FILES = ["/sitemap.xml", "/robots.txt", "/api/health"];

  const TEXT = /^(text\/|application\/(javascript|json|xml|x-component|manifest\+json))/;

  /** Reads every text response the page receives into one list of bodies. */
  function captureResponses(page: Page): { bodies: Promise<string>[] } {
    const captured = { bodies: [] as Promise<string>[] };
    page.on("response", (response: Response) => {
      const type = response.headers()["content-type"] ?? "";
      if (response.status() >= 300 && response.status() < 400) return;
      if (!TEXT.test(type)) return;
      // A body the browser has already discarded, after the page moved on,
      // counts as empty; the direct fetches below read every address again.
      captured.bodies.push(
        response
          .body()
          .then((body) => `${response.url()}\n${body.toString("utf8")}`)
          .catch(() => ""),
      );
    });
    return captured;
  }

  function leaks(bodies: string[]): string[] {
    return bodies.flatMap((body) =>
      tokens
        .filter((secret) => body.includes(secret))
        .map((secret) => `${body.slice(0, body.indexOf("\n"))}: ${secret}`),
    );
  }

  /**
   * Each page as a document and as the router's payload, and each file, with
   * the page's cookies. The shown course and lesson must carry their public
   * text in both forms.
   */
  async function fetchEvery(request: APIRequestContext, paths: string[]): Promise<string[]> {
    const bodies: string[] = [];
    for (const path of [...paths, ...FILES]) {
      const document = await request.get(path);
      const html = await document.text();
      bodies.push(`${path}\n${html}`);
      if (FILES.includes(path)) continue;
      // Next.js redirects to `?_rsc` first; the payload is behind it.
      const payload = await request.get(path, { headers: { RSC: "1" } });
      expect(payload.headers()["content-type"], `${path} payload`).toMatch(/^text\/x-component/);
      const data = await payload.text();
      bodies.push(`${path} payload\n${data}`);
      if (path === SHOWN_COURSE() || path === SHOWN_LESSON()) {
        expect(document.status(), path).toBe(200);
        expect(html, path).toContain(COURSE_TITLE);
        expect(payload.status(), `${path} payload`).toBe(200);
        expect(data, `${path} payload`).toContain(COURSE_TITLE);
      }
    }
    return bodies;
  }

  /** The content tables through the Data API, as anonymous or with a session. */
  async function dataApi(request: APIRequestContext, bearer: string | null): Promise<string[]> {
    expect(PUBLISHABLE_KEY, "the stack's publishable key").not.toBe("");
    const bodies: string[] = [];
    for (const table of ["courses", "chapters", "lessons", "lesson_solutions"]) {
      const response = await request.get(`${SUPABASE}/rest/v1/${table}?select=*`, {
        headers: {
          apikey: PUBLISHABLE_KEY,
          ...(bearer !== null && { Authorization: `Bearer ${bearer}` }),
        },
      });
      const body = await response.text();
      bodies.push(`${table}\n${body}`);
      // The public client reads published courses and lessons this way.
      if (table === "courses") {
        expect(response.status(), table).toBe(200);
        expect(body, table).toContain(SLUG);
      }
      if (table === "lessons") {
        expect(response.status(), table).toBe(200);
        expect(body, table).toContain(EXAMPLE_LESSON.title);
      }
    }
    return bodies;
  }

  async function walk(page: Page): Promise<string[]> {
    const captured = captureResponses(page);
    const paths = pages();
    for (const path of paths) {
      await page.goto(path);
      if (path === SHOWN_COURSE() || path === SHOWN_LESSON()) {
        await expect(page.locator("main")).toContainText(COURSE_TITLE);
      }
      if (path === SHOWN_LESSON()) {
        await expect(page.locator("main")).toContainText(EXAMPLE_LESSON.title);
        // The worker's own fetches: the Python files and the harness.
        await page.waitForLoadState("networkidle");
      }
    }
    const seen = (await Promise.all(captured.bodies)).filter((body) => body !== "");
    expect(seen.length, "text responses read from the browser").toBeGreaterThan(paths.length);
    return [...seen, ...(await fetchEvery(page.request, paths))];
  }

  test("[T-21] [NFR-SEC-03] a guest receives no solution, wrong answer, draft or archived content", async ({
    page,
    request,
  }) => {
    const bodies = [...(await walk(page)), ...(await dataApi(request, null))];
    expect(leaks(bodies)).toEqual([]);
  });

  test("[T-21] [NFR-SEC-03] a signed-in learner receives no solution, wrong answer, draft or archived content", async ({
    page,
    request,
  }) => {
    await signInWithCode(page, request, `canary-${stamp.slice(0, 12)}@example.com`);
    const bearer = await accessToken(page);
    const bodies = [...(await walk(page)), ...(await dataApi(request, bearer))];
    expect(leaks(bodies)).toEqual([]);
  });

  test("[T-21] the canary reads its own tokens back as the database's owner", () => {
    // Without this, a fixture that failed to write would make the two tests
    // above pass on empty content.
    const stored = sqlRows(
      `select coalesce(s.solution_code, '') || coalesce(s.wrong_answers::text, '') || l.title || l.instructions_md || c.title
       from public.lessons l
       join public.courses c on c.id = l.course_id
       left join public.lesson_solutions s on s.lesson_id = l.id
       where c.slug in ('${SLUG}', '${DRAFT_SLUG}')`,
    )
      .flat()
      .join("\n");
    expect(tokens.filter((secret) => !stored.includes(secret))).toEqual([]);
  });
});
