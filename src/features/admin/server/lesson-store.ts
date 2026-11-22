import "server-only";
import { freeSlug, type LessonDraft, slugFromTitle } from "@/domain/admin/lesson-details";
import type { SessionClient } from "@/infrastructure/db/session-client";

// Lessons through the admin's own session (docs/spec/02-architecture.md
// sections 8.3 and 9.1): row level security lets only an admin at aal2 read
// a draft or a solution and write anything; `save_lesson` writes the lesson,
// its solution and its wrong answers in one transaction and refuses a stale
// copy; the triggers keep a published lesson validated.

export type LessonFailure =
  /** Another lesson of this course has this address. */
  | "slug_taken"
  /** Saved by someone else, or in another tab, since the editor loaded it (FR-ADM-10). */
  | "stale"
  /**
   * The lesson is published, and the change touches the starter, the solution,
   * the wrong answers or the test cases, which needs a passing validation in
   * the same save (docs/spec/04-content-system.md section 4.4).
   */
  | "needs_validation"
  /** A published lesson needs instructions and a test case (section 1.3). */
  | "published_incomplete"
  /** The chapter is not one of this lesson's course. */
  | "chapter_not_found"
  /** The title leaves nothing to make an address from, as in another script. */
  | "slug_needed"
  | "not_found"
  | "unavailable";

type DbError = { code?: string; message?: string } | null;

export function lessonFailure(error: DbError): LessonFailure {
  if (error === null) return "unavailable";
  if (error.code === "23505") return "slug_taken";
  if (error.code === "23503") return "chapter_not_found";
  if (error.code === "23514" && error.message?.includes("lessons_published_complete") === true) {
    return "published_incomplete";
  }
  if (error.code === "P0001") {
    if (error.message === "lesson_changed_since_loaded") return "stale";
    if (error.message === "lesson_not_found") return "not_found";
    if (error.message === "lesson_not_validated") return "needs_validation";
  }
  return "unavailable";
}

type Outcome<Value> = { ok: true; value: Value } | { ok: false; error: LessonFailure };

/**
 * Saves a draft over the version the editor loaded. The lesson keeps its
 * test cases (the test case editor is WP-4.3) and its place, read as it is
 * now: a move from the course editor keeps the lesson's version, so the
 * position the editor loaded may be out of date. A lesson moved to another
 * chapter goes last in it. Returns the new version, as Postgres wrote it.
 */
export async function saveLesson(
  db: SessionClient,
  id: string,
  loadedAt: string,
  draft: LessonDraft,
): Promise<Outcome<{ updatedAt: string }>> {
  const { data: current, error: readError } = await db
    .from("lessons")
    .select("chapter_id, position, tests")
    .eq("id", id)
    .maybeSingle();
  if (readError !== null) return { ok: false, error: lessonFailure(readError) };
  if (current === null) return { ok: false, error: "not_found" };
  let position = typeof current.position === "number" ? current.position : 0;
  if (current.chapter_id !== draft.chapterId) {
    const { data: last } = await db
      .from("lessons")
      .select("position")
      .eq("chapter_id", draft.chapterId)
      .order("position", { ascending: false })
      .limit(1)
      .maybeSingle();
    position = typeof last?.position === "number" ? last.position + 1 : 0;
  }
  const { data, error } = await db.rpc("save_lesson", {
    p_lesson_id: id,
    p_loaded_updated_at: loadedAt,
    p_chapter_id: draft.chapterId,
    p_slug: draft.slug,
    p_title: draft.title,
    p_position: position,
    p_xp: draft.xp,
    p_instructions_md: draft.instructionsMd,
    p_hints: draft.hints,
    p_starter_code: draft.starterCode,
    p_tests: current.tests,
    p_solution_code: draft.solutionCode,
    p_wrong_answers: draft.wrongAnswers,
    p_validated: false,
  });
  if (error !== null) return { ok: false, error: lessonFailure(error) };
  if (typeof data !== "string") return { ok: false, error: "unavailable" };
  return { ok: true, value: { updatedAt: data } };
}

/**
 * A new draft lesson at the end of a chapter, with an address made from its
 * title (docs/spec/03-experience.md section 7.3: "add a lesson creates a
 * draft and opens it"). Its solution row starts empty.
 */
export async function createLesson(
  db: SessionClient,
  lesson: { courseId: string; chapterId: string; title: string },
): Promise<Outcome<{ id: string }>> {
  const base = slugFromTitle(lesson.title);
  if (base === undefined) return { ok: false, error: "slug_needed" };
  const { data: chapter } = await db
    .from("chapters")
    .select("id")
    .eq("id", lesson.chapterId)
    .eq("course_id", lesson.courseId)
    .maybeSingle();
  if (chapter === null) return { ok: false, error: "chapter_not_found" };
  const { data: siblings, error: listError } = await db
    .from("lessons")
    .select("slug, chapter_id, position")
    .eq("course_id", lesson.courseId);
  if (listError !== null || !Array.isArray(siblings)) {
    return { ok: false, error: lessonFailure(listError) };
  }
  const rows = siblings as { slug: unknown; chapter_id: unknown; position: unknown }[];
  const taken = new Set(rows.map((row) => String(row.slug)));
  const positions = rows
    .filter((row) => row.chapter_id === lesson.chapterId && typeof row.position === "number")
    .map((row) => row.position as number);
  const { data, error } = await db
    .from("lessons")
    .insert({
      course_id: lesson.courseId,
      chapter_id: lesson.chapterId,
      title: lesson.title,
      slug: freeSlug(base, taken),
      position: positions.length === 0 ? 0 : Math.max(...positions) + 1,
    })
    .select("id")
    .single();
  if (error !== null || typeof data?.id !== "string") {
    return { ok: false, error: lessonFailure(error) };
  }
  return { ok: true, value: { id: data.id } };
}
