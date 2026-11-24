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
  /**
   * Changes whenever the list is cleared, in this tab or another. Read it
   * before asking the server, and pass it with the answer: an answer from
   * before a sign-out then changes nothing.
   */
  epoch: () => Promise<string>;
  /** The server stored this lesson. */
  markSynced: (lessonId: LessonId, since: string) => Promise<void>;
  /** The server answered a sync: apply the account's list, drop refused lessons. */
  applySync: (
    account: readonly Completion[],
    rejected: readonly LessonId[],
    since: string,
  ) => Promise<void>;
  /** The database refused these lessons, so they are no longer there to complete. */
  drop: (lessonIds: readonly LessonId[], since: string) => Promise<void>;
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

/** The key of the row that says when the list was last cleared; it is not a completion. */
const CLEARED = "cleared";

function clearedIn(values: unknown[]): string {
  for (const value of values) {
    const cleared = (value as Record<string, unknown> | null)?.[CLEARED];
    if (typeof cleared === "string") return cleared;
  }
  return "";
}

/** Resolves once the transaction has committed, not only answered its requests. */
function committed(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error ?? new Error("IndexedDB write failed"));
    transaction.onabort = () => reject(transaction.error ?? new Error("IndexedDB write aborted"));
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
  /** The clearing this store last saw; undefined until it has read the database. */
  let epoch: string | undefined;
  /** A clear IndexedDB has not taken yet: its rows are not read until it has. */
  let owed: string | undefined;

  /** Another tab cleared the list: what this one holds in memory goes too. */
  const adopt = (cleared: string) => {
    const first = epoch === undefined;
    if (cleared === epoch) return;
    epoch = cleared;
    // The first read finds an old clearing, which says nothing about this tab's passes.
    if (first) return;
    known = new Map();
    pending.clear();
  };

  const wipe = async (opened: IDBDatabase, cleared: string): Promise<void> => {
    const transaction = opened.transaction(COMPLETION_STORE, "readwrite");
    const done = committed(transaction);
    const store = transaction.objectStore(COMPLETION_STORE);
    store.clear();
    store.put({ [CLEARED]: cleared }, CLEARED);
    await done;
  };

  /** The open database once any owed clear is done; undefined while it cannot be. */
  const ready = async (): Promise<IDBDatabase | undefined> => {
    const opened = await database.open();
    if (opened === undefined || owed === undefined) return opened;
    try {
      await wipe(opened, owed);
      owed = undefined;
      return opened;
    } catch {
      database.reset();
      return undefined;
    }
  };
  // One operation at a time, so two passes of one lesson in this tab cannot both be first.
  let queue: Promise<unknown> = Promise.resolve();
  const serial = <T>(task: () => Promise<T>): Promise<T> => {
    const next = queue.then(task, task);
    queue = next.catch(() => undefined);
    return next;
  };

  /** Reads IndexedDB into `known`; when the read fails, `known` stays as it was. */
  const refresh = async (): Promise<void> => {
    const opened = await ready();
    if (opened === undefined) return;
    try {
      const values: unknown[] = await settle(
        opened.transaction(COMPLETION_STORE, "readonly").objectStore(COMPLETION_STORE).getAll(),
      );
      adopt(clearedIn(values));
      known = new Map(parseRows(values));
    } catch {
      database.reset();
    }
  };

  const write = async (completion: DeviceCompletion): Promise<Written> => {
    const opened = await ready();
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
    await refresh();
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
   * land between the read and the write. Does nothing when the list has been
   * cleared since `since`. When IndexedDB cannot, the new list is kept in
   * memory.
   */
  const change = async (since: string, apply: (rows: DeviceCompletion[]) => DeviceCompletion[]) => {
    await flush();
    if ((epoch ?? "") !== since) return;
    const opened = await ready();
    if (opened !== undefined) {
      try {
        const transaction = opened.transaction(COMPLETION_STORE, "readwrite");
        const done = committed(transaction);
        // Handled below; this keeps an abort during the read from going unheard.
        done.catch(() => undefined);
        const store = transaction.objectStore(COMPLETION_STORE);
        const values: unknown[] = await settle(store.getAll());
        const cleared = clearedIn(values);
        if (cleared !== since) {
          adopt(cleared);
          return;
        }
        const rows = new Map(parseRows(values));
        for (const [lessonId, row] of pending) if (!rows.has(lessonId)) rows.set(lessonId, row);
        const next = apply([...rows.values()]);
        store.clear();
        if (cleared !== "") store.put({ [CLEARED]: cleared }, CLEARED);
        for (const row of next) store.put(row, row.lessonId);
        await done;
        known = new Map(next.map((row) => [row.lessonId, row]));
        pending.clear();
        return;
      } catch {
        database.reset();
      }
    }
    const next = apply([...new Map([...known, ...pending]).values()]);
    known = new Map();
    pending.clear();
    for (const row of next) pending.set(row.lessonId, row);
  };

  const clear = async (): Promise<void> => {
    epoch = `${Date.now()}-${Math.random()}`;
    owed = epoch;
    known = new Map();
    pending.clear();
    await ready();
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
    epoch: () =>
      serial(async () => {
        await refresh();
        return epoch ?? "";
      }),
    markSynced: (lessonId, since) =>
      serial(() =>
        change(since, (rows) =>
          rows.map((row) => (row.lessonId === lessonId ? { ...row, synced: true } : row)),
        ),
      ),
    applySync: (account, rejected, since) =>
      serial(() =>
        change(since, (rows) =>
          applyAccount(
            rows.filter((row) => !rejected.includes(row.lessonId)),
            account,
          ),
        ),
      ),
    drop: (lessonIds, since) =>
      serial(() =>
        change(since, (rows) => rows.filter((row) => !lessonIds.includes(row.lessonId))),
      ),
    clear: () => serial(clear),
    subscribe: (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}
