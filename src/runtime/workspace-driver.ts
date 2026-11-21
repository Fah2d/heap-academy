import type { ControllerEvent, RunRequest } from "./controller.ts";
import type { Effect, WorkspaceEvent, WorkspaceState } from "./workspace-chart.ts";

// Connects the workspace statechart to the runtime controller (architecture
// sections 5 and 6, ADR-0020; FR-WSP-07, FR-WSP-17). Pure: it maps what the
// controller reports to the chart's events, and the chart's effects to calls
// on the controller, so the interface only dispatches and renders.

/** The chart event a controller event means, given the chart's state; undefined for none. */
export function chartEventFor(
  event: ControllerEvent,
  state: WorkspaceState,
): WorkspaceEvent | undefined {
  switch (event.type) {
    case "ready":
      return { type: "RUNTIME_READY" };
    case "failed":
      return { type: "RUNTIME_FAILED" };
    case "input_request":
      return { type: "INPUT_REQUESTED" };
    case "input":
    case "input_end":
      return { type: "INPUT_SUBMITTED" };
    case "run_done":
      switch (event.result.outcome.kind) {
        case "time_limit":
          return { type: "TIME_LIMIT" };
        case "crashed":
          return { type: "CRASH" };
        // The learner's STOP already moved the chart.
        case "stopped":
          return undefined;
        // The program ended, well or with its own error; a memory error or
        // the output cap also brings a new worker, which arrives as
        // `restarting` while the chart is ready.
        case "ok":
        case "syntax":
        case "runtime":
        case "input_ended":
        case "memory":
        case "output_limit":
          return { type: "RUN_DONE" };
        default: {
          const unreachable: never = event.result.outcome;
          return unreachable;
        }
      }
    case "check_done":
      // Only the controller sets `ended`; the test results came from the
      // worker and never decide how a check ended.
      switch (event.ended) {
        case "time_limit":
          return { type: "TIME_LIMIT" };
        case "crashed":
          return { type: "CRASH" };
        // The learner's STOP already moved the chart.
        case "stopped":
          return undefined;
        case undefined:
          return { type: "CHECK_DONE", allPassed: event.summary.allPassed };
        default: {
          const unreachable: never = event.ended;
          return unreachable;
        }
      }
    case "restarting":
      // A new worker while the chart is at rest: the worker died while idle,
      // or the controller replaced it after a run or check that ran out of
      // memory or reached the output cap. The diagram draws both as CRASH;
      // the reason tells them apart. In any other state the chart has already
      // moved, or, for a check that asked for a fresh worker, the controller
      // holds the check until it is ready.
      if (state.runtime.name !== "ready") return undefined;
      return event.reason === "memory" || event.reason === "output_limit"
        ? { type: "CRASH", reason: event.reason }
        : { type: "CRASH" };
    case "progress":
    case "output":
    case "test_result":
      return undefined;
    default: {
      const unreachable: never = event;
      return unreachable;
    }
  }
}

/** What the effects call. `run` and `check` send the editor's current code. */
export type DriverPorts = {
  start: () => void;
  stop: () => void;
  run: () => RunRequest;
  check: () => RunRequest;
  complete: () => void;
};

/**
 * Carries out a transition's effects. `restartRuntime` asks the controller to
 * stop only for the learner's STOP: on a time limit or a crash the controller
 * has already replaced the worker by itself (section 5.4). Returns the
 * refusals, which mean the chart and the controller disagree.
 */
export function performEffects(
  effects: readonly Effect[],
  cause: WorkspaceEvent,
  ports: DriverPorts,
): RunRequest[] {
  const refused: RunRequest[] = [];
  for (const effect of effects) {
    switch (effect) {
      case "loadRuntime":
        ports.start();
        break;
      case "restartRuntime":
        if (cause.type === "STOP") ports.stop();
        break;
      case "startRun": {
        const request = ports.run();
        if (!request.ok) refused.push(request);
        break;
      }
      case "startCheck": {
        const request = ports.check();
        if (!request.ok) refused.push(request);
        break;
      }
      case "completeLesson":
        ports.complete();
        break;
      default: {
        const unreachable: never = effect;
        return unreachable;
      }
    }
  }
  return refused;
}
