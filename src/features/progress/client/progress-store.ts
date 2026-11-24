import { parseLessonId } from "@/domain/ids";
import type { Completion, DeviceCompletion } from "@/domain/progress";
import { COMPLETION_STORE, lazyDeviceDatabase, settle } from "./device-database";

// The lessons a learner passed, kept on this device (FR-PRG-01, FR-WSP-06,
// NFR-REL-01; docs/spec/02-architecture.md section 10). A pass is kept in
// memory first, so it is never lost once the learner has seen it, and then
// written to IndexedDB. Where IndexedDB is missing, refuses to open, or
// refuses a write, the pass stays in memory for as long as the page is open,
// the store says so, and the next record tries the database again.

/** Where the completions live: `device` survives closing the tab, `memory` does not. */
export type Durability = "device" | "memory";

export type ProgressStore = {
  /** Every completion on this device, one per lesson. */
  completions: () => Promise<DeviceCompletion[]>;
  /**
   * Keeps a pass. True when it is the lesson's first completion on this
   * device; a second pass keeps the first and returns false (FR-WSP-06).
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

export function createProgressStore(factory: IDBFactory | undefined): ProgressStore {
  const open = lazyDeviceDatabase(factory);
  /** Completions not yet written to IndexedDB, by lesson. */
  const pending = new Map<string, DeviceCompletion>();
  const listeners = new Set<() => void>();
  let wroteAll = true;
  // One operation at a time, so two passes of one lesson cannot both be first.
  let queue: Promise<unknown> = Promise.resolve();
  const serial = <T>(task: () => Promise<T>): Promise<T> => {
    const next = queue.then(task, task);
    queue = next.catch(() => undefined);
    return next;
  };

  const stored = async (database: IDBDatabase | undefined): Promise<DeviceCompletion[]> => {
    if (database === undefined) return [];
    try {
      const values: unknown[] = await settle(
        database.transaction(COMPLETION_STORE, "readonly").objectStore(COMPLETION_STORE).getAll(),
      );
      return values.flatMap((value) => {
        const row = parseRow(value);
        return row === undefined ? [] : [row];
      });
    } catch {
      return [];
    }
  };

  /** Writes every pending completion it can; true when none is left. */
  const flush = async (database: IDBDatabase | undefined): Promise<boolean> => {
    if (database === undefined) return pending.size === 0;
    for (const [lessonId, completion] of [...pending]) {
      try {
        await settle(
          database
            .transaction(COMPLETION_STORE, "readwrite")
            .objectStore(COMPLETION_STORE)
            .put(completion, lessonId),
        );
        pending.delete(lessonId);
      } catch {
        return false;
      }
    }
    return true;
  };

  const all = async (): Promise<DeviceCompletion[]> => {
    const rows = await stored(await open());
    const byLesson = new Map<string, DeviceCompletion>(rows.map((row) => [row.lessonId, row]));
    for (const [lessonId, completion] of pending) {
      if (!byLesson.has(lessonId)) byLesson.set(lessonId, completion);
    }
    return [...byLesson.values()].sort((a, b) => (a.lessonId < b.lessonId ? -1 : 1));
  };

  return {
    completions: () => serial(all),
    record: (completion) =>
      serial(async () => {
        const known = await all();
        if (known.some((row) => row.lessonId === completion.lessonId)) return false;
        pending.set(completion.lessonId, { ...completion, synced: false });
        for (const listener of listeners) listener();
        wroteAll = await flush(await open());
        return true;
      }),
    durability: () =>
      serial(async () => {
        const database = await open();
        if (database === undefined) return "memory";
        if (!wroteAll) wroteAll = await flush(database);
        return wroteAll ? "device" : "memory";
      }),
    subscribe: (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}
