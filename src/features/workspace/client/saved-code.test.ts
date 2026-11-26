import { describe, expect, it } from "vitest";
import { CODE_STORE, createCodeStore, savedCodeKey } from "./saved-code";

// The learner's code is kept on the device and comes back after a reload
// (FR-WSP-10). The browser tests check the real IndexedDB; these use a small
// stand-in that answers the way IndexedDB does, a turn later.

type Behaviour = { failOpen?: boolean; blockOpen?: boolean; failRequests?: boolean };

/** A stand-in for `indexedDB` whose data outlives one store, as a reload's would. */
function fakeIndexedDb(rows: Map<string, unknown>, behaviour: Behaviour = {}): IDBFactory {
  const later = (callback: () => void) => {
    setTimeout(callback, 0);
  };
  const request = <T>(answer: () => T) => {
    const pending: {
      result?: T;
      error: Error | null;
      onsuccess: (() => void) | null;
      onerror: (() => void) | null;
    } = { error: null, onsuccess: null, onerror: null };
    later(() => {
      if (behaviour.failRequests === true) {
        pending.error = new Error("refused");
        pending.onerror?.();
        return;
      }
      pending.result = answer();
      pending.onsuccess?.();
    });
    return pending;
  };
  const stores = new Set<string>();
  const database = {
    objectStoreNames: { contains: (name: string) => stores.has(name) },
    createObjectStore: (name: string) => {
      stores.add(name);
    },
    transaction: (name: string) => {
      if (!stores.has(name)) throw new Error("NotFoundError");
      return {
        objectStore: () => ({
          get: (key: string) => request(() => rows.get(key)),
          put: (value: unknown, key: string) =>
            request(() => {
              rows.set(key, value);
              return key;
            }),
        }),
      };
    },
  };
  return {
    open: () => {
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
        (opening["onupgradeneeded"] as () => void)();
        (opening["onsuccess"] as () => void)();
      });
      return opening;
    },
  } as unknown as IDBFactory;
}

const key = savedCodeKey("python-basics", "hello");

describe("saved code [FR-WSP-10]", () => {
  it("names a lesson by its course's address and its own", () => {
    expect(key).toBe("python-basics/hello");
  });

  it("brings code back in a new store over the same database, as after a reload", async () => {
    const rows = new Map<string, unknown>();
    await createCodeStore(fakeIndexedDb(rows)).save(key, 'print("hi")');
    expect(await createCodeStore(fakeIndexedDb(rows)).load(key)).toBe('print("hi")');
    expect(await createCodeStore(fakeIndexedDb(rows)).load("python-basics/other")).toBeUndefined();
  });

  it("creates its store when the database is new", async () => {
    const rows = new Map<string, unknown>();
    const store = createCodeStore(fakeIndexedDb(rows));
    await store.save(key, "x = 1");
    expect(rows.get(key)).toBe("x = 1");
    expect(CODE_STORE).toBe("code");
  });

  it("treats a stored value that is not text as no saved code", async () => {
    const rows = new Map<string, unknown>([[key, { code: "x" }]]);
    expect(await createCodeStore(fakeIndexedDb(rows)).load(key)).toBeUndefined();
  });

  it("keeps code in memory while the page is open when there is no IndexedDB", async () => {
    const store = createCodeStore(undefined);
    expect(await store.load(key)).toBeUndefined();
    await store.save(key, "y = 2");
    expect(await store.load(key)).toBe("y = 2");
  });

  it("falls back to memory when the database refuses to open or is blocked", async () => {
    for (const behaviour of [{ failOpen: true }, { blockOpen: true }]) {
      const store = createCodeStore(fakeIndexedDb(new Map(), behaviour));
      expect(await store.load(key)).toBeUndefined();
      await store.save(key, "z = 3");
      expect(await store.load(key)).toBe("z = 3");
    }
  });

  it("keeps the memory copy when a read or a write fails", async () => {
    const store = createCodeStore(fakeIndexedDb(new Map(), { failRequests: true }));
    expect(await store.load(key)).toBeUndefined();
    await store.save(key, "w = 4");
    expect(await store.load(key)).toBe("w = 4");
  });
});
