import { useEffect, useState } from "react";
import { deviceProgress } from "./device-progress";
import type { ProgressStore } from "./progress-store";

/**
 * The IDs of the lessons completed on this device, or undefined until the
 * device has answered (docs/spec/02-architecture.md section 10: a guest's
 * progress is filled in on the client). Read again after each new completion
 * in this page, and when the tab is shown again, so a lesson passed in
 * another tab appears on return.
 */
export function useDeviceCompletions(
  store: () => ProgressStore = deviceProgress,
): ReadonlySet<string> | undefined {
  const [completed, setCompleted] = useState<ReadonlySet<string>>();
  useEffect(() => {
    const progress = store();
    let live = true;
    const read = () => {
      void progress.completions().then((list) => {
        if (live) setCompleted(new Set(list.map((completion) => completion.lessonId)));
      });
    };
    const shown = () => {
      if (document.visibilityState === "visible") read();
    };
    read();
    const unsubscribe = progress.subscribe(read);
    document.addEventListener("visibilitychange", shown);
    window.addEventListener("pageshow", read);
    return () => {
      live = false;
      unsubscribe();
      document.removeEventListener("visibilitychange", shown);
      window.removeEventListener("pageshow", read);
    };
  }, [store]);
  return completed;
}
