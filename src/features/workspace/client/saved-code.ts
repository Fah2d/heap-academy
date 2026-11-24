// The learner's code, kept on this device as they type (FR-WSP-10;
// docs/spec/02-architecture.md section 10). It lives in IndexedDB, in the
// database WP-5.4's progress store will share: a later version adds that
// store beside this one. Where IndexedDB is missing or refuses (a private
// window in some browsers, storage turned off), the code is kept in memory
// for as long as the page is open, and the workspace still works.

export const CODE_DATABASE = "heap-academy";
export const CODE_DATABASE_VERSION = 1;
export const CODE_STORE = "code";

export type CodeStore = {
  /** The code saved for this lesson, or undefined when there is none. */
  load: (key: string) => Promise<string | undefined>;
  save: (key: string, code: string) => Promise<void>;
};

/** One lesson's key: its course's address and its own. */
export const savedCodeKey = (course: string, lesson: string) => `${course}/${lesson}`;

function settle<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => {
      resolve(request.result);
    };
    request.onerror = () => {
      reject(request.error ?? new Error("IndexedDB request failed"));
    };
  });
}

function openDatabase(factory: IDBFactory): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = factory.open(CODE_DATABASE, CODE_DATABASE_VERSION);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(CODE_STORE)) database.createObjectStore(CODE_STORE);
    };
    request.onsuccess = () => {
      resolve(request.result);
    };
    request.onerror = () => {
      reject(request.error ?? new Error("IndexedDB open failed"));
    };
    request.onblocked = () => {
      reject(new Error("IndexedDB open blocked"));
    };
  });
}

/**
 * A store over `factory` (the browser's `indexedDB`), or over memory alone
 * when `factory` is undefined or fails. Every value read back is checked:
 * anything but a string counts as no saved code.
 */
export function createCodeStore(factory: IDBFactory | undefined): CodeStore {
  const memory = new Map<string, string>();
  let database: Promise<IDBDatabase | undefined> | undefined;

  const open = (): Promise<IDBDatabase | undefined> => {
    if (database === undefined) {
      database =
        factory === undefined
          ? Promise.resolve(undefined)
          : (async () => {
              try {
                return await openDatabase(factory);
              } catch {
                return undefined;
              }
            })();
    }
    return database;
  };

  return {
    load: async (key) => {
      const remembered = memory.get(key);
      if (remembered !== undefined) return remembered;
      const opened = await open();
      if (opened === undefined) return undefined;
      try {
        const value: unknown = await settle(
          opened.transaction(CODE_STORE, "readonly").objectStore(CODE_STORE).get(key),
        );
        return typeof value === "string" ? value : undefined;
      } catch {
        return undefined;
      }
    },
    save: async (key, code) => {
      memory.set(key, code);
      const opened = await open();
      if (opened === undefined) return;
      try {
        await settle(
          opened.transaction(CODE_STORE, "readwrite").objectStore(CODE_STORE).put(code, key),
        );
      } catch {
        // The memory copy stays; the next save tries the database again.
      }
    },
  };
}
