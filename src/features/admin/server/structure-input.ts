import "server-only";
import { z } from "zod";

// The inputs of the course structure actions (docs/spec/04-content-system.md
// sections 1.1 and 1.2; FR-ADM-03, FR-ADM-10). The database checks the same
// limits again (migration 20261120120100_content_checks.sql).

const text = (min: number, max: number) =>
  z
    .string()
    .max(max * 4)
    .transform((value) => value.trim())
    .pipe(z.string().min(min).max(max));

export const SLUG_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;

export const courseDetails = z.strictObject({
  title: text(1, 60),
  slug: z.string().max(60).pipe(z.string().regex(SLUG_PATTERN)),
  summary: text(1, 140),
  outcomes: z.array(text(1, 140)).max(5),
});

export type CourseDetails = z.infer<typeof courseDetails>;

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

export const saveChapterInput = z.strictObject({
  courseId: id,
  id: id.optional(),
  title: text(1, 60),
  summary: text(0, 140),
});

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
