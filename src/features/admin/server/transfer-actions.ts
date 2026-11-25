"use server";

import "server-only";
import { z } from "zod";
import { defineAction } from "@/infrastructure/actions/server-action";
import { courseFileName, fileText, parseLessonFile } from "../lesson-file";
import { readCourseExport } from "./course-export";
import { MAX_SAVE_LESSON_BYTES } from "./lesson-input";
import { importLesson as storeImport } from "./lesson-store";

// Export and import (docs/spec/04-content-system.md section 8;
// docs/spec/02-architecture.md section 9.1; FR-ADM-12, T-23). Admin only: the
// wrapper answers anyone else as for a missing action, and the database
// refuses the read of a draft or a solution and every write again. An import
// creates a draft and runs nothing: the server does not run Python, and the
// draft is never marked validated.

const id = z.uuid();

export const exportCourse = defineAction({
  name: "export-course",
  access: "admin",
  input: z.strictObject({ id }),
  maxBytes: 1024,
  run: async (input, { services }) => {
    const read = await readCourseExport(services.db, input.id);
    if (!read.ok) return { ok: false as const, error: "unavailable" as const };
    if (read.file === null) return { ok: false as const, error: "not_found" as const };
    return {
      ok: true as const,
      value: { fileName: courseFileName(read.file.slug), text: fileText(read.file) },
    };
  },
});

/**
 * The dashboard parsed the file to name a wrong field, and sends what it
 * parsed; it is parsed again here with the same parser. A file that fails
 * here was changed on the way, so it is only refused.
 */
export const importLesson = defineAction({
  name: "import-lesson",
  access: "admin",
  input: z.strictObject({ courseId: id, chapterId: id, lesson: z.unknown() }),
  // A lesson file holds what a full save holds, under the same limits.
  maxBytes: MAX_SAVE_LESSON_BYTES,
  run: (input, { services }) => {
    const parsed = parseLessonFile(input.lesson);
    // A new draft is not on the site, so the published content cache stays.
    if (!parsed.ok) return Promise.resolve({ ok: false as const, error: "invalid_file" as const });
    return storeImport(
      services.db,
      { courseId: input.courseId, chapterId: input.chapterId },
      parsed.lesson,
    );
  },
});
