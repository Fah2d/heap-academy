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
      return {
        objectStore: () => ({
          getAll: () => request(() => [...rows.values()]),
          add: (value: unknown, key: string) =>
            request(() => {
              if (behaviour.failWrites === true) throw new Error("refused");
              if (rows.has(key)) {
                throw Object.assign(new Error("taken"), { name: "ConstraintError" });
              }
              rows.set(key, value);
              return key;
            }),
        }),
      };
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
