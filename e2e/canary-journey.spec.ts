import { randomUUID } from "node:crypto";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { expect, test, type APIRequestContext, type Page, type Response } from "@playwright/test";
import { EXAMPLE_LESSON } from "../src/grader/example-lesson";
import { PUBLISHABLE_KEY, SUPABASE, accessToken, sql, sqlRows } from "./admin-helpers";
import { signInWithCode } from "./sign-in-helpers";

// WP-7.1, the canary test of T-21 (docs/spec/06-security-privacy.md section 4):
// solutions, wrong answers and unpublished content never reach a guest or a
// learner. The spec writes a published course whose one published lesson
// carries a unique token in its solution and in its wrong answer, a draft and
// an archived lesson in that course, and a draft course, each with its own
// token in every field a learner would otherwise read. A guest, then a
// learner, opens every address they can reach and the admin addresses that
// must answer not-found; every text response the browser receives, the same
// addresses fetched directly as HTML and as the router's payload, and the
// Data API's tables must not hold a token. The client bundles of the
// production build must not hold a token, nor the seed lesson's solution or
// wrong answer, which the source knows. Runs in the stack project.
test.describe.configure({ timeout: 180_000 });

/** The production build's client files, which every visitor can download. */
const STATIC = join(process.cwd(), ".next", "static");

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

test("[NFR-SEC-04] T-21: the client bundles hold neither the seed lesson's solution nor its wrong answer", () => {
  const files = filesUnder(STATIC).filter((path) => /\.(js|css|json|txt|html)$/.test(path));
  expect(
    files.filter((path) => path.endsWith(".js")).length,
    "the production build's JavaScript in .next/static",
  ).toBeGreaterThan(0);
  const secrets = [
    ...new Set([EXAMPLE_LESSON.solution, EXAMPLE_LESSON.wrongAnswer.code].flatMap(spellings)),
  ];
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
  insert into public.courses (id, slug, title, summary) values (
    course, '${SLUG}', 'Canary ${stamp.slice(0, 12)}', 'A course made by the canary test.');
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

  insert into public.courses (id, slug, title, summary) values (
    draft_course, '${DRAFT_SLUG}', '${TOKENS.draftCourse}', '${TOKENS.draftCourse}');
  insert into public.chapters (id, course_id, title)
    values (draft_chapter, draft_course, '${TOKENS.draftCourse}');
  course := draft_course;
  chapter := draft_chapter;
  ${hiddenLesson(DRAFT, TOKENS.draftCourse, 0, DRAFT)}
end;
$canary$;`);
  });

  test.afterAll(() => {
    const courses = `(select id from public.courses where slug in ('${SLUG}', '${DRAFT_SLUG}'))`;
    sql(`delete from public.lessons where course_id in ${courses};
delete from public.chapters where course_id in ${courses};
delete from public.courses where slug in ('${SLUG}', '${DRAFT_SLUG}');`);
  });

  function lessonIds(): string[] {
    return sqlRows(
      `select l.id from public.lessons l join public.courses c on c.id = l.course_id
       where c.slug in ('${SLUG}', '${DRAFT_SLUG}') order by c.slug, l.position`,
    ).map(([id]) => id ?? "");
  }

  /** Every address a visitor can reach, and the hidden ones that must answer not-found. */
  function addresses(): string[] {
    const ids = lessonIds();
    expect(ids, "the canary lessons").toHaveLength(4);
    return [
      "/",
      "/courses",
      `/courses/${SLUG}`,
      `/learn/${SLUG}/${PUBLISHED}`,
      `/learn/${SLUG}/${DRAFT}`,
      `/learn/${SLUG}/${ARCHIVED}`,
      `/courses/${DRAFT_SLUG}`,
      `/learn/${DRAFT_SLUG}/${DRAFT}`,
      "/sitemap.xml",
      "/robots.txt",
      "/sign-in",
      "/api/health",
      "/admin",
      "/admin/courses",
      ...ids.flatMap((id) => [`/admin/lessons/${id}`, `/admin/lessons/${id}/preview`]),
    ];
  }

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

  /** Each address as a document and as the router's payload, with the page's cookies. */
  async function fetchEvery(request: APIRequestContext, paths: string[]): Promise<string[]> {
    const bodies: string[] = [];
    for (const path of paths) {
      for (const headers of [{}, { RSC: "1" }]) {
        const response = await request.get(path, { headers, maxRedirects: 0 });
        bodies.push(`${path} ${JSON.stringify(headers)}\n${await response.text()}`);
      }
    }
    return bodies;
  }

  /** The content tables through the Data API, as anonymous or with a session. */
  async function dataApi(request: APIRequestContext, bearer: string | null): Promise<string[]> {
    const bodies: string[] = [];
    for (const table of ["courses", "chapters", "lessons", "lesson_solutions"]) {
      const response = await request.get(`${SUPABASE}/rest/v1/${table}?select=*`, {
        headers: {
          apikey: PUBLISHABLE_KEY,
          ...(bearer !== null && { Authorization: `Bearer ${bearer}` }),
        },
      });
      bodies.push(`${table}\n${await response.text()}`);
    }
    return bodies;
  }

  async function walk(page: Page): Promise<string[]> {
    const captured = captureResponses(page);
    const paths = addresses();
    for (const path of paths) {
      await page.goto(path);
      await page.waitForLoadState("networkidle");
    }
    const seen = (await Promise.all(captured.bodies)).filter((body) => body !== "");
    expect(seen.length, "text responses read from the browser").toBeGreaterThan(paths.length);
    return [...seen, ...(await fetchEvery(page.request, paths))];
  }

  test("[NFR-SEC-03] T-21: a guest receives no solution, wrong answer, draft or archived content", async ({
    page,
    request,
  }) => {
    const bodies = [...(await walk(page)), ...(await dataApi(request, null))];
    expect(leaks(bodies)).toEqual([]);
  });

  test("[NFR-SEC-03] T-21: a signed-in learner receives no solution, wrong answer, draft or archived content", async ({
    page,
    request,
  }) => {
    await signInWithCode(page, request, `canary-${stamp.slice(0, 12)}@example.com`);
    const bearer = await accessToken(page);
    const bodies = [...(await walk(page)), ...(await dataApi(request, bearer))];
    expect(leaks(bodies)).toEqual([]);
  });

  test("[NFR-SEC-03] T-21: the canary reads its own tokens back as the database's owner", () => {
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
