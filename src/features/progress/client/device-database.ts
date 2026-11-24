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
 * version closes its connection when another tab asks to upgrade, so the
 * upgrade is not blocked; `onClosed` then lets the caller open again, and
 * the older version's open fails, so its stores fall back to memory.
 */
export function openDeviceDatabase(
  factory: IDBFactory,
  onClosed: () => void = () => undefined,
): Promise<IDBDatabase> {
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
        onClosed();
      };
      // The browser closes it too, when the site's data is cleared.
      database.onclose = onClosed;
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

export type DeviceDatabase = {
  /** The open database, or undefined when there is none or it refuses. */
  open: () => Promise<IDBDatabase | undefined>;
  /** Forgets the connection, so the next `open` asks again: after a request failed. */
  reset: () => void;
};

/** The database opened once and kept, until it closes or a request on it fails. */
export function lazyDeviceDatabase(factory: IDBFactory | undefined): DeviceDatabase {
  let database: Promise<IDBDatabase | undefined> | undefined;
  const reset = () => {
    database = undefined;
  };
  return {
    open: () => {
      database ??=
        factory === undefined
          ? Promise.resolve(undefined)
          : openDeviceDatabase(factory, reset).catch(() => undefined);
      return database;
    },
    reset,
  };
}

/** Whether a request failed because its key is already stored. */
export const isTaken = (error: unknown) =>
  typeof error === "object" &&
  error !== null &&
  (error as { name?: unknown }).name === "ConstraintError";
