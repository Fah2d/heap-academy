import type { ControllerEvent, ControllerStatus, RunResult } from "@/runtime/controller";
import type { OutputStream } from "@/runtime/protocol";

// What the development runtime page shows, built from the controller's
// events. Pure, so it is tested without a browser.

export type RuntimeView = {
  status: ControllerStatus;
  progress: { loadedBytes: number; totalBytes: number } | undefined;
  output: { stream: OutputStream; text: string }[];
  result: RunResult | undefined;
  restarts: number;
  /** How many messages the controller dropped or acted on. A count, not a
   * list, so a late timer that prints for ever cannot grow it without limit. */
  dropped: number;
};

export const INITIAL_VIEW: RuntimeView = {
  status: "idle",
  progress: undefined,
  output: [],
  result: undefined,
  restarts: 0,
  dropped: 0,
};

export function reduceView(
  view: RuntimeView,
  event: ControllerEvent,
  status: ControllerStatus,
): RuntimeView {
  switch (event.type) {
    case "progress":
      return { ...view, status, progress: event };
    case "ready":
    case "failed":
      return { ...view, status };
    case "output": {
      const last = view.output[view.output.length - 1];
      const output =
        last !== undefined && last.stream === event.stream
          ? [...view.output.slice(0, -1), { stream: last.stream, text: last.text + event.text }]
          : [...view.output, { stream: event.stream, text: event.text }];
      return { ...view, status, output };
    }
    case "run_done":
      return { ...view, status, result: event.result };
    case "restarting":
      return { ...view, status, restarts: view.restarts + 1, progress: undefined };
    // This page sends runs only; a check's results belong to the workspace (WP-5.2).
    case "test_result":
    case "check_done":
      return { ...view, status };
    default: {
      const unreachable: never = event;
      return unreachable;
    }
  }
}

/** A new run starts with empty output and no result. */
export function startRun(view: RuntimeView, status: ControllerStatus): RuntimeView {
  return { ...view, status, output: [], result: undefined };
}

/** Counts one message the controller dropped or acted on. */
export function addReport(view: RuntimeView): RuntimeView {
  return { ...view, dropped: view.dropped + 1 };
}
