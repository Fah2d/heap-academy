import "server-only";
import { z } from "zod";
import { trimmedText } from "@/domain/admin/course-details";
import { LESSON_LIMITS, lessonDraft } from "@/domain/admin/lesson-details";

// The inputs of the lesson editor's actions (docs/spec/03-experience.md
// section 7.4; FR-ADM-04, FR-ADM-10). The draft schema is shared with the
// editor (src/domain/admin/lesson-details.ts); the database checks the same
// limits again.

const id = z.uuid();
/** The `updated_at` the editor loaded: a save over a newer row is refused (FR-ADM-10). */
const loadedAt = z.iso.datetime({ offset: true });

export const saveLessonInput = z.strictObject({ id, loadedAt, draft: lessonDraft });

export const createLessonInput = z.strictObject({
  courseId: id,
  chapterId: id,
  title: trimmedText(1, LESSON_LIMITS.title),
});

export const renderPreviewInput = z.strictObject({
  markdown: z.string().max(LESSON_LIMITS.instructions),
});

/**
 * A full draft is five pieces of code of 10,000 characters, 20,000 of
 * Markdown and short fields; four bytes a character covers any text.
 */
export const MAX_SAVE_LESSON_BYTES =
  4 * (5 * LESSON_LIMITS.code + LESSON_LIMITS.instructions) + 8 * 1024;

export const MAX_PREVIEW_BYTES = 4 * LESSON_LIMITS.instructions + 1024;

export const MAX_CREATE_LESSON_BYTES = 2 * 1024;
