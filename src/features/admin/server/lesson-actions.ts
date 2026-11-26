"use server";

import "server-only";
import { contentChanged } from "@/content";
import { renderMarkdown } from "@/content/markdown";
import { canMoveStatus } from "@/domain/admin/structure";
import { defineAction } from "@/infrastructure/actions/server-action";
import {
  createLessonInput,
  MAX_CREATE_LESSON_BYTES,
  MAX_PREVIEW_BYTES,
  MAX_SAVE_LESSON_BYTES,
  MAX_STATUS_BYTES,
  renderPreviewInput,
  saveLessonInput,
  setLessonStatusInput,
} from "./lesson-input";
import { gradableHash } from "../gradable-hash";
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
    // The server does not run Python. It reports the save validated only when
    // the dashboard validated exactly this content (docs/spec/04-content-system.md
    // section 4.2); the database then requires that for a published lesson.
    const { draft, testCases } = input;
    const validated =
      input.validatedHash !== undefined &&
      input.validatedHash ===
        (await gradableHash({
          starterCode: draft.starterCode,
          solutionCode: draft.solutionCode,
          wrongAnswers: draft.wrongAnswers,
          testCases,
        }));
    const saved = await store.saveLesson(
      services.db,
      input.id,
      input.loadedAt,
      draft,
      testCases,
      validated,
    );
    if (!saved.ok) return saved;
    contentChanged();
    return { ok: true as const, value: { ...saved.value, validated } };
  },
});

/** Publish, unpublish or archive (docs/spec/04-content-system.md section 4.3; FR-ADM-09). */
export const setLessonStatus = defineAction({
  name: "set-lesson-status",
  access: "admin",
  input: setLessonStatusInput,
  maxBytes: MAX_STATUS_BYTES,
  run: async (input, { services }) => {
    const result = await store.setLessonStatus(
      services.db,
      input.id,
      input.loadedAt,
      input.status,
      (from) => canMoveStatus(from, input.status),
    );
    if (result.ok) contentChanged();
    return result;
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
