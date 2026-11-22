import "server-only";
import { z } from "zod";
import { courseDetails, trimmedText as text } from "@/domain/admin/course-details";

// The inputs of the course structure actions (docs/spec/04-content-system.md
// sections 1.1 and 1.2; FR-ADM-03, FR-ADM-10). The course details schema is
// shared with the editor (src/domain/admin/course-details.ts). The database
// checks the same limits again (migration 20261120120100_content_checks.sql).

const id = z.uuid();
/** The `updated_at` the editor loaded: a save over a newer row is refused (FR-ADM-10). */
const loadedAt = z.iso.datetime({ offset: true });

export const saveCourseInput = z.union([
  z.strictObject({ details: courseDetails }),
  z.strictObject({ id, loadedAt, details: courseDetails }),
]);

export const setCourseStatusInput = z.strictObject({
  id,
  loadedAt,
  status: z.enum(["draft", "published", "archived"]),
});

const chapterText = { title: text(1, 60), summary: text(0, 140) };

/** A new chapter, or a rename that names the version it loaded (FR-ADM-10). */
export const saveChapterInput = z.union([
  z.strictObject({ courseId: id, ...chapterText }),
  z.strictObject({ courseId: id, id, loadedAt, ...chapterText }),
]);

export const deleteChapterInput = z.strictObject({ id });

export const reorderInput = z.union([
  z.strictObject({ kind: z.literal("course"), id, direction: z.enum(["up", "down"]) }),
  z.strictObject({
    kind: z.literal("chapter"),
    courseId: id,
    id,
    direction: z.enum(["up", "down"]),
  }),
]);

/** Every structure input is small: five outcomes of 140 characters is the largest. */
export const MAX_STRUCTURE_BYTES = 8 * 1024;
