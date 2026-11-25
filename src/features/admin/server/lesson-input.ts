import "server-only";
import { z } from "zod";
import { trimmedText } from "@/domain/admin/course-details";
import { LESSON_LIMITS, lessonDraft } from "@/domain/admin/lesson-details";
import { CHECK_TEST_LIMIT, parseTestCases, TEST_CASE_LIMITS } from "@/grader/test-case";
import { GRADABLE_HASH } from "../gradable-hash";

// The inputs of the lesson editor's actions (docs/spec/03-experience.md
// section 7.4; FR-ADM-04, FR-ADM-10). The draft schema is shared with the
// editor (src/domain/admin/lesson-details.ts); the database checks the same
// limits again.

const id = z.uuid();
/** The `updated_at` the editor loaded: a save over a newer row is refused (FR-ADM-10). */
const loadedAt = z.iso.datetime({ offset: true });

/**
 * Up to 12 test cases, each parsed by the grader's one parser, with distinct
 * IDs (docs/spec/04-content-system.md section 2.1). A draft may have none;
 * publishing needs one, which the database checks.
 */
const testCases = z
  .array(z.unknown())
  .max(CHECK_TEST_LIMIT)
  .transform((items, context) => {
    if (items.length === 0) return [];
    const parsed = parseTestCases(items);
    if (parsed.ok) return parsed.value;
    context.addIssue({ code: "custom", message: parsed.error.code });
    return z.NEVER;
  });

export const saveLessonInput = z.strictObject({
  id,
  loadedAt,
  draft: lessonDraft,
  testCases,
  /** The hash of the gradable content the dashboard validated, when it passed (section 4.2). */
  validatedHash: z.string().regex(GRADABLE_HASH).optional(),
});

export const setLessonStatusInput = z.strictObject({
  id,
  loadedAt,
  status: z.enum(["draft", "published", "archived"]),
});

export const createLessonInput = z.strictObject({
  courseId: id,
  chapterId: id,
  title: trimmedText(1, LESSON_LIMITS.title),
});

export const renderPreviewInput = z.strictObject({
  markdown: z.string().max(LESSON_LIMITS.instructions),
});

const TEST_CASE_CHARACTERS =
  TEST_CASE_LIMITS.name +
  TEST_CASE_LIMITS.stdin +
  TEST_CASE_LIMITS.afterCode +
  TEST_CASE_LIMITS.expected +
  TEST_CASE_LIMITS.hint;

/**
 * A full draft is five pieces of code of 10,000 characters, 20,000 of
 * Markdown, 12 full test cases and short fields; four bytes a character
 * covers any text, and 256 bytes a test case its ID, keys and comparison.
 */
export const MAX_SAVE_LESSON_BYTES =
  4 * (5 * LESSON_LIMITS.code + LESSON_LIMITS.instructions) +
  CHECK_TEST_LIMIT * (4 * TEST_CASE_CHARACTERS + 256) +
  8 * 1024;

export const MAX_STATUS_BYTES = 1024;

export const MAX_PREVIEW_BYTES = 4 * LESSON_LIMITS.instructions + 1024;

export const MAX_CREATE_LESSON_BYTES = 2 * 1024;
