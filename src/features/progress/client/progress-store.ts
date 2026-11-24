import { parseLessonId, type LessonId } from "@/domain/ids";
import {
  applyAccount,
  type Completion,
  type DeviceCompletion,
  sendable,
  unsynced,
} from "@/domain/progress";
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
  /** Calls `listener` with each new completion; returns the unsubscribe. */
  subscribe: (listener: (completion: Completion) => void) => () => void;
  /** What the next sync sends: what the server has not stored (FR-PRG-06). */
  pending: () => Promise<Completion[]>;
  /** The server stored this lesson. */
  markSynced: (lessonId: LessonId) => Promise<void>;
  /** The server answered a sync: apply the account's list, drop refused lessons. */
  applySync: (account: readonly Completion[], rejected: readonly LessonId[]) => Promise<void>;
  /** The database refused these lessons, so they are no longer there to complete. */
  drop: (lessonIds: readonly LessonId[]) => Promise<void>;
  /** Forgets every completion on this device: at sign-out. */
  clear: () => Promise<void>;
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

function parseRows(values: unknown[]): [string, DeviceCompletion][] {
  return values.flatMap((value) => {
    const row = parseRow(value);
    return row === undefined ? [] : [[row.lessonId, row] as [string, DeviceCompletion]];
  });
}

type Written = "stored" | "taken" | "failed";

export function createProgressStore(factory: IDBFactory | undefined): ProgressStore {
  const database = lazyDeviceDatabase(factory);
  /** What IndexedDB held at the last read that worked, plus what this store added since. */
  let known = new Map<string, DeviceCompletion>();
  /** Passes not yet in IndexedDB, by lesson. */
  const pending = new Map<string, DeviceCompletion>();
  const listeners = new Set<(completion: Completion) => void>();
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
      known = new Map(parseRows(values));
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
  const notify = (completion: Completion) => {
    for (const listener of listeners) queueMicrotask(() => listener(completion));
  };

  /**
   * Rewrites the whole list in one transaction, so another tab's pass cannot
   * land between the read and the write. When IndexedDB cannot, the new list
   * is kept in memory.
   */
  const change = async (apply: (rows: DeviceCompletion[]) => DeviceCompletion[]) => {
    await flush();
    const opened = await database.open();
    if (opened !== undefined) {
      try {
        const store = opened
          .transaction(COMPLETION_STORE, "readwrite")
          .objectStore(COMPLETION_STORE);
        const values: unknown[] = await settle(store.getAll());
        const rows = new Map(parseRows(values));
        for (const [lessonId, row] of pending) if (!rows.has(lessonId)) rows.set(lessonId, row);
        const next = apply([...rows.values()]);
        const requests: IDBRequest[] = [store.clear()];
        for (const row of next) requests.push(store.put(row, row.lessonId));
        await Promise.all(requests.map((request) => settle<unknown>(request)));
        known = new Map(next.map((row) => [row.lessonId, row]));
        pending.clear();
        return;
      } catch {
        database.reset();
      }
    }
    const next = apply([...new Map([...pending, ...known]).values()]);
    known = new Map();
    pending.clear();
    for (const row of next) pending.set(row.lessonId, row);
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
        notify(completion);
        return true;
      }),
    durability: () =>
      serial(async () => {
        await flush();
        return pending.size === 0 && (await database.open()) !== undefined ? "device" : "memory";
      }),
    pending: () => serial(async () => unsynced(await all()).map(sendable)),
    markSynced: (lessonId) =>
      serial(() =>
        change((rows) =>
          rows.map((row) => (row.lessonId === lessonId ? { ...row, synced: true } : row)),
        ),
      ),
    applySync: (account, rejected) =>
      serial(() =>
        change((rows) =>
          applyAccount(
            rows.filter((row) => !rejected.includes(row.lessonId)),
            account,
          ),
        ),
      ),
    drop: (lessonIds) =>
      serial(() => change((rows) => rows.filter((row) => !lessonIds.includes(row.lessonId)))),
    clear: () => serial(() => change(() => [])),
    subscribe: (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}
