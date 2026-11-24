import { CODE_STORE, lazyDeviceDatabase, settle } from "@/features/progress";

// The learner's code, kept on this device as they type (FR-WSP-10;
// docs/spec/02-architecture.md section 10). It lives in IndexedDB, in the
// database the progress store shares (src/features/progress). Where
// IndexedDB is missing or refuses (a private window in some browsers,
// storage turned off), the code is kept in memory for as long as the page is
// open, and the workspace still works.

export { CODE_STORE };

export type CodeStore = {
  /** The code saved for this lesson, or undefined when there is none. */
  load: (key: string) => Promise<string | undefined>;
  save: (key: string, code: string) => Promise<void>;
};

/** One lesson's key: its course's address and its own. */
export const savedCodeKey = (course: string, lesson: string) => `${course}/${lesson}`;

/**
 * A store over `factory` (the browser's `indexedDB`), or over memory alone
 * when `factory` is undefined or fails. Every value read back is checked:
 * anything but a string counts as no saved code.
 */
export function createCodeStore(factory: IDBFactory | undefined): CodeStore {
  const memory = new Map<string, string>();
  const database = lazyDeviceDatabase(factory);

  return {
    load: async (key) => {
      const remembered = memory.get(key);
      if (remembered !== undefined) return remembered;
      const opened = await database.open();
      if (opened === undefined) return undefined;
      try {
        const value: unknown = await settle(
          opened.transaction(CODE_STORE, "readonly").objectStore(CODE_STORE).get(key),
        );
        return typeof value === "string" ? value : undefined;
      } catch {
        // The connection may have closed: the next request opens it again.
        database.reset();
        return undefined;
      }
    },
    save: async (key, code) => {
      memory.set(key, code);
      const opened = await database.open();
      if (opened === undefined) return;
      try {
        await settle(
          opened.transaction(CODE_STORE, "readwrite").objectStore(CODE_STORE).put(code, key),
        );
      } catch {
        // The memory copy stays; the next save opens the database again.
        database.reset();
      }
    },
  };
}
