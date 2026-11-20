"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { runtimeAssetBase } from "@/runtime/assets";
import { createPythonWorker } from "@/runtime/browser";
import { createRuntimeController, type RuntimeController } from "@/runtime/controller";
import { addReport, INITIAL_VIEW, reduceView, type RuntimeView, startRun } from "./runtime-view";

/** Starts the Python runtime when the page opens and ends it when the page closes. */
export function useRuntime(): {
  view: RuntimeView;
  run: (source: string, stdin: string[] | undefined) => void;
  sendInput: (line: string) => void;
  endInput: () => void;
  stop: () => void;
} {
  const [view, setView] = useState<RuntimeView>(INITIAL_VIEW);
  const controller = useRef<RuntimeController | undefined>(undefined);

  useEffect(() => {
    const created = createRuntimeController({
      createWorker: createPythonWorker,
      assetBase: runtimeAssetBase,
      timers: {
        setTimeout: (callback, delayMs) => window.setTimeout(callback, delayMs),
        clearTimeout: (handle) => {
          if (typeof handle === "number") window.clearTimeout(handle);
        },
      },
      now: () => performance.now(),
      onEvent: (event) => {
        setView((current) => reduceView(current, event, created.status));
      },
      report: (report) => {
        setView((current) => addReport(current, report));
      },
    });
    controller.current = created;
    created.start();
    return () => {
      created.dispose();
      controller.current = undefined;
    };
  }, []);

  const run = useCallback((source: string, stdin: string[] | undefined) => {
    const current = controller.current;
    if (current === undefined) return;
    const request = current.run(source, stdin);
    if (request.ok) setView((previous) => startRun(previous, current.status));
  }, []);

  const sendInput = useCallback((line: string) => {
    controller.current?.sendInput(line);
  }, []);

  const endInput = useCallback(() => {
    controller.current?.endInput();
  }, []);

  const stop = useCallback(() => {
    controller.current?.stop();
  }, []);

  return { view, run, sendInput, endInput, stop };
}
