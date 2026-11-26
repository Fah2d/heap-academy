import { createProgressStore, type ProgressStore } from "./progress-store";

let store: ProgressStore | undefined;

/** The page's one progress store over the browser's IndexedDB, made on first use. */
export function deviceProgress(): ProgressStore {
  store ??= createProgressStore(typeof indexedDB === "undefined" ? undefined : indexedDB);
  return store;
}
