import "server-only";
import { z } from "zod";
import { parseLessonId, type LessonId } from "@/domain/ids";
import { type Completion, mergeCompletions } from "@/domain/progress";
import type { UseCaseResult } from "@/infrastructure/actions/define-action";
import type { CompletionStore } from "@/infrastructure/db/completion-store";

// Store a completion, and merge the device's completions into the account
// (FR-PRG-02, FR-PRG-03, FR-PRG-06, FR-PRG-07, NFR-REL-01, T-08, T-10;
// docs/spec/02-architecture.md sections 9.1 and 10). Both are idempotent: a
// lesson the account already has is left as it is, so a retry or a second
// device changes nothing. The caller's ID is the verified identity and never
// part of the input. The database takes XP from the lesson and refuses a
// lesson that is not published.

const lessonId = z
  .string()
  .refine((value) => parseLessonId(value) !== undefined)
  .transform((value) => value as LessonId);
// Past the year 2286 a time stops being a plausible one, and a date that
// cannot be written as ISO text is never sent to the database.
const completedAt = z.number().int().min(0).max(9_999_999_999_999);
// The column holds at most 20000 characters (docs/spec/02-architecture.md 8.1).
const code = z.string().max(20_000);

const completionInput = z.strictObject({ lessonId, completedAt, code });

/** The most completions one sync sends. A learner's own list stays far below it. */
export const MAX_SYNC_COMPLETIONS = 100;

export const recordCompletionInput = completionInput;
export const mergeProgressInput = z.strictObject({
  completions: z.array(completionInput).max(MAX_SYNC_COMPLETIONS),
});

// The largest JSON form of an input within the field limits: JSON spends at
// most six bytes on one UTF-16 unit, plus room for the field names and ID.
const completionBytes = 6 * 20_000 + 256;
export const MAX_RECORD_BYTES = completionBytes + 256;
export const MAX_MERGE_BYTES = MAX_SYNC_COMPLETIONS * (completionBytes + 1) + 256;

export type RecordCompletionFailure = "lesson_unavailable" | "unavailable";
export type MergeProgressFailure = "unavailable";

/** The account's full list after a sync, and the lessons the database refused. */
export type MergeProgressValue = { completions: Completion[]; rejected: LessonId[] };

export async function recordCompletion(
  userId: string,
  input: z.infer<typeof recordCompletionInput>,
  store: CompletionStore,
): Promise<UseCaseResult<null, RecordCompletionFailure>> {
  const outcome = await store.insert(userId, [input]);
  if (outcome === "stored") return { ok: true, value: null };
  return { ok: false, error: outcome === "refused" ? "lesson_unavailable" : "unavailable" };
}

/**
 * Stores what the device sends, then returns the account's full list. If the
 * database refuses the batch, each completion is tried alone, so one lesson
 * that is no longer published does not hold back the others; the refused
 * lessons are named, and the device drops them.
 */
export async function mergeProgress(
  userId: string,
  input: z.infer<typeof mergeProgressInput>,
  store: CompletionStore,
): Promise<UseCaseResult<MergeProgressValue, MergeProgressFailure>> {
  const sent = mergeCompletions(input.completions);
  const rejected: LessonId[] = [];
  const outcome = await store.insert(userId, sent);
  if (outcome === "unavailable") return { ok: false, error: "unavailable" };
  if (outcome === "refused") {
    for (const completion of sent) {
      const single = await store.insert(userId, [completion]);
      if (single === "unavailable") return { ok: false, error: "unavailable" };
      if (single === "refused") rejected.push(completion.lessonId);
    }
  }
  const completions = await store.list(userId);
  if (completions === null) return { ok: false, error: "unavailable" };
  return { ok: true, value: { completions: mergeCompletions(completions), rejected } };
}
