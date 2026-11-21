"use server";

import "server-only";
import { contentChanged } from "@/content";
import { canMoveStatus } from "@/domain/admin/structure";
import type { UseCaseResult } from "@/infrastructure/actions/define-action";
import { defineAction } from "@/infrastructure/actions/server-action";
import {
  deleteChapterInput,
  MAX_STRUCTURE_BYTES,
  reorderInput,
  saveChapterInput,
  saveCourseInput,
  setCourseStatusInput,
} from "./structure-input";
import * as store from "./structure-store";

// The course structure actions of docs/spec/02-architecture.md section 9.1
// (FR-ADM-03, FR-ADM-09, FR-ADM-10, FR-ADM-11). Admin only: the wrapper
// answers anyone else as for a missing action, and the database refuses the
// write again. A success expires the published-content cache, so a change
// shows on the site at once (section 12).

async function changed<Value, Failure extends string>(
  result: Promise<UseCaseResult<Value, Failure>>,
): Promise<UseCaseResult<Value, Failure>> {
  const settled = await result;
  if (settled.ok) contentChanged();
  return settled;
}

export const saveCourse = defineAction({
  name: "save-course",
  access: "admin",
  input: saveCourseInput,
  maxBytes: MAX_STRUCTURE_BYTES,
  run: (input, { services }) =>
    changed<{ id: string; updatedAt?: string }, store.StructureFailure>(
      "id" in input
        ? store
            .saveCourseDetails(services.db, input.id, input.loadedAt, input.details)
            .then((saved) =>
              saved.ok ? { ok: true, value: { id: input.id, ...saved.value } } : saved,
            )
        : store.createCourse(services.db, input.details),
    ),
});

export const setCourseStatus = defineAction({
  name: "set-course-status",
  access: "admin",
  input: setCourseStatusInput,
  maxBytes: MAX_STRUCTURE_BYTES,
  run: (input, { services }) =>
    changed(
      store.setCourseStatus(services.db, input.id, input.loadedAt, input.status, (from) =>
        canMoveStatus(from, input.status),
      ),
    ),
});

export const saveChapter = defineAction({
  name: "save-chapter",
  access: "admin",
  input: saveChapterInput,
  maxBytes: MAX_STRUCTURE_BYTES,
  run: (input, { services }) => changed(store.saveChapter(services.db, input)),
});

export const deleteChapter = defineAction({
  name: "delete-chapter",
  access: "admin",
  input: deleteChapterInput,
  maxBytes: MAX_STRUCTURE_BYTES,
  run: (input, { services }) => changed(store.deleteChapter(services.db, input.id)),
});

export const reorder = defineAction({
  name: "reorder",
  access: "admin",
  input: reorderInput,
  maxBytes: MAX_STRUCTURE_BYTES,
  run: (input, { services }) =>
    changed(
      store.move(
        services.db,
        input.kind === "course"
          ? { kind: "course", id: input.id }
          : { kind: "chapter", courseId: input.courseId, id: input.id },
        input.direction,
      ),
    ),
});
