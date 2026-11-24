import type { DeviceCompletion } from "@/domain/progress";
import { createMemoryStore, type DeviceStore } from "./store";

// The IndexedDB side of the device store. If IndexedDB is missing, blocked
// (private modes, storage turned off) or fails to open, `openDeviceStore`
// returns the memory store and the caller shows the notice.

const DATABASE = "heap-progress";
const VERSION = 1;
const COMPLETIONS = "completions";

function request<T>(source: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    source.onsuccess = () => resolve(source.result);
    source.onerror = () => reject(source.error ?? new Error("indexeddb request failed"));
  });
}

function finished(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error ?? new Error("indexeddb write failed"));
    transaction.onabort = () => reject(transaction.error ?? new Error("indexeddb write aborted"));
  });
}

function open(factory: IDBFactory): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const opening = factory.open(DATABASE, VERSION);
    opening.onupgradeneeded = () => {
      opening.result.createObjectStore(COMPLETIONS, { keyPath: "lessonId" });
    };
    opening.onsuccess = () => resolve(opening.result);
    opening.onerror = () => reject(opening.error ?? new Error("indexeddb open failed"));
    opening.onblocked = () => reject(new Error("indexeddb open blocked"));
  });
}

function wrap(database: IDBDatabase): DeviceStore {
  return {
    kind: "indexeddb",
    async list() {
      const transaction = database.transaction(COMPLETIONS, "readonly");
      const all = (await request(
        transaction.objectStore(COMPLETIONS).getAll(),
      )) as DeviceCompletion[];
      return all.sort((a, b) => (a.lessonId < b.lessonId ? -1 : a.lessonId > b.lessonId ? 1 : 0));
    },
    async add(completion) {
      const transaction = database.transaction(COMPLETIONS, "readwrite");
      const store = transaction.objectStore(COMPLETIONS);
      // `add` fails on a key that exists; the lesson already has its entry.
      const existing = await request(store.get(completion.lessonId));
      if (existing === undefined) store.add(completion);
      await finished(transaction);
    },
    async replaceAll(entries) {
      const transaction = database.transaction(COMPLETIONS, "readwrite");
      const store = transaction.objectStore(COMPLETIONS);
      store.clear();
      for (const entry of entries) store.put(entry);
      await finished(transaction);
    },
    async clear() {
      const transaction = database.transaction(COMPLETIONS, "readwrite");
      transaction.objectStore(COMPLETIONS).clear();
      await finished(transaction);
    },
  };
}

/** The store to use on this device, and nothing thrown when storage is off. */
export async function openDeviceStore(
  factory: IDBFactory | undefined = typeof indexedDB === "undefined" ? undefined : indexedDB,
): Promise<DeviceStore> {
  if (factory === undefined) return createMemoryStore();
  try {
    return wrap(await open(factory));
  } catch {
    return createMemoryStore();
  }
}
