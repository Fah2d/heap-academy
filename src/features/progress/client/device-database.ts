// The one IndexedDB database this site keeps on the learner's device
// (docs/spec/02-architecture.md section 10): the code they typed (FR-WSP-10)
// and the lessons they passed (FR-PRG-01), each in its own store. Every
// reader opens it here, at one version, so no reader asks for a version
// another reader has already moved past.

export const DEVICE_DATABASE = "heap-academy";
/** 1: the code store (WP-5.2). 2: adds the completion store (WP-5.4). */
export const DEVICE_DATABASE_VERSION = 2;
export const CODE_STORE = "code";
export const COMPLETION_STORE = "completions";

const STORES = [CODE_STORE, COMPLETION_STORE] as const;

/** One request's answer, or its error. */
export function settle<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => {
      resolve(request.result);
    };
    request.onerror = () => {
      reject(request.error ?? new Error("IndexedDB request failed"));
    };
  });
}

/**
 * The database, with every store created. An open tab that holds an older
 * version closes its connection when this one asks to upgrade, so the
 * upgrade is not blocked; that tab's next request then fails, and its
 * stores fall back to memory.
 */
export function openDeviceDatabase(factory: IDBFactory): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = factory.open(DEVICE_DATABASE, DEVICE_DATABASE_VERSION);
    request.onupgradeneeded = () => {
      const database = request.result;
      for (const store of STORES) {
        if (!database.objectStoreNames.contains(store)) database.createObjectStore(store);
      }
    };
    request.onsuccess = () => {
      const database = request.result;
      database.onversionchange = () => {
        database.close();
      };
      resolve(database);
    };
    request.onerror = () => {
      reject(request.error ?? new Error("IndexedDB open failed"));
    };
    request.onblocked = () => {
      reject(new Error("IndexedDB open blocked"));
    };
  });
}

/** The database once per caller, or undefined when there is none or it refuses. */
export function lazyDeviceDatabase(
  factory: IDBFactory | undefined,
): () => Promise<IDBDatabase | undefined> {
  let database: Promise<IDBDatabase | undefined> | undefined;
  return () => {
    database ??=
      factory === undefined
        ? Promise.resolve(undefined)
        : openDeviceDatabase(factory).catch(() => undefined);
    return database;
  };
}
