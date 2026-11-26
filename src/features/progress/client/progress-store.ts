import { parseLessonId } from "@/domain/ids";
import type { Completion, DeviceCompletion } from "@/domain/progress";
import { COMPLETION_STORE, isTaken, lazyDeviceDatabase, settle } from "./device-database";

// The lessons a learner passed, kept on this device (FR-PRG-01, FR-WSP-06,
// NFR-REL-01; docs/spec/02-architecture.md section 10). A pass is kept in
// memory first, so it is never lost once the learner has seen it, and then
// added to IndexedDB. Adding fails when the lesson is already there, so of
// two tabs that pass one lesson only the first counts and its row stays.
// Where IndexedDB is missing, refuses to open, or refuses a write, the pass
// stays in memory for as long as the page is open, the store says so, and a
// later call tries the database again.

/** Where the completions live: `device` survives closing the tab, `memory` does not. */
export type Durability = "device" | "memory";

export type ProgressStore = {
  /** Every completion on this device, one per lesson, in lesson order. */
  completions: () => Promise<DeviceCompletion[]>;
  /**
   * Keeps a pass. True when it is the lesson's first completion on this
   * device; a later pass keeps the first and returns false (FR-WSP-06).
   */
  record: (completion: Completion) => Promise<boolean>;
  /** Whether every completion so far is in IndexedDB. */
  durability: () => Promise<Durability>;
  /** Calls `listener` after each new completion; returns the unsubscribe. */
  subscribe: (listener: () => void) => () => void;
};

/** A stored row, or undefined when it is not one this store wrote. */
function parseRow(value: unknown): DeviceCompletion | undefined {
  if (typeof value !== "object" || value === null) return undefined;
  const row = value as Record<string, unknown>;
  const lessonId = parseLessonId(row["lessonId"]);
  const { completedAt, code, synced } = row;
  if (lessonId === undefined) return undefined;
  if (typeof completedAt !== "number" || !Number.isFinite(completedAt)) return undefined;
  if (typeof code !== "string" || typeof synced !== "boolean") return undefined;
  return { lessonId, completedAt, code, synced };
}

type Written = "stored" | "taken" | "failed";

export function createProgressStore(factory: IDBFactory | undefined): ProgressStore {
  const database = lazyDeviceDatabase(factory);
  /** What IndexedDB held at the last read that worked, plus what this store added since. */
  let known = new Map<string, DeviceCompletion>();
  /** Passes not yet in IndexedDB, by lesson. */
  const pending = new Map<string, DeviceCompletion>();
  const listeners = new Set<() => void>();
  // One operation at a time, so two passes of one lesson in this tab cannot both be first.
  let queue: Promise<unknown> = Promise.resolve();
  const serial = <T>(task: () => Promise<T>): Promise<T> => {
    const next = queue.then(task, task);
    queue = next.catch(() => undefined);
    return next;
  };

  /** Reads IndexedDB into `known`; when the read fails, `known` stays as it was. */
  const refresh = async (): Promise<void> => {
    const opened = await database.open();
    if (opened === undefined) return;
    try {
      const values: unknown[] = await settle(
        opened.transaction(COMPLETION_STORE, "readonly").objectStore(COMPLETION_STORE).getAll(),
      );
      known = new Map(
        values.flatMap((value) => {
          const row = parseRow(value);
          return row === undefined ? [] : [[row.lessonId, row] as const];
        }),
      );
    } catch {
      database.reset();
    }
  };

  const write = async (completion: DeviceCompletion): Promise<Written> => {
    const opened = await database.open();
    if (opened === undefined) return "failed";
    try {
      await settle(
        opened
          .transaction(COMPLETION_STORE, "readwrite")
          .objectStore(COMPLETION_STORE)
          .add(completion, completion.lessonId),
      );
      known.set(completion.lessonId, completion);
      return "stored";
    } catch (error) {
      if (isTaken(error)) return "taken";
      database.reset();
      return "failed";
    }
  };

  /** Adds every pending pass it can, in order, stopping at the first refusal. */
  const flush = async (): Promise<void> => {
    for (const [lessonId, completion] of [...pending]) {
      const written = await write(completion);
      if (written === "failed") return;
      pending.delete(lessonId);
      if (written === "taken") await refresh();
    }
  };

  const all = async (): Promise<DeviceCompletion[]> => {
    await flush();
    await refresh();
    const byLesson = new Map(known);
    for (const [lessonId, completion] of pending) {
      if (!byLesson.has(lessonId)) byLesson.set(lessonId, completion);
    }
    return [...byLesson.values()].sort((a, b) => (a.lessonId < b.lessonId ? -1 : 1));
  };

  // After the store has answered, so a listener that throws cannot undo a kept pass.
  const notify = () => {
    for (const listener of listeners) queueMicrotask(listener);
  };

  return {
    completions: () => serial(all),
    record: (completion) =>
      serial(async () => {
        await refresh();
        const { lessonId } = completion;
        if (known.has(lessonId) || pending.has(lessonId)) return false;
        const row: DeviceCompletion = { ...completion, synced: false };
        pending.set(lessonId, row);
        const written = await write(row);
        if (written !== "failed") pending.delete(lessonId);
        if (written === "taken") {
          await refresh();
          return false;
        }
        notify();
        return true;
      }),
    durability: () =>
      serial(async () => {
        await flush();
        return pending.size === 0 && (await database.open()) !== undefined ? "device" : "memory";
      }),
    subscribe: (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}
