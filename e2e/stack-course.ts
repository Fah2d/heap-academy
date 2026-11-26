import { expect, type APIRequestContext } from "@playwright/test";
import { EXAMPLE_LESSON } from "../src/grader/example-lesson";
import { sql } from "./admin-helpers";
import type { Target } from "./journeys";

// A published course for the journeys that walk real lesson addresses on the
// local stack. Each lesson is the example lesson with its own slug and title,
// written as the seed writes its sample course: saved through save_lesson as
// validated, then published, so the publish rule holds. The addresses are
// new, so no cached lesson read answers for them. The course list is cached
// too, for up to a minute, and a course missing from it answers 404, so a
// journey waits with `onSite` until a guest would see the course, as J-8
// does. `remove` deletes the course; it
// refuses while a completion still points at one of its lessons, so a
// journey that completes lessons deletes its learner's completions first.

export const LESSON_XP = 10;

// The cached course list's minute (CONTENT_REVALIDATE_SECONDS), and one more
// read: the first read after the minute is answered from the old list while
// the list is read again.
export const ON_SITE_MS = 75_000;

export type StackCourse = {
  title: string;
  slug: string;
  /** One target per lesson, in course order, each with its following lesson. */
  lessons: readonly Target[];
  write: () => void;
  /** Waits until every lesson address answers 200, as a guest would see it. */
  onSite: (request: APIRequestContext) => Promise<void>;
  remove: () => void;
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
    '${slug}', '${title}', ${String(position)}, ${String(LESSON_XP)},
    $md$${EXAMPLE_LESSON.instructions}$md$,
    $json$${JSON.stringify(EXAMPLE_LESSON.hints)}$json$,
    $py$${EXAMPLE_LESSON.starter}$py$,
    $json$${JSON.stringify(tests)}$json$,
    $py$${EXAMPLE_LESSON.solution}$py$,
    $json$${JSON.stringify(wrongAnswers)}$json$,
    true);
  update public.lessons set status = 'published' where id = lesson;`;
}

export function stackCourse(
  slug: string,
  title: string,
  lessons: readonly { slug: string; title: string }[],
  summary: string,
): StackCourse {
  const address = (lesson: string) => `/learn/${slug}/${lesson}`;
  const course = { title, slug };
  const targets = lessons.map((lesson, index): Target => {
    const following = lessons[index + 1];
    return {
      address: address(lesson.slug),
      title: lesson.title,
      xp: LESSON_XP,
      course,
      next:
        following === undefined
          ? null
          : { href: address(following.slug), title: following.title, follow: true },
    };
  });
  return {
    title,
    slug,
    lessons: targets,
    write: () => {
      sql(`do $journey$
declare
  course uuid := gen_random_uuid();
  chapter uuid := gen_random_uuid();
  lesson uuid;
begin
  insert into public.courses (id, slug, title, summary) values (
    course, '${slug}', '${title}', '${summary}');
  insert into public.chapters (id, course_id, title) values (chapter, course, 'Input and output');
  ${lessons.map((lesson, position) => lessonStatements(lesson.slug, lesson.title, position)).join("\n")}
  update public.courses set status = 'published' where id = course;
end;
$journey$;`);
    },
    onSite: async (request) => {
      await expect
        .poll(
          () =>
            Promise.all(
              targets.map(async (target) => (await request.get(target.address)).status()),
            ),
          { timeout: ON_SITE_MS, intervals: [1_000] },
        )
        .toEqual(targets.map(() => 200));
    },
    remove: () => {
      const id = `(select id from public.courses where slug = '${slug}')`;
      sql(`delete from public.lessons where course_id = ${id};
delete from public.chapters where course_id = ${id};
delete from public.courses where slug = '${slug}';`);
    },
  };
}
