import "server-only";
import { z } from "zod";
import { parseTestCases } from "@/grader/test-case";
import type { SessionClient } from "@/infrastructure/db/session-client";
import type { EditorLessonResult } from "../types";

// One lesson for the lesson editor (docs/spec/03-experience.md section 7.4),
// read through the admin's own session: row level security returns a draft
// and the solution only to an admin at aal2 (docs/spec/02-architecture.md
// section 7.3), so anyone else gets no row, and the page answers not-found.

const status = z.enum(["draft", "published", "archived"]);
const wrongAnswers = z.array(z.object({ label: z.string(), code: z.string() }));
const solution = z.object({ solution_code: z.string(), wrong_answers: wrongAnswers });

const lessonRow = z.object({
  id: z.uuid(),
  course_id: z.uuid(),
  chapter_id: z.uuid(),
  title: z.string(),
  slug: z.string(),
  xp: z.number().int(),
  status,
  instructions_md: z.string(),
  hints: z.array(z.string()),
  starter_code: z.string(),
  tests: z.array(z.unknown()),
  updated_at: z.string(),
  // One row or none; the client may give either an object or a list.
  lesson_solutions: z.union([solution, z.array(solution).max(1), z.null()]),
  courses: z.object({
    title: z.string(),
    chapters: z.array(z.object({ id: z.uuid(), title: z.string(), position: z.number().int() })),
  }),
});

export function editorLesson(row: unknown): EditorLessonResult {
  if (row === null) return { ok: true, lesson: null };
  const parsed = lessonRow.safeParse(row);
  if (!parsed.success) return { ok: false };
  const lesson = parsed.data;
  // The database checks every test case on write; a draft may have none.
  const tests =
    lesson.tests.length === 0 ? { ok: true as const, value: [] } : parseTestCases(lesson.tests);
  if (!tests.ok) return { ok: false };
  const stored = Array.isArray(lesson.lesson_solutions)
    ? lesson.lesson_solutions[0]
    : lesson.lesson_solutions;
  return {
    ok: true,
    lesson: {
      id: lesson.id,
      courseId: lesson.course_id,
      courseTitle: lesson.courses.title,
      chapterId: lesson.chapter_id,
      chapters: [...lesson.courses.chapters]
        .sort((a, b) => a.position - b.position)
        .map((chapter) => ({ id: chapter.id, title: chapter.title })),
      title: lesson.title,
      slug: lesson.slug,
      xp: lesson.xp,
      status: lesson.status,
      instructionsMd: lesson.instructions_md,
      hints: lesson.hints,
      starterCode: lesson.starter_code,
      solutionCode: stored?.solution_code ?? "",
      wrongAnswers: stored?.wrong_answers ?? [],
      testCases: tests.value,
      loadedAt: lesson.updated_at,
    },
  };
}

export async function lessonForEditor(db: SessionClient, id: string): Promise<EditorLessonResult> {
  const { data, error } = await db
    .from("lessons")
    .select(
      "id, course_id, chapter_id, title, slug, xp, status, instructions_md, hints, starter_code, tests, updated_at, lesson_solutions(solution_code, wrong_answers), courses(title, chapters(id, title, position))",
    )
    .eq("id", id)
    .maybeSingle();
  if (error !== null) return { ok: false };
  return editorLesson(data);
}
