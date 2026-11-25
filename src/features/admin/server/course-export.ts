import "server-only";
import { z } from "zod";
import { parseTestCases } from "@/grader/test-case";
import type { SessionClient } from "@/infrastructure/db/session-client";
import { type CourseFile, courseFile, type ExportedLesson } from "../lesson-file";

// A course as one JSON file (docs/spec/04-content-system.md section 8;
// FR-ADM-12), read through the admin's own session: row level security gives
// drafts and solutions only to an admin at aal2, so anyone else gets no row.
// Every chapter and lesson is in it, in the order learners see them, whatever
// its status; the file carries no status and no IDs.

const wrongAnswers = z.array(z.object({ label: z.string(), code: z.string() }));
const solution = z.object({ solution_code: z.string(), wrong_answers: wrongAnswers });

const lessonRow = z.object({
  id: z.uuid(),
  position: z.number().int(),
  title: z.string(),
  slug: z.string(),
  xp: z.number().int(),
  instructions_md: z.string(),
  hints: z.array(z.string()),
  starter_code: z.string(),
  tests: z.array(z.unknown()),
  // One row or none; the client may give either an object or a list.
  lesson_solutions: z.union([solution, z.array(solution).max(1), z.null()]),
});

const courseRow = z.object({
  title: z.string(),
  slug: z.string(),
  summary: z.string(),
  outcomes: z.array(z.string()),
  chapters: z.array(
    z.object({
      id: z.uuid(),
      position: z.number().int(),
      title: z.string(),
      summary: z.string(),
      lessons: z.array(lessonRow),
    }),
  ),
});

/** In position order; two rows that share a position stay in one order, by ID. */
const byPosition = (a: { position: number; id: string }, b: { position: number; id: string }) =>
  a.position - b.position || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);

function exported(row: z.infer<typeof lessonRow>): ExportedLesson | undefined {
  const tests =
    row.tests.length === 0 ? { ok: true as const, value: [] } : parseTestCases(row.tests);
  if (!tests.ok) return undefined;
  const stored = Array.isArray(row.lesson_solutions)
    ? row.lesson_solutions[0]
    : row.lesson_solutions;
  return {
    title: row.title,
    slug: row.slug,
    xp: row.xp,
    instructionsMd: row.instructions_md,
    hints: row.hints,
    starterCode: row.starter_code,
    solutionCode: stored?.solution_code ?? "",
    wrongAnswers: stored?.wrong_answers ?? [],
    testCases: tests.value,
  };
}

/** `broken`: a stored lesson's test cases do not parse, so the file would not import again. */
export type CourseExport =
  { ok: true; file: CourseFile | null } | { ok: false; reason: "unavailable" | "broken" };

/** The course file for one row as the query below returns it; null for no row. */
export function courseExport(row: unknown): CourseExport {
  if (row === null) return { ok: true, file: null };
  const parsed = courseRow.safeParse(row);
  if (!parsed.success) return { ok: false, reason: "unavailable" };
  const chapters: { title: string; summary: string; lessons: ExportedLesson[] }[] = [];
  for (const chapter of [...parsed.data.chapters].sort(byPosition)) {
    const lessons: ExportedLesson[] = [];
    for (const lesson of [...chapter.lessons].sort(byPosition)) {
      const one = exported(lesson);
      // The database checks every test case on write, so this is a broken row.
      if (one === undefined) return { ok: false, reason: "broken" };
      lessons.push(one);
    }
    chapters.push({ title: chapter.title, summary: chapter.summary, lessons });
  }
  return { ok: true, file: courseFile({ ...parsed.data, chapters }) };
}

export async function readCourseExport(db: SessionClient, id: string): Promise<CourseExport> {
  const { data, error } = await db
    .from("courses")
    .select(
      "title, slug, summary, outcomes, chapters(id, position, title, summary, lessons(id, position, title, slug, xp, instructions_md, hints, starter_code, tests, lesson_solutions(solution_code, wrong_answers)))",
    )
    .eq("id", id)
    .maybeSingle();
  if (error !== null) return { ok: false, reason: "unavailable" };
  return courseExport(data);
}
