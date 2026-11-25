import { runtimeAssetBase } from "@/runtime/assets";
import { createPythonWorker } from "@/runtime/browser";
import {
  type ControllerEvent,
  type ControllerReport,
  createRuntimeController,
  type RuntimeController,
} from "@/runtime/controller";
import { createControllerChecks } from "./controller-checks";
import type { CheckProgram } from "./validate-lesson";

// The Python the lesson editor validates with: the learners' runtime
// controller, started when the editor opens (the "Python loading" state of
// docs/spec/03-experience.md section 8), and ended when it closes.

export type PythonState = "loading" | "ready" | "failed";

export type ValidationRuntime = {
  checkProgram: CheckProgram;
  /** Stops the check in progress, or the one waiting for Python. */
  stop: () => void;
  /** Starts Python again after it failed. */
  retry: () => void;
  dispose: () => void;
};

/** Opens the runtime; the editor calls it once, in an effect, and passes a fake in tests. */
export type OpenValidationRuntime = (onState: (state: PythonState) => void) => ValidationRuntime;

type ValidationController = Pick<RuntimeController, "check" | "stop" | "start" | "dispose">;

export function connectValidationRuntime(
  createController: (onEvent: (event: ControllerEvent) => void) => ValidationController,
  onState: (state: PythonState) => void,
): ValidationRuntime {
  const listeners: ((event: ControllerEvent) => void)[] = [];
  const controller = createController((event) => {
    for (const listener of listeners) listener(event);
  });
  const checks = createControllerChecks(controller);
  listeners.push(checks.handle, (event) => {
    // A restart between two programs is part of a validation, not a new load.
    if (event.type === "ready") onState("ready");
    else if (event.type === "failed") onState("failed");
  });
  onState("loading");
  controller.start();
  return {
    checkProgram: checks.checkProgram,
    stop: checks.cancel,
    retry: () => {
      onState("loading");
      controller.start();
    },
    dispose: () => {
      checks.dispose();
      controller.dispose();
    },
  };
}

/**
 * A message the controller dropped, or a worker that failed, goes to the
 * page's error reporting (.claude/rules/runtimes.md: drop and report). Only
 * the code is sent; the message's content stays in the page.
 */
export function reportControllerProblem(
  report: ControllerReport,
  send: (error: Error) => void = (error) => {
    reportError(error);
  },
): void {
  send(new Error(`validation_runtime_${report.code}`));
}

/** The runtime in a browser: a module worker running Pyodide (architecture section 5.1). */
export const openBrowserValidationRuntime: OpenValidationRuntime = (onState) =>
  connectValidationRuntime(
    (onEvent) =>
      createRuntimeController({
        createWorker: createPythonWorker,
        assetBase: runtimeAssetBase,
        timers: {
          setTimeout: (callback, delayMs) => window.setTimeout(callback, delayMs),
          clearTimeout: (handle) => {
            if (typeof handle === "number") window.clearTimeout(handle);
          },
        },
        now: () => performance.now(),
        onEvent,
        // The controller already recovers (it restarts the worker on a fatal
        // message); a validation that cannot finish says so in the editor.
        report: (report) => reportControllerProblem(report),
      }),
    onState,
  );
