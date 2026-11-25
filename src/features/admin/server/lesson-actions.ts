"use server";

import "server-only";
import { contentChanged } from "@/content";
import { renderMarkdown } from "@/content/markdown";
import { defineAction } from "@/infrastructure/actions/server-action";
import {
  createLessonInput,
  MAX_CREATE_LESSON_BYTES,
  MAX_PREVIEW_BYTES,
  MAX_SAVE_LESSON_BYTES,
  renderPreviewInput,
  saveLessonInput,
} from "./lesson-input";
import * as store from "./lesson-store";

// The lesson editor's actions (docs/spec/03-experience.md section 7.4;
// docs/spec/02-architecture.md section 9.1; FR-ADM-04, FR-ADM-10). Admin
// only: the wrapper answers anyone else as for a missing action, and the
// database refuses the write again. A saved change expires the published
// content cache, so an edit to a published lesson shows at once.

export const saveLesson = defineAction({
  name: "save-lesson",
  access: "admin",
  input: saveLessonInput,
  maxBytes: MAX_SAVE_LESSON_BYTES,
  run: async (input, { services }) => {
    const saved = await store.saveLesson(services.db, input.id, input.loadedAt, input.draft);
    if (saved.ok) contentChanged();
    return saved;
  },
});

export const createLesson = defineAction({
  name: "create-lesson",
  access: "admin",
  input: createLessonInput,
  maxBytes: MAX_CREATE_LESSON_BYTES,
  run: (input, { services }) => store.createLesson(services.db, input),
});

/**
 * The instructions as learners will see them, for the editor's live preview:
 * the same renderer the lesson page calls (section 7.3), on the server.
 */
export const renderInstructionsPreview = defineAction({
  name: "render-instructions-preview",
  access: "admin",
  input: renderPreviewInput,
  maxBytes: MAX_PREVIEW_BYTES,
  run: (input) => Promise.resolve({ ok: true as const, value: renderMarkdown(input.markdown) }),
});
