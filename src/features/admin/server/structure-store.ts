import "server-only";
import { type ContentStatus, type Direction, moveInOrder } from "@/domain/admin/structure";
import type { SessionClient } from "@/infrastructure/db/session-client";
import type { CourseDetails } from "@/domain/admin/course-details";

// Course structure through the admin's own session (docs/spec/02-architecture.md
// sections 8.2 and 9.1): row level security lets only an admin at aal2 write,
// and the triggers enforce the publish rule. Each database answer becomes one
// outcome the editor can explain.

export type StructureFailure =
  /** Another course has this address. */
  | "slug_taken"
  /** Saved by someone else, or in another tab, since the editor loaded it (FR-ADM-10). */
  | "stale"
  /** A course needs a published lesson to be published (FR-ADM-03). */
  | "no_published_lesson"
  /** The status cannot move this way (docs/spec/04-content-system.md section 4.3). */
  | "status_not_allowed"
  /** A chapter that still has lessons cannot be deleted. */
  | "chapter_has_lessons"
  /** The item is first or last already, or the order changed meanwhile. */
  | "cannot_move"
  | "not_found"
  | "unavailable";

type DbError = { code?: string; message?: string } | null;

/**
 * The outcome for a database error. A broken reference (23503) means a
 * chapter that still has lessons when deleting, and a course that is gone
 * when adding a chapter to it.
 */
export function structureFailure(
  error: DbError,
  reference: "chapter_has_lessons" | "not_found" = "chapter_has_lessons",
): StructureFailure {
  if (error === null) return "unavailable";
  if (error.code === "23505") return "slug_taken";
  if (error.code === "23503") return reference;
  if (error.code === "P0001" && error.message === "course_has_no_published_lesson") {
    return "no_published_lesson";
  }
  if (error.code === "P0001" && error.message === "order_out_of_date") return "cannot_move";
  return "unavailable";
}

type Outcome<Value> = { ok: true; value: Value } | { ok: false; error: StructureFailure };

const toDb = (details: CourseDetails) => ({
  title: details.title,
  slug: details.slug,
  summary: details.summary,
  outcomes: details.outcomes,
});

export async function createCourse(
  db: SessionClient,
  details: CourseDetails,
): Promise<Outcome<{ id: string }>> {
  // New courses go last in the list.
  const { data: last } = await db
    .from("courses")
    .select("position")
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle();
  const position = typeof last?.position === "number" ? last.position + 1 : 0;
  const { data, error } = await db
    .from("courses")
    .insert({ ...toDb(details), position })
    .select("id")
    .single();
  if (error !== null || typeof data?.id !== "string")
    return { ok: false, error: structureFailure(error) };
  return { ok: true, value: { id: data.id } };
}

/** Updates a course only if it is still the row the editor loaded. */
async function updateCourse(
  db: SessionClient,
  id: string,
  loadedAt: string,
  values: Record<string, unknown>,
): Promise<Outcome<{ updatedAt: string }>> {
  const { data, error } = await db
    .from("courses")
    .update(values)
    .eq("id", id)
    .eq("updated_at", loadedAt)
    .select("updated_at")
    .maybeSingle();
  if (error !== null) return { ok: false, error: structureFailure(error) };
  if (typeof data?.updated_at !== "string") {
    // No row: newer than the editor's copy, or gone.
    const { data: exists } = await db.from("courses").select("id").eq("id", id).maybeSingle();
    return { ok: false, error: exists === null ? "not_found" : "stale" };
  }
  return { ok: true, value: { updatedAt: data.updated_at } };
}

export function saveCourseDetails(
  db: SessionClient,
  id: string,
  loadedAt: string,
  details: CourseDetails,
): Promise<Outcome<{ updatedAt: string }>> {
  return updateCourse(db, id, loadedAt, toDb(details));
}

export async function setCourseStatus(
  db: SessionClient,
  id: string,
  loadedAt: string,
  status: ContentStatus,
  allowed: (from: ContentStatus) => boolean,
): Promise<Outcome<{ updatedAt: string }>> {
  const { data } = await db.from("courses").select("status").eq("id", id).maybeSingle();
  const from = data?.status as ContentStatus | undefined;
  if (from === undefined) return { ok: false, error: "not_found" };
  if (!allowed(from)) return { ok: false, error: "status_not_allowed" };
  return updateCourse(db, id, loadedAt, { status });
}

export type ChapterSave =
  | { courseId: string; title: string; summary: string }
  | { courseId: string; id: string; loadedAt: string; title: string; summary: string };

export async function saveChapter(
  db: SessionClient,
  chapter: ChapterSave,
): Promise<Outcome<{ id: string }>> {
  if ("id" in chapter) {
    // Written only if the chapter is still the version the editor loaded.
    const { data, error } = await db
      .from("chapters")
      .update({ title: chapter.title, summary: chapter.summary })
      .eq("id", chapter.id)
      .eq("course_id", chapter.courseId)
      .eq("updated_at", chapter.loadedAt)
      .select("id")
      .maybeSingle();
    if (error !== null) return { ok: false, error: structureFailure(error) };
    if (typeof data?.id === "string") return { ok: true, value: { id: data.id } };
    // No row: newer than the editor's copy, or gone.
    const { data: exists } = await db
      .from("chapters")
      .select("id")
      .eq("id", chapter.id)
      .maybeSingle();
    return { ok: false, error: exists === null ? "not_found" : "stale" };
  }
  const { data: last } = await db
    .from("chapters")
    .select("position")
    .eq("course_id", chapter.courseId)
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle();
  const position = typeof last?.position === "number" ? last.position + 1 : 0;
  const { data, error } = await db
    .from("chapters")
    .insert({
      course_id: chapter.courseId,
      title: chapter.title,
      summary: chapter.summary,
      position,
    })
    .select("id")
    .single();
  if (error !== null || typeof data?.id !== "string")
    return { ok: false, error: structureFailure(error, "not_found") };
  return { ok: true, value: { id: data.id } };
}

export async function deleteChapter(db: SessionClient, id: string): Promise<Outcome<null>> {
  const { data, error } = await db.from("chapters").delete().eq("id", id).select("id");
  if (error !== null) return { ok: false, error: structureFailure(error) };
  if (!Array.isArray(data) || data.length === 0) return { ok: false, error: "not_found" };
  return { ok: true, value: null };
}

/** What a move acts on: a course, or a chapter or lesson inside its parent. */
export type MoveTarget =
  | { kind: "course"; id: string }
  | { kind: "chapter"; courseId: string; id: string }
  | { kind: "lesson"; chapterId: string; id: string };

/** Moves one course, chapter or lesson a place, rewriting the whole order in one statement. */
export async function move(
  db: SessionClient,
  target: MoveTarget,
  direction: Direction,
): Promise<Outcome<null>> {
  const query =
    target.kind === "course"
      ? db.from("courses").select("id").order("position").order("title")
      : target.kind === "chapter"
        ? db
            .from("chapters")
            .select("id")
            .eq("course_id", target.courseId)
            .order("position")
            .order("id")
        : db
            .from("lessons")
            .select("id")
            .eq("chapter_id", target.chapterId)
            .order("position")
            .order("id");
  const { data, error } = await query;
  if (error !== null || !Array.isArray(data)) return { ok: false, error: structureFailure(error) };
  const order = moveInOrder(
    data.map((row: { id: unknown }) => String(row.id)),
    target.id,
    direction,
  );
  if (order === undefined) return { ok: false, error: "cannot_move" };
  const { error: moveError } =
    target.kind === "course"
      ? await db.rpc("reorder_courses", { p_course_ids: order })
      : target.kind === "chapter"
        ? await db.rpc("reorder_chapters", { p_course_id: target.courseId, p_chapter_ids: order })
        : await db.rpc("reorder_lessons", { p_chapter_id: target.chapterId, p_lesson_ids: order });
  if (moveError !== null) return { ok: false, error: structureFailure(moveError) };
  return { ok: true, value: null };
}
