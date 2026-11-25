import { z } from "zod";

// A course's details as the owner writes them (docs/spec/04-content-system.md
// section 1.1; FR-ADM-03). The editor checks them before it sends, to name the
// field that is wrong; the server action parses them again, and the database
// checks the same limits a third time (migration 20261120120100_content_checks.sql).

/** Trimmed text of `min` to `max` characters. Far longer input is refused before trimming. */
export const trimmedText = (min: number, max: number) =>
  z
    .string()
    .max(max * 4)
    .transform((value) => value.trim())
    .pipe(z.string().min(min).max(max));

export const SLUG_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;

export const MAX_OUTCOMES = 5;

export const courseDetails = z.strictObject({
  title: trimmedText(1, 60),
  slug: z.string().max(60).pipe(z.string().regex(SLUG_PATTERN)),
  summary: trimmedText(1, 140),
  outcomes: z.array(trimmedText(1, 140)).max(MAX_OUTCOMES),
});

export type CourseDetails = z.infer<typeof courseDetails>;

/** What the editor's fields hold: five outcome lines, any of them empty. */
export type CourseFields = {
  title: string;
  slug: string;
  summary: string;
  outcomes: readonly string[];
};

export type CourseField = "title" | "slug" | "summary" | "outcome";

export type CheckedDetails =
  | { ok: true; details: CourseDetails }
  | { ok: false; invalid: { field: CourseField; index?: number }[] };

/**
 * The details to send, or every field that is wrong. Empty outcome lines are
 * dropped, so the owner can leave any of the five blank.
 */
export function checkCourseFields(fields: CourseFields): CheckedDetails {
  const outcomes = fields.outcomes.filter((line) => line.trim() !== "");
  const invalid: { field: CourseField; index?: number }[] = [];
  if (!courseDetails.shape.title.safeParse(fields.title).success) invalid.push({ field: "title" });
  if (!courseDetails.shape.slug.safeParse(fields.slug).success) invalid.push({ field: "slug" });
  if (!courseDetails.shape.summary.safeParse(fields.summary).success) {
    invalid.push({ field: "summary" });
  }
  const line = trimmedText(1, 140);
  fields.outcomes.forEach((value, index) => {
    if (value.trim() !== "" && !line.safeParse(value).success) {
      invalid.push({ field: "outcome", index });
    }
  });
  if (invalid.length > 0) return { ok: false, invalid };
  // Only the four fields: a caller may hand over a whole course.
  const parsed = courseDetails.safeParse({
    title: fields.title,
    slug: fields.slug,
    summary: fields.summary,
    outcomes,
  });
  // Only a sixth outcome line is left to refuse; the editor shows five.
  return parsed.success
    ? { ok: true, details: parsed.data }
    : { ok: false, invalid: [{ field: "outcome", index: MAX_OUTCOMES }] };
}
