"use client";

import { useEffect } from "react";
import { deviceProgress } from "./device-progress";
import { startProgressSync, type SyncPorts, type SyncState } from "./sync";
import { syncStatus } from "./sync-status";

/**
 * Keeps the device's completions and the account's in step while a learner is
 * signed in (FR-PRG-02, FR-PRG-03, FR-PRG-06; docs/spec/02-architecture.md
 * section 10): on load, when the tab shows, and after each pass. The server
 * renders it for a signed-in learner only, and passes in the two actions.
 */
export function ProgressSync({
  mergeProgress,
  recordCompletion,
}: Pick<SyncPorts, "mergeProgress" | "recordCompletion">) {
  useEffect(() => {
    const store = deviceProgress();
    // The latest state wins: a count that finishes late is ignored.
    let latest = 0;
    const publish = (state: SyncState) => {
      if (state === "syncing") return;
      const turn = ++latest;
      if (state === "idle") {
        syncStatus.set(false);
        return;
      }
      void store.pending().then((pending) => {
        if (turn === latest) syncStatus.set(pending.length > 0);
      });
    };
    const ports: SyncPorts = {
      mergeProgress,
      recordCompletion,
      isVisible: () => document.visibilityState === "visible",
      onVisible: (listener) => {
        document.addEventListener("visibilitychange", listener);
        return () => {
          document.removeEventListener("visibilitychange", listener);
        };
      },
      setTimer: (callback, milliseconds) => window.setTimeout(callback, milliseconds),
      clearTimer: (timer) => {
        window.clearTimeout(timer as number);
      },
    };
    const sync = startProgressSync(store, ports, publish);
    const unsubscribe = store.subscribe((completion) => {
      void sync.send(completion);
    });
    return () => {
      unsubscribe();
      sync.stop();
      latest += 1;
      syncStatus.set(false);
    };
  }, [mergeProgress, recordCompletion]);
  return null;
}
