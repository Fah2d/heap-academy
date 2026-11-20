import type {
  ControllerEvent,
  ControllerReport,
  ControllerStatus,
  RunResult,
} from "@/runtime/controller";
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
  restarts: number;
  dropped: ControllerReport["code"][];
};

export const INITIAL_VIEW: RuntimeView = {
  status: "idle",
  interactiveInput: false,
  progress: undefined,
  output: [],
  result: undefined,
  restarts: 0,
  dropped: [],
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
    case "run_done":
      return { ...view, status, result: event.result };
    case "restarting":
      return { ...view, status, restarts: view.restarts + 1, progress: undefined };
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

export function addReport(view: RuntimeView, report: ControllerReport): RuntimeView {
  return { ...view, dropped: [...view.dropped, report.code] };
}
