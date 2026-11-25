import "server-only";
import { z } from "zod";
import { freeSlug, type LessonDraft, slugFromTitle } from "@/domain/admin/lesson-details";
import type { ContentStatus } from "@/domain/admin/structure";
import type { TestCase } from "@/grader/test-case";
import type { SessionClient } from "@/infrastructure/db/session-client";
import type { LessonFile } from "../lesson-file";

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
  /** The status cannot move this way (docs/spec/04-content-system.md section 4.3). */
  | "status_not_allowed"
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
 * Saves a draft and its test cases over the version the editor loaded, and
 * marks it validated when `validated` is true; the caller decides that from
 * the hash (section 4.2). The lesson keeps its place: a move from the course
 * editor keeps the lesson's version, so save_lesson ignores the position it
 * is given unless the chapter changes, and a move that lands between this
 * read and the save is kept. A lesson moved to another chapter goes last in
 * it. Returns the new version, as Postgres wrote it.
 */
export async function saveLesson(
  db: SessionClient,
  id: string,
  loadedAt: string,
  draft: LessonDraft,
  testCases: readonly TestCase[],
  validated: boolean,
): Promise<Outcome<{ updatedAt: string }>> {
  const { data: current, error: readError } = await db
    .from("lessons")
    .select("chapter_id, position")
    .eq("id", id)
    .maybeSingle();
  if (readError !== null) return { ok: false, error: lessonFailure(readError) };
  if (current === null) return { ok: false, error: "not_found" };
  let position = typeof current.position === "number" ? current.position : 0;
  if (current.chapter_id !== draft.chapterId) {
    const { data: last, error: lastError } = await db
      .from("lessons")
      .select("position")
      .eq("chapter_id", draft.chapterId)
      .order("position", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (lastError !== null) return { ok: false, error: lessonFailure(lastError) };
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
    p_tests: testCases,
    p_solution_code: draft.solutionCode,
    p_wrong_answers: draft.wrongAnswers,
    p_validated: validated,
  });
  if (error !== null) return { ok: false, error: lessonFailure(error) };
  if (typeof data !== "string") return { ok: false, error: "unavailable" };
  return { ok: true, value: { updatedAt: data } };
}

const storedStatus = z.enum(["draft", "published", "archived"]);

/**
 * Publishes, unpublishes or archives the version the editor loaded. The
 * database refuses to publish a lesson that was not validated since its last
 * gradable change (T-22), whatever this function is asked.
 */
export async function setLessonStatus(
  db: SessionClient,
  id: string,
  loadedAt: string,
  status: ContentStatus,
  allowed: (from: ContentStatus) => boolean,
): Promise<Outcome<{ updatedAt: string }>> {
  const { data: current, error: readError } = await db
    .from("lessons")
    .select("status")
    .eq("id", id)
    .maybeSingle();
  if (readError !== null) return { ok: false, error: lessonFailure(readError) };
  if (current === null) return { ok: false, error: "not_found" };
  const parsed = storedStatus.safeParse(current.status);
  if (!parsed.success) return { ok: false, error: "unavailable" };
  const from: ContentStatus = parsed.data;
  if (!allowed(from)) return { ok: false, error: "status_not_allowed" };
  const { data, error } = await db
    .from("lessons")
    .update({ status })
    .eq("id", id)
    .eq("updated_at", loadedAt)
    .select("updated_at")
    .maybeSingle();
  if (error !== null) return { ok: false, error: lessonFailure(error) };
  if (typeof data?.updated_at !== "string") {
    // No row: newer than the editor's copy, or gone since the read.
    const { data: exists } = await db.from("lessons").select("id").eq("id", id).maybeSingle();
    return { ok: false, error: exists === null ? "not_found" : "stale" };
  }
  return { ok: true, value: { updatedAt: data.updated_at } };
}

type Placement = { taken: ReadonlySet<string>; position: number };

/**
 * Where a new lesson goes: the chapter must be one of the course's, and the
 * lesson goes last in it. Also every address the course's lessons use.
 */
async function placeNewLesson(
  db: SessionClient,
  courseId: string,
  chapterId: string,
): Promise<Outcome<Placement>> {
  const { data: chapter, error: chapterError } = await db
    .from("chapters")
    .select("id")
    .eq("id", chapterId)
    .eq("course_id", courseId)
    .maybeSingle();
  if (chapterError !== null) return { ok: false, error: lessonFailure(chapterError) };
  if (chapter === null) return { ok: false, error: "chapter_not_found" };
  const { data: siblings, error: listError } = await db
    .from("lessons")
    .select("slug, chapter_id, position")
    .eq("course_id", courseId);
  if (listError !== null || !Array.isArray(siblings)) {
    return { ok: false, error: lessonFailure(listError) };
  }
  const rows = siblings as { slug: unknown; chapter_id: unknown; position: unknown }[];
  const positions = rows
    .filter((row) => row.chapter_id === chapterId && typeof row.position === "number")
    .map((row) => row.position as number);
  return {
    ok: true,
    value: {
      taken: new Set(rows.map((row) => String(row.slug))),
      position: positions.length === 0 ? 0 : Math.max(...positions) + 1,
    },
  };
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
  const place = await placeNewLesson(db, lesson.courseId, lesson.chapterId);
  if (!place.ok) return place;
  const { data, error } = await db
    .from("lessons")
    .insert({
      course_id: lesson.courseId,
      chapter_id: lesson.chapterId,
      title: lesson.title,
      slug: freeSlug(base, place.value.taken),
      position: place.value.position,
    })
    .select("id")
    .single();
  if (error !== null || typeof data?.id !== "string") {
    // The address was free when read; a lesson added since took it. The add
    // form has no address field to point at, so this is a failure to retry.
    const failure = lessonFailure(error);
    return { ok: false, error: failure === "slug_taken" ? "unavailable" : failure };
  }
  return { ok: true, value: { id: data.id } };
}

/**
 * An imported lesson (docs/spec/04-content-system.md section 8; FR-ADM-12,
 * T-23): a new draft at the end of the chapter holding exactly the file's
 * content, never marked validated, so it is published like any other lesson,
 * through a passing validation. Nothing runs here. When another lesson of the
 * course has the file's address, the draft gets the next free one, as an
 * added lesson does. The row is created, then filled through save_lesson, so
 * the solution is written by the same function as every save; if the fill
 * fails, the empty row is deleted again.
 */
export async function importLesson(
  db: SessionClient,
  target: { courseId: string; chapterId: string },
  lesson: LessonFile,
): Promise<Outcome<{ id: string; slug: string }>> {
  const place = await placeNewLesson(db, target.courseId, target.chapterId);
  if (!place.ok) return place;
  const slug = freeSlug(lesson.slug, place.value.taken);
  const { data: created, error: createError } = await db
    .from("lessons")
    .insert({
      course_id: target.courseId,
      chapter_id: target.chapterId,
      title: lesson.title,
      slug,
      position: place.value.position,
    })
    .select("id, updated_at")
    .single();
  if (
    createError !== null ||
    typeof created?.id !== "string" ||
    typeof created.updated_at !== "string"
  ) {
    const failure = lessonFailure(createError);
    return { ok: false, error: failure === "slug_taken" ? "unavailable" : failure };
  }
  const { data: saved, error: saveError } = await db.rpc("save_lesson", {
    p_lesson_id: created.id,
    p_loaded_updated_at: created.updated_at,
    p_chapter_id: target.chapterId,
    p_slug: slug,
    p_title: lesson.title,
    p_position: place.value.position,
    p_xp: lesson.xp,
    p_instructions_md: lesson.instructions_md,
    p_hints: lesson.hints,
    p_starter_code: lesson.starter_code,
    p_tests: lesson.tests,
    p_solution_code: lesson.solution_code,
    p_wrong_answers: lesson.wrong_answers,
    p_validated: false,
  });
  if (saveError !== null || typeof saved !== "string") {
    await db.from("lessons").delete().eq("id", created.id);
    return { ok: false, error: saveError === null ? "unavailable" : lessonFailure(saveError) };
  }
  return { ok: true, value: { id: created.id, slug } };
}
