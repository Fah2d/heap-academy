import { describe, expect, it, vi } from "vitest";
import { parseLessonId, type LessonId } from "@/domain/ids";
import {
  CODE_STORE,
  COMPLETION_STORE,
  DEVICE_DATABASE_VERSION,
  openDeviceDatabase,
} from "./device-database";
import { createProgressStore } from "./progress-store";

// Completions are kept on the device and come back after a reload
// (FR-PRG-01), a second pass keeps the first (FR-WSP-06), and a pass is
// never lost once seen (NFR-REL-01). These use a stand-in that answers the
// way IndexedDB does, a turn later, and whose data outlives one store, as a
// reload's would; WP-5.4's browser journeys check the real IndexedDB.

type Behaviour = {
  failOpen?: boolean;
  blockOpen?: boolean;
  failWrites?: boolean;
  /** The requests succeed, then the commit aborts. */
  abortCommit?: boolean;
  /** Every request on an open connection throws, as on a closed one. */
  closed?: boolean;
  opens?: number;
  /** The connection the last open gave, to play another tab's upgrade on it. */
  connection?: { onversionchange: (() => void) | null; close: () => void };
};

type Disk = { version: number; stores: Map<string, Map<string, unknown>> };

function fakeIndexedDb(disk: Disk, behaviour: Behaviour = {}): IDBFactory {
  const later = (callback: () => void) => {
    setTimeout(callback, 0);
  };
  /** A request whose answer is worked out a turn later; an answer that throws is its error. */
  const request = <T>(answer: () => T) => {
    const pending: {
      result?: T;
      error: Error | null;
      onsuccess: (() => void) | null;
      onerror: (() => void) | null;
    } = { error: null, onsuccess: null, onerror: null };
    later(() => {
      try {
        pending.result = answer();
      } catch (error) {
        pending.error = error as Error;
        pending.onerror?.();
        return;
      }
      pending.onsuccess?.();
    });
    return pending;
  };
  const database = {
    objectStoreNames: { contains: (name: string) => disk.stores.has(name) },
    createObjectStore: (name: string) => {
      disk.stores.set(name, new Map());
    },
    onversionchange: null as (() => void) | null,
    onclose: null as (() => void) | null,
    close: vi.fn(),
    transaction: (name: string) => {
      if (behaviour.closed === true) throw new Error("InvalidStateError");
      const rows = disk.stores.get(name);
      if (rows === undefined) throw new Error("NotFoundError");
      let refused = false;
      const refuse = () => {
        if (behaviour.failWrites !== true) return;
        // As in IndexedDB, a failed request aborts its transaction.
        refused = true;
        throw new Error("refused");
      };
      const transaction = {
        error: null,
        onerror: null,
        onabort: null as (() => void) | null,
        set oncomplete(done: () => void) {
          setTimeout(() => {
            if (refused || behaviour.abortCommit === true) transaction.onabort?.();
            else done();
          }, 5);
        },
        objectStore: () => ({
          getAll: () => request(() => [...rows.values()]),
          clear: () =>
            request(() => {
              refuse();
              if (behaviour.abortCommit !== true) rows.clear();
            }),
          put: (value: unknown, key: string) =>
            request(() => {
              refuse();
              if (behaviour.abortCommit !== true) rows.set(key, value);
              return key;
            }),
          add: (value: unknown, key: string) =>
            request(() => {
              refuse();
              if (rows.has(key)) {
                throw Object.assign(new Error("taken"), { name: "ConstraintError" });
              }
              rows.set(key, value);
              return key;
            }),
        }),
      };
      return transaction;
    },
  };
  return {
    open: (_name: string, version: number) => {
      behaviour.opens = (behaviour.opens ?? 0) + 1;
      behaviour.connection = database;
      const opening: Record<string, unknown> = { result: database, error: null };
      later(() => {
        if (behaviour.blockOpen === true) {
          (opening["onblocked"] as () => void)();
          return;
        }
        if (behaviour.failOpen === true) {
          opening["error"] = new Error("refused");
          (opening["onerror"] as () => void)();
          return;
        }
        if (version > disk.version) {
          disk.version = version;
          (opening["onupgradeneeded"] as () => void)();
        }
        (opening["onsuccess"] as () => void)();
      });
      return opening;
    },
  } as unknown as IDBFactory;
}

const newDisk = (): Disk => ({ version: 0, stores: new Map() });

const lesson = (id: string): LessonId => {
  const parsed = parseLessonId(id);
  if (parsed === undefined) throw new Error(`not a lesson ID: ${id}`);
  return parsed;
};

const HELLO = lesson("0b6f7a3c-1d2e-4f5a-8b9c-0d1e2f3a4b5c");
const SUMS = lesson("7c8d9e0f-1a2b-4c3d-9e4f-5a6b7c8d9e0f");

const pass = (lessonId: LessonId, completedAt = 1_000, code = 'print("hi")') => ({
  lessonId,
  completedAt,
  code,
});

describe("the device database", () => {
  it("creates both stores on a new device", async () => {
    const disk = newDisk();
    await openDeviceDatabase(fakeIndexedDb(disk));
    expect([...disk.stores.keys()].sort()).toEqual([CODE_STORE, COMPLETION_STORE].sort());
    expect(disk.version).toBe(DEVICE_DATABASE_VERSION);
  });

  it("adds the completion store to WP-5.2's version 1 and keeps the saved code", async () => {
    const code = new Map<string, unknown>([["python-basics/hello", "x = 1"]]);
    const disk: Disk = { version: 1, stores: new Map([[CODE_STORE, code]]) };
    await openDeviceDatabase(fakeIndexedDb(disk));
    expect(disk.stores.get(COMPLETION_STORE)).toEqual(new Map());
    expect(disk.stores.get(CODE_STORE)?.get("python-basics/hello")).toBe("x = 1");
  });

  it("closes its connection when another tab upgrades, so that upgrade is not blocked", async () => {
    const database = await openDeviceDatabase(fakeIndexedDb(newDisk()));
    database.onversionchange?.(new Event("versionchange") as IDBVersionChangeEvent);
    expect(database.close).toHaveBeenCalledOnce();
  });
});

describe("the progress store after a sync [FR-PRG-02] [FR-PRG-03] [FR-AUTH-05]", () => {
  it("keeps the account's list and what is still unsent, across a reload", async () => {
    const disk = newDisk();
    const store = createProgressStore(fakeIndexedDb(disk));
    await store.record(pass(HELLO));
    await store.applySync([pass(SUMS)], [], await store.epoch());
    const reloaded = createProgressStore(fakeIndexedDb(disk));
    expect(await reloaded.completions()).toEqual([
      { ...pass(HELLO), synced: false },
      { ...pass(SUMS), synced: true },
    ]);
    expect(await reloaded.pending()).toEqual([pass(HELLO)]);
  });

  it("marks a stored lesson and drops a refused one", async () => {
    const disk = newDisk();
    const store = createProgressStore(fakeIndexedDb(disk));
    await store.record(pass(HELLO));
    await store.record(pass(SUMS));
    await store.markSynced(HELLO, await store.epoch());
    await store.drop([SUMS], await store.epoch());
    expect(await createProgressStore(fakeIndexedDb(disk)).completions()).toEqual([
      { ...pass(HELLO), synced: true },
    ]);
  });

  it("forgets every completion at sign-out, and a new store finds none", async () => {
    const disk = newDisk();
    const store = createProgressStore(fakeIndexedDb(disk));
    await store.record(pass(HELLO));
    await store.clear();
    expect(await store.completions()).toEqual([]);
    expect(await createProgressStore(fakeIndexedDb(disk)).completions()).toEqual([]);
  });

  it("applies the same changes in memory when the database takes no writes", async () => {
    const store = createProgressStore(fakeIndexedDb(newDisk(), { failWrites: true }));
    await store.record(pass(HELLO));
    await store.markSynced(HELLO, await store.epoch());
    expect(await store.completions()).toEqual([{ ...pass(HELLO), synced: true }]);
    await store.clear();
    expect(await store.completions()).toEqual([]);
  });
});

describe("a sign-out is not undone [FR-AUTH-05] [NFR-REL-01]", () => {
  it("ignores a server answer from before another tab cleared the list", async () => {
    const disk = newDisk();
    const syncing = createProgressStore(fakeIndexedDb(disk));
    await syncing.record(pass(HELLO));
    const since = await syncing.epoch();
    await createProgressStore(fakeIndexedDb(disk)).clear();
    await syncing.applySync([pass(HELLO)], [], since);
    await syncing.markSynced(HELLO, since);
    expect(await syncing.completions()).toEqual([]);
    expect(await createProgressStore(fakeIndexedDb(disk)).completions()).toEqual([]);
  });

  it("forgets another tab's memory-only pass once the list is cleared elsewhere", async () => {
    const disk = newDisk();
    const behaviour: Behaviour = { failWrites: true };
    const stale = createProgressStore(fakeIndexedDb(disk, behaviour));
    await stale.record(pass(HELLO));
    await createProgressStore(fakeIndexedDb(disk)).clear();
    behaviour.failWrites = false;
    expect(await stale.completions()).toEqual([]);
  });

  it("keeps passes made before the database first opened, despite an old clearing", async () => {
    const disk = newDisk();
    await createProgressStore(fakeIndexedDb(disk)).clear();
    const behaviour: Behaviour = { failOpen: true };
    const store = createProgressStore(fakeIndexedDb(disk, behaviour));
    await store.record(pass(HELLO));
    behaviour.failOpen = false;
    expect(await store.completions()).toEqual([{ ...pass(HELLO), synced: false }]);
  });

  it("does not read rows back when the clear failed, and clears them later", async () => {
    const disk = newDisk();
    const behaviour: Behaviour = {};
    const store = createProgressStore(fakeIndexedDb(disk, behaviour));
    await store.record(pass(HELLO));
    behaviour.abortCommit = true;
    await store.clear();
    expect(await store.completions()).toEqual([]);
    behaviour.abortCommit = false;
    expect(await store.completions()).toEqual([]);
    expect(await createProgressStore(fakeIndexedDb(disk)).completions()).toEqual([]);
  });

  it("keeps a memory-only pass when a rewrite's commit aborts", async () => {
    const behaviour: Behaviour = { failWrites: true };
    const store = createProgressStore(fakeIndexedDb(newDisk(), behaviour));
    await store.record(pass(HELLO));
    behaviour.failWrites = false;
    behaviour.abortCommit = true;
    await store.applySync([], [], await store.epoch());
    expect(await store.completions()).toEqual([{ ...pass(HELLO), synced: false }]);
  });
});

describe("the progress store [FR-PRG-01] [FR-WSP-06] [NFR-REL-01]", () => {
  it("brings completions back in a new store over the same database, as after a reload", async () => {
    const disk = newDisk();
    expect(await createProgressStore(fakeIndexedDb(disk)).record(pass(HELLO))).toBe(true);
    const reloaded = createProgressStore(fakeIndexedDb(disk));
    expect(await reloaded.completions()).toEqual([{ ...pass(HELLO), synced: false }]);
    expect(await reloaded.durability()).toBe("device");
  });

  it("keeps the first pass of a lesson and says a second one is not first", async () => {
    const disk = newDisk();
    const store = createProgressStore(fakeIndexedDb(disk));
    expect(await store.record(pass(HELLO, 1_000, "a"))).toBe(true);
    expect(await store.record(pass(HELLO, 2_000, "b"))).toBe(false);
    expect(await createProgressStore(fakeIndexedDb(disk)).record(pass(HELLO, 3_000))).toBe(false);
    expect(await store.completions()).toEqual([{ ...pass(HELLO, 1_000, "a"), synced: false }]);
  });

  it("lets only one of two passes of one lesson at the same moment be first", async () => {
    const store = createProgressStore(fakeIndexedDb(newDisk()));
    const answers = await Promise.all([store.record(pass(HELLO)), store.record(pass(HELLO))]);
    expect(answers.sort()).toEqual([false, true]);
  });

  it("keeps one completion per lesson, in lesson order", async () => {
    const store = createProgressStore(fakeIndexedDb(newDisk()));
    await store.record(pass(SUMS));
    await store.record(pass(HELLO));
    expect((await store.completions()).map((row) => row.lessonId)).toEqual([HELLO, SUMS]);
  });

  it("tells its listeners about a new completion, and not about a repeat", async () => {
    const store = createProgressStore(fakeIndexedDb(newDisk()));
    const listener = vi.fn();
    const unsubscribe = store.subscribe(listener);
    await store.record(pass(HELLO));
    await store.record(pass(HELLO));
    expect(listener).toHaveBeenCalledOnce();
    unsubscribe();
    await store.record(pass(SUMS));
    expect(listener).toHaveBeenCalledOnce();
  });

  it("leaves out a stored row it did not write", async () => {
    const disk = newDisk();
    await openDeviceDatabase(fakeIndexedDb(disk));
    const rows = disk.stores.get(COMPLETION_STORE);
    rows?.set("a", { lessonId: "not-a-uuid", completedAt: 1, code: "", synced: false });
    rows?.set("b", { lessonId: HELLO, completedAt: Number.NaN, code: "", synced: false });
    rows?.set("c", { lessonId: HELLO, completedAt: 1, code: 7, synced: false });
    rows?.set("d", "text");
    rows?.set("e", { ...pass(SUMS), synced: "yes" });
    expect(await createProgressStore(fakeIndexedDb(disk)).completions()).toEqual([]);
  });

  it("keeps a pass in memory and says so when there is no IndexedDB", async () => {
    const store = createProgressStore(undefined);
    expect(await store.record(pass(HELLO))).toBe(true);
    expect(await store.record(pass(HELLO))).toBe(false);
    expect(await store.completions()).toEqual([{ ...pass(HELLO), synced: false }]);
    expect(await store.durability()).toBe("memory");
  });

  it("falls back to memory when the database refuses to open or is blocked", async () => {
    for (const behaviour of [{ failOpen: true }, { blockOpen: true }]) {
      const store = createProgressStore(fakeIndexedDb(newDisk(), behaviour));
      expect(await store.record(pass(HELLO))).toBe(true);
      expect(await store.completions()).toHaveLength(1);
      expect(await store.durability()).toBe("memory");
    }
  });

  it("keeps a pass whose write failed, says so, and writes it when the database takes writes again", async () => {
    const disk = newDisk();
    const behaviour: Behaviour = { failWrites: true };
    const store = createProgressStore(fakeIndexedDb(disk, behaviour));
    expect(await store.record(pass(HELLO))).toBe(true);
    expect(await store.completions()).toEqual([{ ...pass(HELLO), synced: false }]);
    expect(await store.durability()).toBe("memory");
    expect(disk.stores.get(COMPLETION_STORE)?.size).toBe(0);

    behaviour.failWrites = false;
    expect(await store.durability()).toBe("device");
    expect(await createProgressStore(fakeIndexedDb(disk)).completions()).toEqual([
      { ...pass(HELLO), synced: false },
    ]);
  });

  it("lets only the first of two tabs that pass one lesson at once count, and keeps its row", async () => {
    const disk = newDisk();
    const first = createProgressStore(fakeIndexedDb(disk));
    const second = createProgressStore(fakeIndexedDb(disk));
    const answers = await Promise.all([
      first.record(pass(HELLO, 1_000, "first")),
      second.record(pass(HELLO, 2_000, "second")),
    ]);
    expect(answers).toEqual([true, false]);
    const kept = [{ ...pass(HELLO, 1_000, "first"), synced: false }];
    expect(await second.completions()).toEqual(kept);
    expect(await createProgressStore(fakeIndexedDb(disk)).completions()).toEqual(kept);
  });

  it("keeps what it last read when a later read fails, and still knows a repeat", async () => {
    const disk = newDisk();
    await createProgressStore(fakeIndexedDb(disk)).record(pass(HELLO));
    const behaviour: Behaviour = {};
    const store = createProgressStore(fakeIndexedDb(disk, behaviour));
    expect(await store.completions()).toHaveLength(1);
    behaviour.closed = true;
    expect(await store.completions()).toEqual([{ ...pass(HELLO), synced: false }]);
    expect(await store.record(pass(HELLO, 5_000))).toBe(false);
    expect(await store.durability()).toBe("device");
  });

  it("opens the database again after a request on a closed connection failed", async () => {
    const behaviour: Behaviour = { closed: true };
    const store = createProgressStore(fakeIndexedDb(newDisk(), behaviour));
    expect(await store.record(pass(HELLO))).toBe(true);
    expect(await store.durability()).toBe("memory");
    const opens = behaviour.opens;
    behaviour.closed = false;
    expect(await store.durability()).toBe("device");
    expect(behaviour.opens).toBeGreaterThan(opens ?? 0);
  });

  it("opens the database again after another tab's upgrade closed it", async () => {
    const behaviour: Behaviour = {};
    const disk = newDisk();
    const store = createProgressStore(fakeIndexedDb(disk, behaviour));
    await store.record(pass(HELLO));
    const opens = behaviour.opens ?? 0;
    behaviour.connection?.onversionchange?.();
    expect(behaviour.connection?.close).toHaveBeenCalledOnce();
    await store.record(pass(SUMS));
    expect(behaviour.opens).toBe(opens + 1);
    expect((await store.completions()).map((row) => row.lessonId)).toEqual([HELLO, SUMS]);
  });

  it("answers a pass as kept even when a listener throws", async () => {
    const store = createProgressStore(fakeIndexedDb(newDisk()));
    const failing = vi.fn(() => {
      throw new Error("listener");
    });
    store.subscribe(failing);
    const errors: unknown[] = [];
    const original = globalThis.queueMicrotask;
    globalThis.queueMicrotask = (task) => {
      original(() => {
        try {
          task();
        } catch (error) {
          errors.push(error);
        }
      });
    };
    try {
      expect(await store.record(pass(HELLO))).toBe(true);
    } finally {
      globalThis.queueMicrotask = original;
    }
    expect(failing).toHaveBeenCalledOnce();
    expect(errors).toHaveLength(1);
  });
});
