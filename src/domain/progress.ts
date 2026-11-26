import type { LessonId } from "./ids";

// The merge of completions (FR-PRG-03, ADR-0011; architecture section 10).
// Pure: no clock and no storage. The progress store on the device and the
// sync with the server (WP-6.1 part 2) call these.
//
// Two rules, one for each question:
//
// - `applyAccount` is the merge of device and account: what the device keeps
//   once the server has answered a sync with the account's full list. The
//   database is the authority (CLAUDE.md rule 8): for a lesson the account
//   has, the account's completion replaces the device's and is synced; a
//   lesson only the device has stays, still to be sent, unless the device
//   already had it stored, which means another account stored it. Applying
//   the same list twice changes nothing.
// - `mergeCompletions` combines lists from one source, such as the device's
//   own entries, into one entry per lesson, keeping the first: the earlier
//   time, then the smaller code. It is idempotent, commutative and
//   associative. It is never used to combine the device's list with the
//   account's, whose rule is the database's ("do nothing on conflict").

/**
 * The record that a learner passed a lesson (charter section 10). A
 * completion whose time is not a finite number is left out of every merge.
 */
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

/** The most completions one sync sends. */
export const MAX_SYNC_COMPLETIONS = 100;
/** The longest code the database holds (docs/spec/02-architecture.md 8.1). */
export const MAX_COMPLETION_CODE = 20_000;
/** The last time that can still be written as a date the database takes. */
export const MAX_COMPLETED_AT = 9_999_999_999_999;

/**
 * The completion in the form the server accepts, so one long program or one
 * odd character cannot make every sync fail: NUL, which the database's text
 * type refuses, is removed, and the code is cut to the column's length.
 */
export function sendable(completion: Completion): Completion {
  const { lessonId, completedAt, code } = completion;
  return {
    lessonId,
    completedAt: Math.min(Math.max(Math.trunc(completedAt), 0), MAX_COMPLETED_AT),
    code: code.replaceAll("\u0000", "").slice(0, MAX_COMPLETION_CODE),
  };
}

/** One completion per lesson, the first of each, in lesson order. */
export function mergeCompletions(...lists: readonly (readonly Completion[])[]): Completion[] {
  const first = new Map<LessonId, Completion>();
  for (const list of lists) {
    for (const completion of list) {
      if (!Number.isFinite(completion.completedAt)) continue;
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
 * list: the account's, synced, and the device's unsynced ones for lessons
 * the account does not have. A synced entry the account does not have was
 * stored by another account on this device, so it is dropped and never sent
 * to this one. Applying the same list again changes nothing.
 */
export function applyAccount(
  device: readonly DeviceCompletion[],
  account: readonly Completion[],
): DeviceCompletion[] {
  const stored = new Set(account.map((completion) => completion.lessonId));
  const local = mergeCompletions(
    device.filter((completion) => !completion.synced && !stored.has(completion.lessonId)),
  );
  return [
    ...mergeCompletions(account).map((completion) => ({ ...completion, synced: true })),
    ...local.map((completion) => ({ ...completion, synced: false })),
  ].sort(byLesson);
}

/** What the next sync sends: every completion the server has not stored yet. */
export function unsynced(device: readonly DeviceCompletion[]): Completion[] {
  return mergeCompletions(device.filter((completion) => !completion.synced));
}
