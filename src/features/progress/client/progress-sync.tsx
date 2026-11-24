"use client";

import { useEffect } from "react";
import { deviceProgress } from "./device-progress";
import { startProgressSync, type SyncPorts } from "./sync";

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
    const sync = startProgressSync(store, {
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
    });
    const unsubscribe = store.subscribe((completion) => {
      void sync.send(completion);
    });
    return () => {
      unsubscribe();
      sync.stop();
    };
  }, [mergeProgress, recordCompletion]);
  return null;
}
