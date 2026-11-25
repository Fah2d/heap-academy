import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  type Effect,
  INITIAL_STATE,
  type Intent,
  type LessonState,
  RUNTIME_TRANSITIONS,
  type RuntimeState,
  type RuntimeStateName,
  canStart,
  canStop,
  isRemembered,
  transition,
  type WorkspaceEvent,
  type WorkspaceEventType,
  type WorkspaceState,
} from "./workspace-chart";

const STATES: readonly RuntimeState[] = [
  { name: "idle" },
  { name: "loading", pending: null },
  { name: "failed" },
  { name: "ready" },
  { name: "running" },
  { name: "awaitingInput" },
  { name: "checking" },
  { name: "restarting", pending: null, reason: "crashed" },
];

const EVENTS: readonly WorkspaceEvent[] = [
  { type: "LESSON_OPENED" },
  { type: "RUNTIME_READY" },
  { type: "RUNTIME_FAILED" },
  { type: "RETRY" },
  { type: "RUN" },
  { type: "CHECK" },
  { type: "INPUT_REQUESTED" },
  { type: "INPUT_SUBMITTED" },
  { type: "RUN_DONE" },
  { type: "CHECK_DONE", allPassed: false },
  { type: "STOP" },
  { type: "TIME_LIMIT" },
  { type: "CRASH" },
  { type: "CODE_EDITED" },
];

const at = (runtime: RuntimeState, lesson: LessonState = "inProgress"): WorkspaceState => ({
  runtime,
  lesson,
});
const stateNamed = (name: RuntimeStateName) => STATES.find((state) => state.name === name)!;
const eventOf = (type: WorkspaceEventType) => EVENTS.find((event) => event.type === type)!;

/** The effect each target state's entry performs, with no pending intent. */
const ENTRY_EFFECTS: Record<RuntimeStateName, (from: RuntimeStateName) => Effect[]> = {
  idle: () => [],
  loading: () => ["loadRuntime"],
  failed: () => [],
  ready: () => [],
  running: (from) => (from === "awaitingInput" ? [] : ["startRun"]),
  awaitingInput: () => [],
  checking: () => ["startCheck"],
  restarting: () => ["restartRuntime"],
};

describe("the runtime region, transition by transition", () => {
  it.each(RUNTIME_TRANSITIONS.map((row) => [...row]))(
    "[FR-WSP-07] [FR-WSP-17] %s --%s--> %s",
    (from, type, to) => {
      const { state, effects } = transition(at(stateNamed(from)), eventOf(type));
      expect(state.runtime.name).toBe(to);
      expect(effects).toEqual(ENTRY_EFFECTS[to](from));
    },
  );

  it("[ADR-0020] every pair the table does not list changes nothing and asks for nothing", () => {
    let checked = 0;
    for (const runtime of STATES) {
      for (const event of EVENTS) {
        const listed = RUNTIME_TRANSITIONS.some(
          ([from, type]) => from === runtime.name && type === event.type,
        );
        if (listed || isRemembered(runtime.name, event.type)) continue;
        const before = at(runtime, "passed");
        const after = transition(before, event);
        expect(after.state, `${runtime.name} ${event.type}`).toBe(before);
        expect(after.effects).toEqual([]);
        checked += 1;
      }
    }
    expect(checked).toBe(STATES.length * EVENTS.length - RUNTIME_TRANSITIONS.length - 4);
  });

  it("[ADR-0020] the diagram in the architecture document is this table", () => {
    const text = readFileSync(
      new URL("../../docs/spec/02-architecture.md", import.meta.url),
      "utf8",
    );
    const section = text.slice(text.indexOf("## 6. Workspace lifecycle"));
    const start = section.indexOf("stateDiagram-v2");
    const diagram = section.slice(start, section.indexOf("```", start));
    const edges = [...diagram.matchAll(/^\s+(\w+) --> (\w+): (\w+)$/gm)].map(
      ([, from, to, event]) => `${from} ${event} ${to}`,
    );
    const table = RUNTIME_TRANSITIONS.map(([from, event, to]) => `${from} ${event} ${to}`);
    expect(edges.sort()).toEqual(table.sort());
  });

  it("[FR-WSP-07] a restart says why: stopped, time limit, or crash", () => {
    const reason = (from: RuntimeStateName, type: WorkspaceEventType) => {
      const runtime = transition(at(stateNamed(from)), eventOf(type)).state.runtime;
      return runtime.name === "restarting" ? runtime.reason : undefined;
    };
    expect(reason("running", "STOP")).toBe("stopped");
    expect(reason("checking", "TIME_LIMIT")).toBe("time_limit");
    expect(reason("ready", "CRASH")).toBe("crashed");
    expect(reason("awaitingInput", "CRASH")).toBe("crashed");
  });
});

describe("the pending intent", () => {
  const waiting = (pending: Intent | null): RuntimeState[] => [
    { name: "loading", pending },
    { name: "restarting", pending, reason: "time_limit" },
  ];

  it.each(waiting(null).map((state) => [state.name, state]))(
    "[FR-WSP-17] a Run while %s is kept, and starts when Python is ready",
    (_name, runtime) => {
      const kept = transition(at(runtime), { type: "RUN" });
      expect(kept.effects).toEqual([]);
      expect(kept.state.runtime).toMatchObject({ name: runtime.name, pending: "run" });
      const ready = transition(kept.state, { type: "RUNTIME_READY" });
      expect(ready.state.runtime).toEqual({ name: "running" });
      expect(ready.effects).toEqual(["startRun"]);
    },
  );

  it.each(waiting("run").map((state) => [state.name, state]))(
    "[FR-WSP-17] while %s, a later Check replaces an earlier Run: one intent at most",
    (_name, runtime) => {
      const kept = transition(at(runtime), { type: "CHECK" });
      expect(kept.state.runtime).toMatchObject({ pending: "check" });
      const ready = transition(kept.state, { type: "RUNTIME_READY" });
      expect(ready.state.runtime).toEqual({ name: "checking" });
      expect(ready.effects).toEqual(["startCheck"]);
    },
  );

  it.each(waiting("check").map((state) => [state.name, state]))(
    "[FR-WSP-17] a failed load while %s drops the intent, and Retry starts clean",
    (_name, runtime) => {
      const failed = transition(at(runtime), { type: "RUNTIME_FAILED" });
      expect(failed.state.runtime).toEqual({ name: "failed" });
      const retried = transition(failed.state, { type: "RETRY" });
      expect(retried.state.runtime).toEqual({ name: "loading", pending: null });
      expect(retried.effects).toEqual(["loadRuntime"]);
    },
  );

  it("[FR-WSP-07] a restart forgets nothing it should keep: a stop never queues the stopped run again", () => {
    const stopped = transition(at({ name: "running" }), { type: "STOP" });
    expect(stopped.state.runtime).toMatchObject({ name: "restarting", pending: null });
    expect(transition(stopped.state, { type: "RUNTIME_READY" }).state.runtime).toEqual({
      name: "ready",
    });
  });
});

describe("the lesson region", () => {
  it("[FR-WSP-17] starts untouched, and editing, running or checking marks it in progress", () => {
    expect(INITIAL_STATE).toEqual({ runtime: { name: "idle" }, lesson: "untouched" });
    for (const type of ["CODE_EDITED", "RUN", "CHECK"] as const) {
      expect(transition(at({ name: "ready" }, "untouched"), { type }).state.lesson).toBe(
        "inProgress",
      );
    }
  });

  it("[FR-WSP-17] a Run or Check the runtime does not take leaves an untouched lesson untouched", () => {
    const refusing: readonly RuntimeState[] = [
      { name: "idle" },
      { name: "failed" },
      { name: "running" },
      { name: "awaitingInput" },
      { name: "checking" },
    ];
    for (const runtime of refusing) {
      for (const type of ["RUN", "CHECK"] as const) {
        expect(transition(at(runtime, "untouched"), { type }).state.lesson).toBe("untouched");
      }
    }
  });

  it("[FR-WSP-17] a Run kept as the pending intent marks the lesson in progress", () => {
    for (const runtime of [
      { name: "loading", pending: null },
      { name: "restarting", pending: null, reason: "stopped" },
    ] as const) {
      expect(transition(at(runtime, "untouched"), { type: "RUN" }).state.lesson).toBe("inProgress");
    }
  });

  it("[FR-PRG-01] a check with every test case passing completes the lesson once", () => {
    const passed = transition(at({ name: "checking" }), { type: "CHECK_DONE", allPassed: true });
    expect(passed.state).toEqual({ runtime: { name: "ready" }, lesson: "passed" });
    expect(passed.effects).toEqual(["completeLesson"]);
    const again = transition(at({ name: "checking" }, "passed"), {
      type: "CHECK_DONE",
      allPassed: true,
    });
    expect(again.effects).toEqual([]);
  });

  it("[FR-PRG-01] a failing check does not complete it, and a pass is never taken back", () => {
    const failing = transition(at({ name: "checking" }), { type: "CHECK_DONE", allPassed: false });
    expect(failing.state.lesson).toBe("inProgress");
    const edited = transition(at({ name: "ready" }, "passed"), { type: "CODE_EDITED" });
    expect(edited.state.lesson).toBe("passed");
    expect(edited.effects).toEqual([]);
  });

  it("[FR-PRG-01] a CHECK_DONE outside a check completes nothing", () => {
    const stray = transition(at({ name: "ready" }), { type: "CHECK_DONE", allPassed: true });
    expect(stray.state.lesson).toBe("inProgress");
    expect(stray.effects).toEqual([]);
  });
});

describe("paths through the chart", () => {
  /** Breadth-first from idle: the shortest event path to each transition's source. */
  function shortestPaths(): Map<RuntimeStateName, WorkspaceEventType[]> {
    const paths = new Map<RuntimeStateName, WorkspaceEventType[]>([["idle", []]]);
    const queue: RuntimeStateName[] = ["idle"];
    while (queue.length > 0) {
      const from = queue.shift()!;
      for (const [source, event, to] of RUNTIME_TRANSITIONS) {
        if (source !== from || paths.has(to)) continue;
        paths.set(to, [...paths.get(from)!, event]);
        queue.push(to);
      }
    }
    return paths;
  }

  it("[ADR-0020] every state is reachable from idle, and every transition fires along a generated path", () => {
    const paths = shortestPaths();
    expect([...paths.keys()].sort()).toEqual(STATES.map((state) => state.name).sort());
    for (const [from, event, to] of RUNTIME_TRANSITIONS) {
      let state = INITIAL_STATE;
      for (const step of paths.get(from)!) state = transition(state, eventOf(step)).state;
      expect(state.runtime.name, `path to ${from}`).toBe(from);
      expect(transition(state, eventOf(event)).state.runtime.name).toBe(to);
    }
  });

  it("[FR-WSP-07] a runaway loop: run, time limit, restart, and the next run works", () => {
    const steps: WorkspaceEvent[] = [
      { type: "LESSON_OPENED" },
      { type: "RUNTIME_READY" },
      { type: "RUN" },
      { type: "TIME_LIMIT" },
      { type: "RUNTIME_READY" },
      { type: "RUN" },
      { type: "RUN_DONE" },
    ];
    const effects: Effect[] = [];
    let state = INITIAL_STATE;
    for (const step of steps) {
      const next = transition(state, step);
      state = next.state;
      effects.push(...next.effects);
    }
    expect(state.runtime).toEqual({ name: "ready" });
    expect(effects).toEqual(["loadRuntime", "startRun", "restartRuntime", "startRun"]);
  });
});

describe("controls", () => {
  it("[FR-WSP-07] Run and Check need ready; Stop applies while code runs, waits for input, or is checked", () => {
    for (const runtime of STATES) {
      expect(canStart(at(runtime)), runtime.name).toBe(runtime.name === "ready");
      expect(canStop(at(runtime)), runtime.name).toBe(
        ["running", "awaitingInput", "checking"].includes(runtime.name),
      );
    }
  });
});
