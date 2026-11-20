import type { LessonId } from "./ids";

// The merge of completions (FR-PRG-03, ADR-0011; architecture section 10).
// Pure: no clock and no storage. The progress store on the device and the
// sync with the server (WP-6.1 part 2) call these.
//
// Two rules, one for each question:
//
// - `mergeCompletions` combines lists of completions, from the device and
//   from the account, into one entry per lesson. Where both have a lesson,
//   the first completion is kept: the earlier time, then the smaller code,
//   so the result never depends on the order the lists come in. Merging is
//   idempotent, commutative and associative, and merging twice changes
//   nothing.
// - `applyAccount` is what the device keeps once the server has answered a
//   sync with the account's full list. The database is the authority
//   (CLAUDE.md rule 8): for a lesson the account has, the account's
//   completion replaces the device's and is synced; a lesson only the device
//   has stays, still to be sent.

/** The record that a learner passed a lesson (charter section 10). */
export type Completion = {
  lessonId: LessonId;
  /** Milliseconds since the Unix epoch. */
  completedAt: number;
  /** The code that passed. */
  code: string;
};

/** A completion as the device holds it: `synced` once the server has stored it. */
export type DeviceCompletion = Completion & { synced: boolean };

/** Whether `a` came first: the earlier time, then the smaller code. */
function isFirst(a: Completion, b: Completion): boolean {
  if (a.completedAt !== b.completedAt) return a.completedAt < b.completedAt;
  return a.code <= b.code;
}

function byLesson(a: Completion, b: Completion): number {
  return a.lessonId < b.lessonId ? -1 : a.lessonId > b.lessonId ? 1 : 0;
}

/** One completion per lesson, the first of each, in lesson order. */
export function mergeCompletions(...lists: readonly (readonly Completion[])[]): Completion[] {
  const first = new Map<LessonId, Completion>();
  for (const list of lists) {
    for (const completion of list) {
      const known = first.get(completion.lessonId);
      if (known === undefined || isFirst(completion, known)) {
        first.set(completion.lessonId, {
          lessonId: completion.lessonId,
          completedAt: completion.completedAt,
          code: completion.code,
        });
      }
    }
  }
  return [...first.values()].sort(byLesson);
}

/**
 * The device's completions once the server has returned the account's full
 * list: the account's, synced, and the device's own for lessons the account
 * does not have, not synced. Applying the same list again changes nothing.
 */
export function applyAccount(
  device: readonly DeviceCompletion[],
  account: readonly Completion[],
): DeviceCompletion[] {
  const stored = new Set(account.map((completion) => completion.lessonId));
  const local = mergeCompletions(device.filter((completion) => !stored.has(completion.lessonId)));
  return [
    ...mergeCompletions(account).map((completion) => ({ ...completion, synced: true })),
    ...local.map((completion) => ({ ...completion, synced: false })),
  ].sort(byLesson);
}

/** What the next sync sends: every completion the server has not stored yet. */
export function unsynced(device: readonly DeviceCompletion[]): Completion[] {
  return mergeCompletions(device.filter((completion) => !completion.synced));
}
