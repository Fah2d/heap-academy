import { type DeviceBackend, memoryBackend } from "./device-store";
import type { DeviceCompletion } from "@/domain/progress";

// The IndexedDB backend: the whole list is one record, changed in one
// readwrite transaction, so a second tab cannot lose an entry
// (docs/spec/02-architecture.md section 10).

const DATABASE = "heap-academy";
const STORE = "progress";
const KEY = "completions";

function request<T>(source: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    source.onsuccess = () => resolve(source.result);
    source.onerror = () => reject(source.error ?? new Error("IndexedDB request failed"));
  });
}

function open(factory: IDBFactory): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const opening = factory.open(DATABASE, 1);
    opening.onupgradeneeded = () => opening.result.createObjectStore(STORE);
    opening.onsuccess = () => resolve(opening.result);
    opening.onerror = () => reject(opening.error ?? new Error("IndexedDB did not open"));
    opening.onblocked = () => reject(new Error("IndexedDB is blocked"));
  });
}

function finished(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error ?? new Error("IndexedDB write failed"));
    transaction.onabort = () => reject(transaction.error ?? new Error("IndexedDB write aborted"));
  });
}

/**
 * IndexedDB when it opens, memory when it does not (a private window, a
 * blocked profile, no support). The learner is told when it is memory.
 */
export async function openDeviceBackend(factory: IDBFactory | undefined): Promise<DeviceBackend> {
  if (factory === undefined) return memoryBackend();
  let database: IDBDatabase;
  try {
    database = await open(factory);
  } catch {
    return memoryBackend();
  }
  return {
    durable: true,
    async read() {
      return request(database.transaction(STORE, "readonly").objectStore(STORE).get(KEY));
    },
    async update(change) {
      const transaction = database.transaction(STORE, "readwrite");
      const store = transaction.objectStore(STORE);
      const current = await request(store.get(KEY));
      const next: DeviceCompletion[] = change(current);
      store.put(next, KEY);
      await finished(transaction);
    },
  };
}
