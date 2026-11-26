import type { ControllerEvent, ControllerStatus, RunResult } from "@/runtime/controller";
import type { CheckSummary, TestResult } from "@/grader/grade";
import type { OutputStream } from "@/runtime/protocol";

// What the development runtime page shows, built from the controller's
// events. Pure, so it is tested without a browser.

/** What the console shows: the program's output, and the answers the learner typed. */
export type ConsoleStream = OutputStream | "input";

export type RuntimeView = {
  status: ControllerStatus;
  /** Whether the runtime can pause a program for input, as it said at ready. */
  interactiveInput: boolean;
  progress: { loadedBytes: number; totalBytes: number } | undefined;
  output: { stream: ConsoleStream; text: string }[];
  result: RunResult | undefined;
  /** The current or last check's results, in test case order, and its summary once done. */
  tests: TestResult[];
  summary: CheckSummary | undefined;
  restarts: number;
  /** How many messages the controller dropped or acted on. A count, not a
   * list, so a late timer that prints for ever cannot grow it without limit. */
  dropped: number;
  /** Runs and checks the controller refused although the chart sent them. */
  refused: number;
};

export const INITIAL_VIEW: RuntimeView = {
  status: "idle",
  interactiveInput: false,
  progress: undefined,
  output: [],
  result: undefined,
  tests: [],
  summary: undefined,
  restarts: 0,
  dropped: 0,
  refused: 0,
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
      return { ...view, status, interactiveInput: event.interactiveInput };
    case "failed":
    case "input_request":
    case "input_end":
      return { ...view, status };
    case "output":
      return { ...view, status, output: append(view.output, event.stream, event.text) };
    case "input":
      // The answer is echoed where the program asked for it (FR-WSP-08).
      return { ...view, status, output: append(view.output, "input", `${event.line}\n`) };
    // The controller reports the end before it sets its own status, so the
    // status it shows at this moment is still the busy one. A worker
    // replacement that follows arrives as `restarting` and corrects it.
    case "run_done":
      return { ...view, status: "ready", result: event.result };
    case "restarting":
      return { ...view, status, restarts: view.restarts + 1, progress: undefined };
    case "test_result":
      return { ...view, status, tests: [...view.tests, event.result] };
    case "check_done":
      return { ...view, status: "ready", tests: event.results, summary: event.summary };
    default: {
      const unreachable: never = event;
      return unreachable;
    }
  }
}

function append(
  output: RuntimeView["output"],
  stream: ConsoleStream,
  text: string,
): RuntimeView["output"] {
  const last = output[output.length - 1];
  return last !== undefined && last.stream === stream
    ? [...output.slice(0, -1), { stream, text: last.text + text }]
    : [...output, { stream, text }];
}

/** A new run starts with empty output and no result. */
export function startRun(view: RuntimeView, status: ControllerStatus): RuntimeView {
  return { ...view, status, output: [], result: undefined };
}

/** A new check starts with no results. */
export function startCheck(view: RuntimeView, status: ControllerStatus): RuntimeView {
  return { ...view, status, tests: [], summary: undefined };
}

export function addRefusal(view: RuntimeView, count: number): RuntimeView {
  return { ...view, refused: view.refused + count };
}

/** Counts one message the controller dropped or acted on. */
export function addReport(view: RuntimeView): RuntimeView {
  return { ...view, dropped: view.dropped + 1 };
}
