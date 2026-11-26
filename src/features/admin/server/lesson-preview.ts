import "server-only";
import { z } from "zod";
import { parseLessonId } from "@/domain/ids";
import type { WorkspaceLesson } from "@/features/workspace";
import { parseTestCases } from "@/grader/test-case";
import type { SessionClient } from "@/infrastructure/db/session-client";

// One lesson for the admin's preview (docs/spec/03-experience.md section 7.7;
// FR-ADM-08), read through the admin's own session: row level security
// returns a draft only to an admin at aal2 (docs/spec/02-architecture.md
// section 7.3), so anyone else gets no row, and the page answers not-found.
// The read names no solution and no wrong answer: the preview's page sends
// the browser what a learner's page would.

const previewRow = z.object({
  id: z.string(),
  title: z.string(),
  slug: z.string(),
  xp: z.number().int(),
  instructions_md: z.string(),
  hints: z.array(z.string()),
  starter_code: z.string(),
  tests: z.array(z.unknown()),
  courses: z.object({ slug: z.string(), title: z.string() }),
});

export type PreviewLesson = { lesson: WorkspaceLesson; instructionsMd: string };

export type PreviewLessonResult = { ok: true; lesson: PreviewLesson | null } | { ok: false };

export function previewLesson(row: unknown): PreviewLessonResult {
  if (row === null) return { ok: true, lesson: null };
  const parsed = previewRow.safeParse(row);
  if (!parsed.success) return { ok: false };
  const lesson = parsed.data;
  const id = parseLessonId(lesson.id);
  if (id === undefined) return { ok: false };
  // The database checks every test case on write; a draft may have none.
  const tests =
    lesson.tests.length === 0 ? { ok: true as const, value: [] } : parseTestCases(lesson.tests);
  if (!tests.ok) return { ok: false };
  return {
    ok: true,
    lesson: {
      instructionsMd: lesson.instructions_md,
      lesson: {
        id,
        xp: lesson.xp,
        course: lesson.courses,
        slug: lesson.slug,
        title: lesson.title,
        starterCode: lesson.starter_code,
        hints: lesson.hints,
        tests: tests.value,
        // The preview shows no previous or next (see the workspace).
        neighbours: { previous: null, next: null },
      },
    },
  };
}

export async function lessonForPreview(
  db: SessionClient,
  id: string,
): Promise<PreviewLessonResult> {
  const { data, error } = await db
    .from("lessons")
    .select(
      "id, title, slug, xp, instructions_md, hints, starter_code, tests, courses(slug, title)",
    )
    .eq("id", id)
    .maybeSingle();
  if (error !== null) return { ok: false };
  return previewLesson(data);
}
