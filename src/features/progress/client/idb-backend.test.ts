import { describe, expect, it } from "vitest";
import type { DeviceCompletion } from "@/domain/progress";
import { openDeviceBackend } from "./idb-backend";

// A small stand-in for IndexedDB: one object store, requests that answer on a
// later turn, and a transaction that completes after its last request.

function fakeFactory(options: { failOpen?: boolean; failWrite?: boolean } = {}) {
  const data = new Map<string, unknown>();
  const later = (run: () => void) => queueMicrotask(run);
  const reply = <T>(compute: () => T): IDBRequest<T> => {
    const req = {} as { result: T; onsuccess?: () => void };
    later(() => {
      req.result = compute();
      req.onsuccess?.();
    });
    return req as unknown as IDBRequest<T>;
  };
  const transaction = () => {
    const tx = {
      error: null as unknown,
      oncomplete: undefined as undefined | (() => void),
      onabort: undefined as undefined | (() => void),
      objectStore: () => ({
        get: (key: string) => reply(() => data.get(key)),
        put: (value: unknown, key: string) => {
          // The transaction ends once the write is queued: it completes, or aborts.
          later(() => {
            if (options.failWrite === true) tx.onabort?.();
            else {
              data.set(key, value);
              tx.oncomplete?.();
            }
          });
          return reply(() => key);
        },
      }),
    };
    return tx;
  };
  const database = { transaction };
  const factory = {
    open: () => {
      const opening = {} as { result: unknown; onsuccess?: () => void; onerror?: () => void };
      later(() => {
        if (options.failOpen === true) {
          opening.onerror?.();
          return;
        }
        opening.result = database;
        opening.onsuccess?.();
      });
      return opening;
    },
  };
  return { factory: factory as unknown as IDBFactory, data };
}

const entry = (n: number): DeviceCompletion => ({
  lessonId: `00000000-0000-4000-8000-00000000000${n}` as DeviceCompletion["lessonId"],
  completedAt: n,
  code: "x",
  synced: false,
});

describe("[FR-PRG-01] the IndexedDB backend", () => {
  it("falls back to memory without IndexedDB, and says it is not durable", async () => {
    const backend = await openDeviceBackend(undefined);
    expect(backend.durable).toBe(false);
    await backend.update(() => [entry(1)]);
    expect(await backend.read()).toEqual([entry(1)]);
  });

  it("falls back to memory when the database does not open", async () => {
    const { factory } = fakeFactory({ failOpen: true });
    expect((await openDeviceBackend(factory)).durable).toBe(false);
  });

  it("writes and reads the list in IndexedDB", async () => {
    const { factory, data } = fakeFactory();
    const backend = await openDeviceBackend(factory);
    expect(backend.durable).toBe(true);
    expect(await backend.read()).toBeUndefined();
    await backend.update(() => [entry(1)]);
    expect(data.get("completions")).toEqual([entry(1)]);
    await backend.update((current) => [...(current as DeviceCompletion[]), entry(2)]);
    expect(await backend.read()).toEqual([entry(1), entry(2)]);
  });

  it("rejects a write the database aborts", async () => {
    const { factory } = fakeFactory({ failWrite: true });
    const backend = await openDeviceBackend(factory);
    await expect(backend.update(() => [entry(1)])).rejects.toBeDefined();
  });
});
