// The workspace statechart (docs/spec/02-architecture.md section 6,
// ADR-0020; FR-WSP-07, FR-WSP-17). Two regions: the runtime, which follows
// the diagram in the architecture document transition for transition, and
// the lesson. It is a typed reducer with no framework and no library: a
// transition is a pure function from a state and an event to the next state
// and the effects the caller must perform. The controller and the interface
// carry the effects out; the chart never touches the worker itself.
//
// ADR-0020 left the choice between a statechart library and a typed reducer
// to this package. The reducer wins: the transition table below is data, so
// every transition is tested from it, paths are generated from it, and the
// architecture diagram is checked against it, with no dependency.

/** What the learner asked for while Python was not ready (section 5.7). */
export type Intent = "run" | "check";

/** Why the runtime is restarting, for the explanation the learner sees (FR-WSP-07). */
export type RestartReason = "stopped" | "time_limit" | "crashed" | ReplaceReason;

/**
 * Why the controller replaced a worker that was still alive, after a run or
 * check that ran out of memory or reached the output cap (section 5.4). The
 * diagram draws this as CRASH from `ready`; the reason keeps the learner's
 * explanation true. Recorded as a proposed spec change in the WP-3.4 description.
 */
export type ReplaceReason = "memory" | "output_limit";

export type RuntimeState =
  | { name: "idle" }
  | { name: "loading"; pending: Intent | null }
  | { name: "failed" }
  | { name: "ready" }
  | { name: "running" }
  | { name: "awaitingInput" }
  | { name: "checking" }
  | { name: "restarting"; pending: Intent | null; reason: RestartReason };

export type RuntimeStateName = RuntimeState["name"];

export type LessonState = "untouched" | "inProgress" | "passed";

export type WorkspaceState = { runtime: RuntimeState; lesson: LessonState };

export type WorkspaceEvent =
  | { type: "LESSON_OPENED" }
  | { type: "RUNTIME_READY" }
  | { type: "RUNTIME_FAILED" }
  | { type: "RETRY" }
  | { type: "RUN" }
  | { type: "CHECK" }
  | { type: "INPUT_REQUESTED" }
  | { type: "INPUT_SUBMITTED" }
  | { type: "RUN_DONE" }
  /** `allPassed`: every test case of the check passed. */
  | { type: "CHECK_DONE"; allPassed: boolean }
  | { type: "STOP" }
  | { type: "TIME_LIMIT" }
  /** `reason`: set when the controller replaced a live worker on purpose. */
  | { type: "CRASH"; reason?: ReplaceReason }
  /** The learner changed the code. Only the lesson region listens. */
  | { type: "CODE_EDITED" };

export type WorkspaceEventType = WorkspaceEvent["type"];

/** What the caller must do after a transition, in order. */
export type Effect =
  /** Start the runtime: create the worker and load Python. */
  | "loadRuntime"
  /** Terminate the worker and start a new one (section 5.4). */
  | "restartRuntime"
  /** Send the editor's code as a run. */
  | "startRun"
  /** Send the editor's code and the lesson's test cases as a check. */
  | "startCheck"
  /** Record the lesson as complete: the first passing check (FR-PRG-01). */
  | "completeLesson";

export type Transition = { state: WorkspaceState; effects: Effect[] };

export const INITIAL_STATE: WorkspaceState = { runtime: { name: "idle" }, lesson: "untouched" };

/**
 * Every transition of the runtime region, as the architecture diagram draws
 * it: from, event, to. A pending intent that fires on RUNTIME_READY passes
 * through `ready` on the way to `running` or `checking`; the table lists the
 * diagram's edge, and `transition` applies the intent after it.
 */
export const RUNTIME_TRANSITIONS: readonly (readonly [
  RuntimeStateName,
  WorkspaceEventType,
  RuntimeStateName,
])[] = [
  ["idle", "LESSON_OPENED", "loading"],
  ["loading", "RUNTIME_READY", "ready"],
  ["loading", "RUNTIME_FAILED", "failed"],
  ["failed", "RETRY", "loading"],
  ["ready", "RUN", "running"],
  ["ready", "CHECK", "checking"],
  ["running", "INPUT_REQUESTED", "awaitingInput"],
  ["awaitingInput", "INPUT_SUBMITTED", "running"],
  ["running", "RUN_DONE", "ready"],
  ["checking", "CHECK_DONE", "ready"],
  ["running", "STOP", "restarting"],
  ["running", "TIME_LIMIT", "restarting"],
  ["running", "CRASH", "restarting"],
  ["awaitingInput", "STOP", "restarting"],
  ["awaitingInput", "CRASH", "restarting"],
  ["checking", "STOP", "restarting"],
  ["checking", "TIME_LIMIT", "restarting"],
  ["checking", "CRASH", "restarting"],
  ["ready", "CRASH", "restarting"],
  ["restarting", "RUNTIME_READY", "ready"],
  ["restarting", "RUNTIME_FAILED", "failed"],
];

/**
 * Events that change nothing in the runtime region but are not ignored:
 * a Run or Check while Python loads or restarts is kept as the one pending
 * intent (section 6), the later request replacing the earlier one.
 */
const REMEMBERED: readonly (readonly [RuntimeStateName, WorkspaceEventType])[] = [
  ["loading", "RUN"],
  ["loading", "CHECK"],
  ["restarting", "RUN"],
  ["restarting", "CHECK"],
];

export function isRemembered(state: RuntimeStateName, event: WorkspaceEventType): boolean {
  return REMEMBERED.some(([from, type]) => from === state && type === event);
}

const RESTART_REASON: Partial<Record<WorkspaceEventType, RestartReason>> = {
  STOP: "stopped",
  TIME_LIMIT: "time_limit",
  CRASH: "crashed",
};

function target(from: RuntimeStateName, event: WorkspaceEventType): RuntimeStateName | undefined {
  return RUNTIME_TRANSITIONS.find(([state, type]) => state === from && type === event)?.[2];
}

/**
 * `taken`: the runtime region accepted the event or kept it as the pending
 * intent. A Run or Check it refused (while failed, running, and so on) does
 * not count as working on the lesson.
 */
function lessonAfter(
  lesson: LessonState,
  event: WorkspaceEvent,
  checked: boolean,
  taken: boolean,
): LessonState {
  if (lesson === "passed") return "passed";
  if (event.type === "CHECK_DONE" && checked && event.allPassed) return "passed";
  if (event.type === "CODE_EDITED") return "inProgress";
  if ((event.type === "RUN" || event.type === "CHECK") && taken) return "inProgress";
  return lesson;
}

/** The next state and the effects to perform. An event the current state does not take changes nothing. */
export function transition(state: WorkspaceState, event: WorkspaceEvent): Transition {
  const from = state.runtime;
  const effects: Effect[] = [];
  let runtime: RuntimeState = from;
  let checked = false;
  let taken = false;

  if (
    (from.name === "loading" || from.name === "restarting") &&
    isRemembered(from.name, event.type)
  ) {
    taken = true;
    runtime = { ...from, pending: event.type === "RUN" ? "run" : "check" };
  } else {
    const to = target(from.name, event.type);
    if (to !== undefined) {
      taken = true;
      checked = from.name === "checking" && event.type === "CHECK_DONE";
      runtime = enter(to, from, event, effects);
    }
  }

  const lesson = lessonAfter(state.lesson, event, checked, taken);
  if (lesson === "passed" && state.lesson !== "passed") effects.push("completeLesson");

  if (runtime === from && lesson === state.lesson && effects.length === 0) {
    return { state, effects };
  }
  return { state: { runtime, lesson }, effects };
}

function enter(
  to: RuntimeStateName,
  from: RuntimeState,
  event: WorkspaceEvent,
  effects: Effect[],
): RuntimeState {
  switch (to) {
    case "loading":
      effects.push("loadRuntime");
      return { name: "loading", pending: null };
    case "restarting": {
      effects.push("restartRuntime");
      const reason =
        event.type === "CRASH" && event.reason !== undefined
          ? event.reason
          : RESTART_REASON[event.type];
      if (reason === undefined) throw new Error(`No restart reason for ${event.type}`);
      return { name: "restarting", pending: null, reason };
    }
    case "running":
      // Back from input, the run goes on; it was already started.
      if (from.name !== "awaitingInput") effects.push("startRun");
      return { name: "running" };
    case "checking":
      effects.push("startCheck");
      return { name: "checking" };
    case "ready": {
      // The pending intent fires as soon as Python is ready (section 5.7).
      const pending = from.name === "loading" || from.name === "restarting" ? from.pending : null;
      if (pending === "run") {
        effects.push("startRun");
        return { name: "running" };
      }
      if (pending === "check") {
        effects.push("startCheck");
        return { name: "checking" };
      }
      return { name: "ready" };
    }
    case "idle":
    case "failed":
    case "awaitingInput":
      return { name: to };
    default: {
      const unreachable: never = to;
      return unreachable;
    }
  }
}

/** Whether Python can take a Run or Check right now, for the controls' state. */
export function canStart(state: WorkspaceState): boolean {
  return state.runtime.name === "ready";
}

/** Whether a Stop control applies (FR-WSP-07). */
export function canStop(state: WorkspaceState): boolean {
  const name = state.runtime.name;
  return name === "running" || name === "awaitingInput" || name === "checking";
}
