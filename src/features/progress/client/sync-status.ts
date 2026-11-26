// Whether a completed lesson is still waiting to reach the account
// (docs/spec/03-experience.md section 10, "Unsynced completion"). The sync
// writes it and the workspace reads it. Only a signed-in learner has a sync,
// so for a guest it stays false.

let unsyncedNow = false;
const listeners = new Set<() => void>();

export const syncStatus = {
  unsynced: () => unsyncedNow,
  set: (unsynced: boolean) => {
    if (unsynced === unsyncedNow) return;
    unsyncedNow = unsynced;
    for (const listener of listeners) listener();
  },
  subscribe: (listener: () => void) => {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },
};
