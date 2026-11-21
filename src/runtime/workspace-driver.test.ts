import { describe, expect, it } from "vitest";
import { HARNESS_VERSION } from "../grader/harness.ts";
import type { TestCaseId } from "../grader/test-case.ts";
import { createRuntimeController, TIME_LIMIT_MS, type WorkerLike } from "./controller.ts";
import { createRunId, type PageMessage } from "./protocol.ts";
import {
  INITIAL_STATE,
  transition,
  type WorkspaceEvent,
  type WorkspaceState,
} from "./workspace-chart.ts";
import { chartEventFor, performEffects } from "./workspace-driver.ts";

// The chart driving the real controller, with a fake worker and a fake clock
// (FR-WSP-07, FR-WSP-17; WP-3.4). The browser run is the development page.

const at = (name: "ready" | "running" | "checking"): WorkspaceState => ({
  runtime: { name },
  lesson: "untouched",
});
const runId = createRunId(1);
const result = (kind: "ok" | "time_limit" | "crashed" | "stopped" | "memory") => ({
  type: "run_done" as const,
  result: {
    runId,
    outcome: kind === "ok" ? { kind } : kind === "memory" ? { kind, message: "" } : { kind },
    truncated: false,
    durationMs: 1,
  },
});
const summary = (allPassed: boolean) => ({
  total: 1,
  passed: allPassed ? 1 : 0,
  failed: allPassed ? 0 : 1,
  notRun: 0,
  allPassed,
  timeLimit: false,
});
const failedBy = (
  reason: "time_limit" | "stopped" | "crashed" | "mismatch",
  ended?: "time_limit" | "stopped" | "crashed",
) => ({
  type: "check_done" as const,
  runId,
  results: [
    {
      testCaseId: "t" as TestCaseId,
      status: "failed" as const,
      reason,
      actual: "",
      truncated: false,
      harnessVersion: HARNESS_VERSION,
    },
  ],
  summary: summary(false),
  ...(ended === undefined ? {} : { ended }),
});

describe("chartEventFor [FR-WSP-07]", () => {
  it("maps the controller's lifecycle and input events", () => {
    const s = at("running");
    expect(
      chartEventFor({ type: "ready", runtimeVersion: "1", interactiveInput: true }, s),
    ).toEqual({
      type: "RUNTIME_READY",
    });
    expect(chartEventFor({ type: "failed" }, s)).toEqual({ type: "RUNTIME_FAILED" });
    expect(chartEventFor({ type: "input_request", runId }, s)).toEqual({ type: "INPUT_REQUESTED" });
    expect(chartEventFor({ type: "input", runId, line: "x" }, s)).toEqual({
      type: "INPUT_SUBMITTED",
    });
    expect(chartEventFor({ type: "input_end", runId }, s)).toEqual({ type: "INPUT_SUBMITTED" });
  });

  it("maps how a run ended, and leaves a stop to the learner's STOP", () => {
    const s = at("running");
    expect(chartEventFor(result("ok"), s)).toEqual({ type: "RUN_DONE" });
    expect(chartEventFor(result("memory"), s)).toEqual({ type: "RUN_DONE" });
    expect(chartEventFor(result("time_limit"), s)).toEqual({ type: "TIME_LIMIT" });
    expect(chartEventFor(result("crashed"), s)).toEqual({ type: "CRASH" });
    expect(chartEventFor(result("stopped"), s)).toBeUndefined();
  });

  it("maps how a check ended", () => {
    const s = at("checking");
    const passed = {
      type: "check_done" as const,
      runId,
      results: [],
      summary: summary(true),
    };
    expect(chartEventFor(passed, s)).toEqual({ type: "CHECK_DONE", allPassed: true });
    expect(chartEventFor(failedBy("mismatch"), s)).toEqual({
      type: "CHECK_DONE",
      allPassed: false,
    });
    expect(chartEventFor(failedBy("time_limit", "time_limit"), s)).toEqual({
      type: "TIME_LIMIT",
    });
    expect(chartEventFor(failedBy("crashed", "crashed"), s)).toEqual({ type: "CRASH" });
    expect(chartEventFor(failedBy("stopped", "stopped"), s)).toBeUndefined();
  });

  it("[FR-RUN-02] reads how a check ended only from the controller, never from a result", () => {
    const s = at("checking");
    for (const reason of ["time_limit", "stopped", "crashed"] as const) {
      expect(chartEventFor(failedBy(reason), s)).toEqual({ type: "CHECK_DONE", allPassed: false });
    }
  });

  it("reads a new worker as CRASH only when the chart is at rest", () => {
    expect(chartEventFor({ type: "restarting", reason: "crashed" }, at("ready"))).toEqual({
      type: "CRASH",
    });
    for (const reason of ["memory", "output_limit"] as const) {
      expect(chartEventFor({ type: "restarting", reason }, at("ready"))).toEqual({
        type: "CRASH",
        reason,
      });
    }
    expect(
      chartEventFor({ type: "restarting", reason: "isolation" }, at("checking")),
    ).toBeUndefined();
    expect(
      chartEventFor({ type: "restarting", reason: "time_limit" }, at("running")),
    ).toBeUndefined();
  });

  it("ignores output, progress and single results", () => {
    const s = at("running");
    expect(
      chartEventFor({ type: "output", runId, stream: "stdout", text: "x" }, s),
    ).toBeUndefined();
    expect(chartEventFor({ type: "progress", loadedBytes: 1, totalBytes: 2 }, s)).toBeUndefined();
  });
});

describe("performEffects [FR-WSP-07]", () => {
  function ports() {
    const calls: string[] = [];
    return {
      calls,
      ports: {
        start: () => calls.push("start"),
        stop: () => calls.push("stop"),
        run: () => (calls.push("run"), { ok: true as const, runId }),
        check: () => (calls.push("check"), { ok: false as const, error: "not_ready" as const }),
        complete: () => calls.push("complete"),
      },
    };
  }

  it("stops the controller only for the learner's STOP", () => {
    const stop = ports();
    performEffects(["restartRuntime"], { type: "STOP" }, stop.ports);
    expect(stop.calls).toEqual(["stop"]);
    const limit = ports();
    performEffects(["restartRuntime"], { type: "TIME_LIMIT" }, limit.ports);
    expect(limit.calls).toEqual([]);
  });

  it("performs effects in order and returns refusals", () => {
    const given = ports();
    const refused = performEffects(
      ["loadRuntime", "startRun", "startCheck", "completeLesson"],
      { type: "RUN" },
      given.ports,
    );
    expect(given.calls).toEqual(["start", "run", "check", "complete"]);
    expect(refused).toEqual([{ ok: false, error: "not_ready" }]);
  });
});

// The loop the development page runs: chart, driver and controller together.
function workspace(interactiveInput = true) {
  const workers: (WorkerLike & { received: PageMessage[]; send: (data: unknown) => void })[] = [];
  let time = 0;
  const timers = new Map<number, { at: number; callback: () => void }>();
  let nextTimer = 1;
  let state = INITIAL_STATE;
  const completed: number[] = [];
  const refusals: unknown[] = [];
  const tests = [
    {
      id: "t" as TestCaseId,
      name: "t",
      stdin: "",
      afterCode: "",
      expected: "1",
      match: "normalized" as const,
      hint: "",
    },
  ];
  const controller = createRuntimeController({
    createWorker: () => {
      const listeners: ((event: { data?: unknown }) => void)[] = [];
      const worker = {
        received: [] as PageMessage[],
        postMessage: (message: PageMessage) => worker.received.push(message),
        terminate: () => undefined,
        addEventListener: (type: string, listener: (event: { data?: unknown }) => void) => {
          if (type === "message") listeners.push(listener);
        },
        send: (data: unknown) => {
          for (const listener of listeners) listener({ data });
        },
      };
      workers.push(worker);
      return worker;
    },
    assetBase: "/_runtime/pyodide/314.0.7/",
    timers: {
      setTimeout: (callback, delayMs) => {
        timers.set(nextTimer, { at: time + delayMs, callback });
        return nextTimer++;
      },
      clearTimeout: (handle) => timers.delete(handle as number),
    },
    now: () => time,
    onEvent: (event) => {
      const chartEvent = chartEventFor(event, state);
      if (chartEvent !== undefined) dispatch(chartEvent);
    },
    report: () => undefined,
  });
  function dispatch(event: WorkspaceEvent) {
    const next = transition(state, event);
    state = next.state;
    refusals.push(
      ...performEffects(next.effects, event, {
        start: () => {
          controller.start();
        },
        stop: () => {
          controller.stop();
        },
        run: () => controller.run("program"),
        check: () => controller.check("program", tests),
        complete: () => completed.push(1),
      }),
    );
  }
  const latest = () => workers[workers.length - 1]!;
  const ready = () =>
    latest().send({ type: "ready", runtimeVersion: "314.0.7", capabilities: { interactiveInput } });
  const lastRunId = () => {
    const message = latest().received.at(-1);
    if (message === undefined || !("runId" in message)) throw new Error("no run sent");
    return message.runId;
  };
  const advance = (ms: number) => {
    time += ms;
    for (const [id, timer] of [...timers]) {
      if (timer.at <= time) {
        timers.delete(id);
        timer.callback();
      }
    }
  };
  return {
    dispatch,
    ready,
    latest,
    lastRunId,
    advance,
    controller,
    completed,
    refusals,
    state: () => state,
  };
}

describe("the chart driving the controller [FR-WSP-07, FR-WSP-17]", () => {
  it("keeps a Run pressed while Python loads, and runs it on ready", () => {
    const w = workspace();
    w.dispatch({ type: "LESSON_OPENED" });
    expect(w.controller.status).toBe("loading");
    w.dispatch({ type: "RUN" });
    expect(w.state().runtime).toEqual({ name: "loading", pending: "run" });
    w.ready();
    expect(w.state().runtime.name).toBe("running");
    expect(w.controller.status).toBe("running");
    expect(w.refusals).toEqual([]);
  });

  it("[FR-WSP-08] pauses for input and goes on after the answer", () => {
    const w = workspace();
    w.dispatch({ type: "LESSON_OPENED" });
    w.ready();
    w.dispatch({ type: "RUN" });
    const id = w.lastRunId();
    w.latest().send({ type: "input_request", runId: id });
    expect(w.state().runtime.name).toBe("awaitingInput");
    w.controller.sendInput("Sara");
    expect(w.state().runtime.name).toBe("running");
    w.latest().send({
      type: "run_done",
      runId: id,
      outcome: { kind: "ok" },
      truncated: false,
      durationMs: 3,
    });
    expect(w.state().runtime.name).toBe("ready");
  });

  it("[FR-RUN-02] a runaway loop reaches the time limit, a new worker starts, and Run works again", () => {
    const w = workspace();
    w.dispatch({ type: "LESSON_OPENED" });
    w.ready();
    w.dispatch({ type: "RUN" });
    w.advance(TIME_LIMIT_MS);
    expect(w.state().runtime).toEqual({ name: "restarting", pending: null, reason: "time_limit" });
    expect(w.controller.status).toBe("restarting");
    w.ready();
    expect(w.state().runtime.name).toBe("ready");
    w.dispatch({ type: "RUN" });
    expect(w.controller.status).toBe("running");
  });

  it("[FR-WSP-07] Stop ends a run and the chart explains why", () => {
    const w = workspace();
    w.dispatch({ type: "LESSON_OPENED" });
    w.ready();
    w.dispatch({ type: "RUN" });
    w.dispatch({ type: "STOP" });
    expect(w.state().runtime).toEqual({ name: "restarting", pending: null, reason: "stopped" });
    expect(w.controller.status).toBe("restarting");
  });

  it("[FR-PRG-01] a passing check completes the lesson once", () => {
    const w = workspace();
    w.dispatch({ type: "LESSON_OPENED" });
    w.ready();
    for (let round = 0; round < 2; round += 1) {
      w.dispatch({ type: "CHECK" });
      const id = w.lastRunId();
      w.latest().send({
        type: "test_result",
        runId: id,
        result: {
          testCaseId: "t",
          status: "passed",
          actual: "1\n",
          truncated: false,
          harnessVersion: HARNESS_VERSION,
        },
      });
      w.latest().send({ type: "check_done", runId: id, summary: summary(true) });
      expect(w.state()).toEqual({ runtime: { name: "ready" }, lesson: "passed" });
    }
    expect(w.completed).toEqual([1]);
  });

  it("[NFR-REL-03] a run out of memory finishes, then the new worker shows as a restart", () => {
    const w = workspace();
    w.dispatch({ type: "LESSON_OPENED" });
    w.ready();
    w.dispatch({ type: "RUN" });
    w.latest().send({
      type: "run_done",
      runId: w.lastRunId(),
      outcome: { kind: "memory", message: "MemoryError" },
      truncated: false,
      durationMs: 3,
    });
    expect(w.state().runtime).toEqual({ name: "restarting", pending: null, reason: "memory" });
    w.ready();
    expect(w.state().runtime.name).toBe("ready");
    expect(w.refusals).toEqual([]);
  });

  it("[FR-WSP-17] a check pressed during a restart waits, then runs", () => {
    const w = workspace();
    w.dispatch({ type: "LESSON_OPENED" });
    w.ready();
    w.dispatch({ type: "RUN" });
    w.dispatch({ type: "STOP" });
    w.dispatch({ type: "CHECK" });
    expect(w.state().runtime).toEqual({ name: "restarting", pending: "check", reason: "stopped" });
    w.ready();
    expect(w.state().runtime.name).toBe("checking");
    expect(w.controller.status).toBe("checking");
  });
});
