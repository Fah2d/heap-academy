import type { DeviceCompletion } from "@/domain/progress";

// The progress store on the device (FR-PRG-01, FR-PRG-06; architecture
// section 10). The store only keeps entries; the rules for what to keep are in
// `src/domain/progress.ts`. Every method answers with a promise so IndexedDB
// and memory share one shape.

export type DeviceStoreKind = "indexeddb" | "memory";

export type DeviceStore = {
  /** Where entries live. `memory` means they are lost when the tab closes. */
  readonly kind: DeviceStoreKind;
  list(): Promise<DeviceCompletion[]>;
  /**
   * Keeps a completion. A lesson the device already has is left as it is:
   * passing twice stores once.
   */
  add(completion: DeviceCompletion): Promise<void>;
  /** Replaces every entry with `entries`, in one step. */
  replaceAll(entries: readonly DeviceCompletion[]): Promise<void>;
  /** Removes every entry (sign-out clears device progress). */
  clear(): Promise<void>;
};

/** One entry per lesson, the first in the list. */
function firstOfEach(entries: readonly DeviceCompletion[]): DeviceCompletion[] {
  const seen = new Set<string>();
  return entries.filter((entry) => {
    if (seen.has(entry.lessonId)) return false;
    seen.add(entry.lessonId);
    return true;
  });
}

export function createMemoryStore(initial: readonly DeviceCompletion[] = []): DeviceStore {
  let entries = firstOfEach(initial);
  return {
    kind: "memory",
    list: () => Promise.resolve(entries.map((entry) => ({ ...entry }))),
    add: (completion) => {
      if (!entries.some((entry) => entry.lessonId === completion.lessonId)) {
        entries = [...entries, { ...completion }];
      }
      return Promise.resolve();
    },
    replaceAll: (next) => {
      entries = firstOfEach(next).map((entry) => ({ ...entry }));
      return Promise.resolve();
    },
    clear: () => {
      entries = [];
      return Promise.resolve();
    },
  };
}
