import { HARNESS_VERSION } from "../grader/harness.ts";
import type { TestCaseId } from "../grader/test-case.ts";
import { describe, expect, it } from "vitest";
import {
  type ControllerEvent,
  type ControllerReport,
  createRuntimeController,
  type RuntimeController,
  TIME_LIMIT_MS,
  type WorkerLike,
} from "./controller.ts";
import {
  createRunId,
  OUTPUT_LIMIT,
  type PageMessage,
  type RunId,
  type WorkerOutcome,
} from "./protocol.ts";

// The controller with a fake worker and a fake clock. The real worker and
// the real clock are in the browser tests (e2e/runtime.spec.ts).

type FakeWorker = WorkerLike & {
  received: PageMessage[];
  terminated: boolean;
  send: (data: unknown) => void;
  fail: () => void;
  garble: () => void;
};

function fakeWorker(): FakeWorker {
  const listeners = new Map<string, ((event: { data?: unknown }) => void)[]>();
  const worker: FakeWorker = {
    received: [],
    terminated: false,
    postMessage: (message) => worker.received.push(message),
    terminate: () => (worker.terminated = true),
    addEventListener: (type, listener) => {
      listeners.set(type, [...(listeners.get(type) ?? []), listener]);
    },
    send: (data) => listeners.get("message")?.forEach((listener) => listener({ data })),
    fail: () => listeners.get("error")?.forEach((listener) => listener({})),
    garble: () => listeners.get("messageerror")?.forEach((listener) => listener({})),
  };
  return worker;
}

/** Listeners that run after the event or report is recorded, with the controller. */
type Listeners = {
  onEvent?: (event: ControllerEvent, controller: RuntimeController) => void;
  report?: (report: ControllerReport, controller: RuntimeController) => void;
};

function setUp(listen: Listeners = {}) {
  const workers: FakeWorker[] = [];
  const events: ControllerEvent[] = [];
  const reports: ControllerReport[] = [];
  let time = 0;
  const timers = new Map<number, { at: number; callback: () => void }>();
  let nextTimer = 1;
  const controller = createRuntimeController({
    createWorker: () => {
      const worker = fakeWorker();
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
      events.push(event);
      listen.onEvent?.(event, controller);
    },
    report: (report) => {
      reports.push(report);
      listen.report?.(report, controller);
    },
  });
  const advance = (ms: number) => {
    time += ms;
    for (const [id, timer] of [...timers]) {
      if (timer.at <= time) {
        timers.delete(id);
        timer.callback();
      }
    }
  };
  const latest = () => workers[workers.length - 1] as FakeWorker;
  const makeReady = () =>
    latest().send({
      type: "ready",
      runtimeVersion: "314.0.7",
      capabilities: { interactiveInput: false },
    });
  return {
    controller,
    workers,
    events,
    reports,
    advance,
    latest,
    makeReady,
    timers,
  };
}

function started(listen: Listeners = {}) {
  const setup = setUp(listen);
  setup.controller.start();
  setup.makeReady();
  setup.events.length = 0;
  return setup;
}

describe("runtime controller", () => {
  it("[FR-RUN-01] starts a worker with the asset base and becomes ready", () => {
    const setup = setUp();
    setup.controller.start();
    expect(setup.latest().received).toEqual([
      { type: "init", assetBase: "/_runtime/pyodide/314.0.7/", harnessVersion: HARNESS_VERSION },
    ]);
    setup.latest().send({ type: "progress", loadedBytes: 5, totalBytes: 10 });
    setup.makeReady();
    expect(setup.controller.status).toBe("ready");
    expect(setup.events).toEqual([
      { type: "progress", loadedBytes: 5, totalBytes: 10 },
      { type: "ready", runtimeVersion: "314.0.7", interactiveInput: false },
    ]);
  });

  it("[FR-RUN-01] refuses a run until the runtime is ready", () => {
    const setup = setUp();
    setup.controller.start();
    expect(setup.controller.run("print(1)")).toEqual({ ok: false, error: "not_ready" });
  });

  it("[FR-RUN-01] sends a batch run, passes its output on, and reports the result", () => {
    const setup = started();
    const request = setup.controller.run("print(1)", ["Ada"]);
    if (!request.ok) throw new Error("run refused");
    const { runId } = request;
    expect(setup.latest().received.at(-1)).toEqual({
      type: "run",
      runId,
      source: "print(1)",
      mode: "batch",
      stdin: ["Ada"],
    });
    setup.latest().send({ type: "output", runId, stream: "stdout", text: "1\n" });
    setup.latest().send({
      type: "run_done",
      runId,
      outcome: { kind: "ok" },
      truncated: false,
      durationMs: 4,
    });
    expect(setup.events).toEqual([
      { type: "output", runId, stream: "stdout", text: "1\n" },
      {
        type: "run_done",
        result: { runId, outcome: { kind: "ok" }, truncated: false, durationMs: 4 },
      },
    ]);
    expect(setup.controller.status).toBe("ready");
    expect(setup.timers.size).toBe(0);
  });

  it("[FR-RUN-02] ends a run at the time limit from outside, and the next worker runs", () => {
    const setup = started();
    const request = setup.controller.run("while True: pass");
    if (!request.ok) throw new Error("run refused");
    setup.advance(TIME_LIMIT_MS - 1);
    expect(setup.workers[0]?.terminated).toBe(false);
    setup.advance(1);
    expect(setup.workers[0]?.terminated).toBe(true);
    expect(setup.events).toEqual([
      {
        type: "run_done",
        result: {
          runId: request.runId,
          outcome: { kind: "time_limit" },
          truncated: false,
          durationMs: TIME_LIMIT_MS,
        },
      },
      { type: "restarting", reason: "time_limit" },
    ]);
    expect(setup.workers).toHaveLength(2);
    setup.makeReady();
    expect(setup.controller.run("print(2)").ok).toBe(true);
  });

  it("[FR-RUN-02] stopping terminates the worker and reports the run as stopped", () => {
    const setup = started();
    const request = setup.controller.run("while True: pass");
    if (!request.ok) throw new Error("run refused");
    setup.controller.stop();
    expect(setup.workers[0]?.terminated).toBe(true);
    expect(setup.events.map((event) => event.type)).toEqual(["run_done", "restarting"]);
    expect(setup.events[0]).toMatchObject({ result: { outcome: { kind: "stopped" } } });
    expect(setup.timers.size).toBe(0);
  });

  it("[FR-RUN-06] a worker that dies during a run reports crashed and is replaced", () => {
    const setup = started();
    setup.controller.run("x");
    setup.latest().fail();
    expect(setup.events[0]).toMatchObject({ result: { outcome: { kind: "crashed" } } });
    expect(setup.events[1]).toEqual({ type: "restarting", reason: "crashed" });
    expect(setup.reports).toEqual([{ code: "worker_error" }]);
    expect(setup.workers).toHaveLength(2);
  });

  it("[FR-RUN-06] a worker that dies while idle is replaced too", () => {
    const setup = started();
    setup.latest().send({ type: "fatal", reason: "runtime_crashed" });
    expect(setup.events).toEqual([{ type: "restarting", reason: "crashed" }]);
    expect(setup.workers[0]?.terminated).toBe(true);
  });

  it("[FR-RUN-06] after a memory error the run is reported and a new worker starts", () => {
    const setup = started();
    const request = setup.controller.run("bomb");
    if (!request.ok) throw new Error("run refused");
    setup.latest().send({
      type: "run_done",
      runId: request.runId,
      outcome: { kind: "memory", message: "MemoryError", line: 1 },
      truncated: false,
      durationMs: 900,
    });
    expect(setup.events.map((event) => event.type)).toEqual(["run_done", "restarting"]);
    expect(setup.workers).toHaveLength(2);
  });

  it("[FR-RUN-03] after the output cap the run is reported and a new worker starts", () => {
    const setup = started();
    const request = setup.controller.run("flood");
    if (!request.ok) throw new Error("run refused");
    setup.latest().send({
      type: "run_done",
      runId: request.runId,
      outcome: { kind: "output_limit", message: "" },
      truncated: true,
      durationMs: 40,
    });
    expect(setup.events[1]).toEqual({ type: "restarting", reason: "output_limit" });
    expect(setup.workers[0]?.terminated).toBe(true);
    expect(setup.workers).toHaveLength(2);
  });

  it("[FR-RUN-03] reports the cap as reached when a program that hit it runs into the time limit", () => {
    const setup = started();
    const request = setup.controller.run("flood that catches the error");
    if (!request.ok) throw new Error("run refused");
    const text = "x".repeat(OUTPUT_LIMIT / 2);
    for (const _ of [1, 2]) {
      setup.latest().send({ type: "output", runId: request.runId, stream: "stdout", text });
    }
    setup.advance(TIME_LIMIT_MS);
    expect(setup.events[2]).toMatchObject({
      result: { outcome: { kind: "time_limit" }, truncated: true },
    });
  });

  it("[FR-RUN-03] a run that prints exactly the cap and ends is not reported as cut", () => {
    const setup = started();
    const request = setup.controller.run("print exactly the cap");
    if (!request.ok) throw new Error("run refused");
    const text = "x".repeat(OUTPUT_LIMIT);
    setup.latest().send({ type: "output", runId: request.runId, stream: "stdout", text });
    setup.latest().send({
      type: "run_done",
      runId: request.runId,
      outcome: { kind: "ok" },
      truncated: false,
      durationMs: 3,
    });
    expect(setup.events[1]).toMatchObject({
      result: { outcome: { kind: "ok" }, truncated: false },
    });
  });

  it("[FR-RUN-02] a run under the cap that reaches the time limit is not reported as cut", () => {
    const setup = started();
    setup.controller.run("loop");
    setup.advance(TIME_LIMIT_MS);
    expect(setup.events[0]).toMatchObject({ result: { truncated: false } });
  });

  it("[FR-RUN-06] a new worker that dies before it is ready fails, without starting another", () => {
    const setup = started();
    setup.controller.run("loop");
    setup.advance(TIME_LIMIT_MS);
    expect(setup.controller.status).toBe("restarting");
    setup.latest().fail();
    expect(setup.controller.status).toBe("failed");
    expect(setup.workers).toHaveLength(2);
    setup.workers[1]?.send({ type: "fatal", reason: "load_failed" });
    expect(setup.workers).toHaveLength(2);
  });

  it("[NFR-SEC-01] reports a message that could not be read as its own code", () => {
    const setup = started();
    setup.latest().garble();
    expect(setup.reports).toEqual([{ code: "message_error" }]);
  });

  it("[FR-RUN-06] a runtime that cannot start fails, and can be started again", () => {
    const setup = setUp();
    setup.controller.start();
    setup.latest().send({ type: "fatal", reason: "load_failed" });
    expect(setup.controller.status).toBe("failed");
    expect(setup.events).toEqual([{ type: "failed" }]);
    setup.controller.start();
    expect(setup.workers).toHaveLength(2);
  });

  it("[NFR-SEC-01] drops and reports malformed messages and messages for another run", () => {
    const setup = started();
    setup.latest().send({ type: "output", runId: "run-9", stream: "stdout", text: "fake" });
    setup.latest().send({ type: "run_done", runId: "run-1", outcome: null });
    setup.latest().send("<script>");
    expect(setup.events).toEqual([]);
    expect(setup.reports).toEqual([
      { code: "unexpected_message", messageType: "output" },
      // A null outcome: null never crosses the boundary (pitfall 2).
      { code: "malformed_message", error: "not_an_object" },
      { code: "malformed_message", error: "not_an_object" },
    ]);
  });

  it("[FR-RUN-02] ignores a terminated worker's late messages", () => {
    const setup = started();
    const request = setup.controller.run("loop");
    if (!request.ok) throw new Error("run refused");
    setup.controller.stop();
    setup.events.length = 0;
    setup.workers[0]?.send({
      type: "output",
      runId: request.runId,
      stream: "stdout",
      text: "late",
    });
    expect(setup.events).toEqual([]);
    expect(setup.reports).toEqual([]);
  });

  it("[NFR-SEC-01] refuses a run the worker would refuse", () => {
    const setup = started();
    expect(setup.controller.run("x".repeat(100_001))).toEqual({ ok: false, error: "invalid" });
    expect(setup.controller.status).toBe("ready");
  });

  it("[FR-RUN-01] dispose ends the worker and its timer", () => {
    const setup = started();
    setup.controller.run("loop");
    setup.controller.dispose();
    expect(setup.latest().terminated).toBe(true);
    expect(setup.timers.size).toBe(0);
    expect(setup.controller.status).toBe("disposed");
  });

  type Setup = ReturnType<typeof setUp>;
  const runDone = (setup: Setup, runId: RunId | undefined, outcome: WorkerOutcome) =>
    setup.latest().send({ type: "run_done", runId, outcome, truncated: false, durationMs: 1 });

  // Every way a run or a ready worker ends in a restart.
  const restarts: [string, boolean, (setup: Setup, runId: RunId | undefined) => void][] = [
    ["the time limit", true, (setup) => setup.advance(TIME_LIMIT_MS)],
    ["stop", true, (setup) => setup.controller.stop()],
    ["a worker error during a run", true, (setup) => setup.latest().fail()],
    [
      "a fatal message during a run",
      true,
      (setup) => setup.latest().send({ type: "fatal", reason: "runtime_crashed" }),
    ],
    [
      "a memory error",
      true,
      (setup, runId) => runDone(setup, runId, { kind: "memory", message: "", line: 1 }),
    ],
    [
      "the output limit",
      true,
      (setup, runId) => runDone(setup, runId, { kind: "output_limit", message: "" }),
    ],
    ["a worker error while ready", false, (setup) => setup.latest().fail()],
    [
      "a fatal message while ready",
      false,
      (setup) => setup.latest().send({ type: "fatal", reason: "runtime_crashed" }),
    ],
  ];

  /** Starts a run if asked, ends it with the trigger, and checks the controller stays disposed. */
  function expectDisposed(
    setup: Setup,
    withRun: boolean,
    trigger: (setup: Setup, runId: RunId | undefined) => void,
    lastEvent: ControllerEvent["type"] | undefined,
  ) {
    let runId: RunId | undefined;
    if (withRun) {
      const request = setup.controller.run("while True: pass");
      if (!request.ok) throw new Error("run refused");
      runId = request.runId;
    }
    trigger(setup, runId);
    expect(setup.events.at(-1)?.type).toBe(lastEvent);
    expect(setup.workers).toHaveLength(1);
    expect(setup.workers[0]?.terminated).toBe(true);
    expect(setup.timers.size).toBe(0);
    expect(setup.controller.status).toBe("disposed");
    setup.controller.start();
    expect(setup.workers).toHaveLength(1);
  }

  it.each(restarts)(
    "[FR-RUN-01] dispose from the restarting event after %s starts no new worker",
    (_name, withRun, trigger) => {
      const setup = started({
        onEvent: (event, controller) => {
          if (event.type === "restarting") controller.dispose();
        },
      });
      expectDisposed(setup, withRun, trigger, "restarting");
    },
  );

  it.each(restarts.filter(([, withRun]) => withRun))(
    "[FR-RUN-01] dispose from the run_done event after %s starts no new worker",
    (_name, withRun, trigger) => {
      const setup = started({
        onEvent: (event, controller) => {
          if (event.type === "run_done") controller.dispose();
        },
      });
      expectDisposed(setup, withRun, trigger, "run_done");
    },
  );

  it("[FR-RUN-01] dispose from the run_done event of a finished run keeps the status disposed", () => {
    const setup = started({
      onEvent: (event, controller) => {
        if (event.type === "run_done") controller.dispose();
      },
    });
    expectDisposed(setup, true, (s, runId) => runDone(s, runId, { kind: "ok" }), "run_done");
    expect(setup.controller.run("print(1)")).toEqual({ ok: false, error: "not_ready" });
  });

  it.each([
    ["a worker error", (setup: Setup) => setup.latest().fail()],
    [
      "a fatal message",
      (setup: Setup) => setup.latest().send({ type: "fatal", reason: "runtime_crashed" }),
    ],
  ])(
    "[FR-RUN-01] dispose from the report of %s sends no failed and allows no start",
    (_name, trigger) => {
      const setup = started({ report: (_report, controller) => controller.dispose() });
      expectDisposed(setup, true, trigger, undefined);
    },
  );

  it.each([
    ["a worker error", (setup: Setup) => setup.latest().fail()],
    [
      "a fatal message",
      (setup: Setup) => setup.latest().send({ type: "fatal", reason: "load_failed" }),
    ],
  ])(
    "[FR-RUN-01] dispose from the report of %s while loading sends no failed and allows no start",
    (_name, trigger) => {
      const setup = setUp({ report: (_report, controller) => controller.dispose() });
      setup.controller.start();
      trigger(setup);
      expect(setup.events).toEqual([]);
      expect(setup.workers).toHaveLength(1);
      expect(setup.workers[0]?.terminated).toBe(true);
      expect(setup.controller.status).toBe("disposed");
      setup.controller.start();
      setup.makeReady();
      expect(setup.workers).toHaveLength(1);
      expect(setup.controller.status).toBe("disposed");
    },
  );
});

describe("runtime controller: checks", () => {
  const test = (id: string) => ({
    id: id as TestCaseId,
    name: id,
    stdin: "",
    afterCode: "",
    expected: "1",
    match: "normalized" as const,
    hint: "",
  });
  const tests = [test("first"), test("second"), test("third")];
  const passed = (id: string) => ({
    testCaseId: id,
    status: "passed",
    actual: "1\n",
    truncated: false,
    harnessVersion: HARNESS_VERSION,
  });

  function checking(listen: Listeners = {}) {
    const setup = started(listen);
    const request = setup.controller.check("print(1)", tests);
    if (!request.ok) throw new Error("check refused");
    return { ...setup, runId: request.runId };
  }

  it("[FR-GRD-01] sends a check, passes each result on, and reports the results and the summary", () => {
    const setup = checking();
    const { runId } = setup;
    expect(setup.controller.status).toBe("checking");
    expect(setup.latest().received.at(-1)).toEqual({
      type: "check",
      runId,
      source: "print(1)",
      tests,
    });
    for (const id of ["first", "second", "third"]) {
      setup.latest().send({ type: "test_result", runId, result: passed(id) });
    }
    const summary = {
      total: 3,
      passed: 3,
      failed: 0,
      notRun: 0,
      allPassed: true,
      timeLimit: false,
    };
    setup.latest().send({ type: "check_done", runId, summary });
    expect(setup.events.map((event) => event.type)).toEqual([
      "test_result",
      "test_result",
      "test_result",
      "check_done",
    ]);
    expect(setup.events.at(-1)).toEqual({
      type: "check_done",
      runId,
      results: ["first", "second", "third"].map(passed),
      summary,
    });
    expect(setup.controller.status).toBe("ready");
    expect(setup.workers).toHaveLength(1);
  });

  it("[FR-RUN-02] gives each test case the full time limit", () => {
    const setup = checking();
    setup.advance(TIME_LIMIT_MS - 1);
    setup.latest().send({ type: "test_result", runId: setup.runId, result: passed("first") });
    setup.advance(TIME_LIMIT_MS - 1);
    expect(setup.controller.status).toBe("checking");
    expect(setup.workers).toHaveLength(1);
  });

  it("[FR-RUN-02] at the limit, the running test case fails, the rest are not run, and a new worker starts", () => {
    const setup = checking();
    setup.latest().send({ type: "test_result", runId: setup.runId, result: passed("first") });
    setup.advance(TIME_LIMIT_MS);
    const done = setup.events.find((event) => event.type === "check_done");
    expect(done).toMatchObject({
      results: [
        { testCaseId: "first", status: "passed" },
        { testCaseId: "second", status: "failed", reason: "time_limit" },
        { testCaseId: "third", status: "not_run" },
      ],
      summary: { passed: 1, failed: 1, notRun: 1, allPassed: false, timeLimit: true },
    });
    expect(setup.workers[0]?.terminated).toBe(true);
    expect(setup.events.at(-1)).toEqual({ type: "restarting", reason: "time_limit" });
    expect(setup.controller.status).toBe("restarting");
  });

  it("[FR-WSP-07] Stop ends a check and starts a new worker", () => {
    const setup = checking();
    setup.controller.stop();
    expect(setup.events.find((event) => event.type === "check_done")).toMatchObject({
      results: [
        { status: "failed", reason: "stopped" },
        { status: "not_run" },
        { status: "not_run" },
      ],
    });
    expect(setup.events.at(-1)).toEqual({ type: "restarting", reason: "stopped" });
  });

  it("[NFR-REL-03] a worker that dies during a check fails the running test case and is replaced", () => {
    const setup = checking();
    setup.latest().fail();
    expect(setup.events.find((event) => event.type === "check_done")).toMatchObject({
      results: [
        { status: "failed", reason: "crashed" },
        { status: "not_run" },
        { status: "not_run" },
      ],
    });
    expect(setup.events.at(-1)).toEqual({ type: "restarting", reason: "crashed" });
  });

  it("[NFR-SEC-01] a result out of order, or a summary that disagrees with the results, means the worker is broken", () => {
    const outOfOrder = checking();
    outOfOrder
      .latest()
      .send({ type: "test_result", runId: outOfOrder.runId, result: passed("second") });
    expect(outOfOrder.reports).toContainEqual({
      code: "unexpected_message",
      messageType: "test_result",
    });
    expect(outOfOrder.events.at(-1)).toEqual({ type: "restarting", reason: "crashed" });

    const disagrees = checking();
    disagrees
      .latest()
      .send({ type: "test_result", runId: disagrees.runId, result: passed("first") });
    disagrees.latest().send({
      type: "check_done",
      runId: disagrees.runId,
      summary: { total: 1, passed: 1, failed: 0, notRun: 0, allPassed: true, timeLimit: false },
    });
    expect(disagrees.reports).toContainEqual({
      code: "unexpected_message",
      messageType: "check_done",
    });
    expect(disagrees.events.find((event) => event.type === "check_done")).toMatchObject({
      results: [
        { status: "passed" },
        { status: "failed", reason: "crashed" },
        { status: "not_run" },
      ],
    });
  });

  it("[NFR-SEC-01] drops check messages for another run, and run messages during a check", () => {
    const setup = checking();
    setup.latest().send({ type: "test_result", runId: createRunId(99), result: passed("first") });
    setup.latest().send({ type: "output", runId: setup.runId, stream: "stdout", text: "x" });
    setup.latest().send({
      type: "run_done",
      runId: setup.runId,
      outcome: { kind: "ok" },
      truncated: false,
      durationMs: 1,
    });
    expect(setup.reports).toEqual([
      { code: "unexpected_message", messageType: "test_result" },
      { code: "unexpected_message", messageType: "output" },
      { code: "unexpected_message", messageType: "run_done" },
    ]);
    expect(setup.controller.status).toBe("checking");
  });

  it("[FR-RUN-06] a memory error in a test case starts a new worker after the check", () => {
    const setup = checking();
    const memory = {
      testCaseId: "first",
      status: "failed",
      reason: "program_error",
      actual: "",
      truncated: false,
      error: { kind: "memory", message: "MemoryError" },
      harnessVersion: HARNESS_VERSION,
    };
    setup.latest().send({ type: "test_result", runId: setup.runId, result: memory });
    setup.latest().send({ type: "test_result", runId: setup.runId, result: passed("second") });
    setup.latest().send({ type: "test_result", runId: setup.runId, result: passed("third") });
    setup.latest().send({
      type: "check_done",
      runId: setup.runId,
      summary: { total: 3, passed: 2, failed: 1, notRun: 0, allPassed: false, timeLimit: false },
    });
    expect(setup.events.at(-1)).toEqual({ type: "restarting", reason: "memory" });
  });

  it("[FR-GRD-01] refuses a check before ready, during a run, or with test cases the worker would refuse", () => {
    const notStarted = setUp();
    notStarted.controller.start();
    expect(notStarted.controller.check("x", tests)).toEqual({ ok: false, error: "not_ready" });
    const busy = started();
    busy.controller.run("print(1)");
    expect(busy.controller.check("x", tests)).toEqual({ ok: false, error: "not_ready" });
    const invalid = started();
    expect(invalid.controller.check("x", [])).toEqual({ ok: false, error: "invalid" });
    expect(invalid.latest().received).toHaveLength(1);
  });

  it("[T-22] [T-23] with freshWorker, a check on a used worker starts a new one first", () => {
    const setup = started();
    const first = setup.latest();
    const request = setup.controller.check("print(1)", tests, { freshWorker: true });
    if (!request.ok) throw new Error("check refused");
    expect(setup.controller.status).toBe("checking");
    expect(first.received.map((message) => message.type)).toEqual(["init", "check"]);
    first.send({ type: "test_result", runId: request.runId, result: passed("first") });
    first.send({ type: "test_result", runId: request.runId, result: passed("second") });
    first.send({ type: "test_result", runId: request.runId, result: passed("third") });
    const summary = {
      total: 3,
      passed: 3,
      failed: 0,
      notRun: 0,
      allPassed: true,
      timeLimit: false,
    };
    first.send({ type: "check_done", runId: request.runId, summary });

    const second = setup.controller.check("print(1)", tests, { freshWorker: true });
    if (!second.ok) throw new Error("check refused");
    expect(first.terminated).toBe(true);
    expect(setup.workers).toHaveLength(2);
    expect(setup.controller.status).toBe("restarting");
    expect(setup.events.at(-1)).toEqual({ type: "restarting", reason: "isolation" });
    expect(setup.latest().received.map((message) => message.type)).toEqual(["init"]);
    setup.makeReady();
    expect(setup.controller.status).toBe("checking");
    expect(setup.latest().received.at(-1)).toEqual({
      type: "check",
      runId: second.runId,
      source: "print(1)",
      tests,
    });
  });

  it("[T-22] [T-23] [FR-RUN-02] a fresh check reaches the new worker before its ready is reported, so a run or check started then is refused and Stop ends the check", () => {
    const seen: { status: string; run: unknown; check: unknown }[] = [];
    let watching = false;
    const setup = started({
      onEvent: (event, controller) => {
        if (!watching || event.type !== "ready") return;
        seen.push({
          status: controller.status,
          run: controller.run("print(2)"),
          check: controller.check("print(3)", tests, { freshWorker: true }),
        });
      },
    });
    const run = setup.controller.run("print(1)");
    if (!run.ok) throw new Error("run refused");
    setup.latest().send({
      type: "run_done",
      runId: run.runId,
      outcome: { kind: "ok" },
      truncated: false,
      durationMs: 4,
    });
    const request = setup.controller.check("print(1)", tests, { freshWorker: true });
    if (!request.ok) throw new Error("check refused");
    watching = true;
    setup.makeReady();
    expect(seen).toEqual([
      {
        status: "checking",
        run: { ok: false, error: "not_ready" },
        check: { ok: false, error: "not_ready" },
      },
    ]);
    expect(setup.workers).toHaveLength(2);
    expect(setup.latest().received).toEqual([
      { type: "init", assetBase: "/_runtime/pyodide/314.0.7/", harnessVersion: HARNESS_VERSION },
      { type: "check", runId: request.runId, source: "print(1)", tests },
    ]);
    setup.controller.stop();
    expect(setup.events.filter((event) => event.type === "check_done").at(-1)).toMatchObject({
      runId: request.runId,
    });
    expect(setup.latest().terminated).toBe(false);
    expect(setup.workers[1]?.terminated).toBe(true);
    expect(setup.controller.status).toBe("restarting");
  });

  it("[T-22] a worker started after a time limit is new, so a fresh check uses it as it is", () => {
    const setup = started();
    expect(setup.controller.run("while True: pass").ok).toBe(true);
    setup.advance(5_000);
    expect(setup.workers).toHaveLength(2);
    setup.makeReady();
    expect(setup.controller.check("print(1)", tests, { freshWorker: true }).ok).toBe(true);
    expect(setup.workers).toHaveLength(2);
    expect(setup.controller.status).toBe("checking");
  });

  it("[T-22] with freshWorker, a worker that has only loaded is used as it is", () => {
    const setup = started();
    expect(setup.controller.check("print(1)", tests, { freshWorker: true }).ok).toBe(true);
    expect(setup.workers).toHaveLength(1);
    expect(setup.controller.status).toBe("checking");
  });

  it("[T-22] a run makes the worker used, so the next fresh check replaces it", () => {
    const setup = started();
    const run = setup.controller.run("print(1)");
    if (!run.ok) throw new Error("run refused");
    setup.latest().send({
      type: "run_done",
      runId: run.runId,
      outcome: { kind: "ok" },
      truncated: false,
      durationMs: 4,
    });
    setup.controller.check("print(1)", tests, { freshWorker: true });
    expect(setup.workers).toHaveLength(2);
  });

  it("[FR-RUN-02] Stop while the new worker starts ends the check, and the new worker becomes ready", () => {
    const setup = started();
    setup.controller.check("print(1)", tests);
    const done = () => setup.events.filter((event) => event.type === "check_done");
    for (const id of ["first", "second", "third"]) {
      setup.latest().send({ type: "test_result", runId: "run-1", result: passed(id) });
    }
    setup.latest().send({
      type: "check_done",
      runId: "run-1",
      summary: { total: 3, passed: 3, failed: 0, notRun: 0, allPassed: true, timeLimit: false },
    });
    const request = setup.controller.check("print(1)", tests, { freshWorker: true });
    if (!request.ok) throw new Error("check refused");
    setup.controller.stop();
    expect(done().at(-1)).toMatchObject({
      runId: request.runId,
      summary: { failed: 1, notRun: 2 },
    });
    setup.makeReady();
    expect(setup.controller.status).toBe("ready");
    expect(setup.latest().received.map((message) => message.type)).toEqual(["init"]);
  });

  it("[FR-RUN-06] a new worker that fails to start ends the waiting check as crashed", () => {
    const setup = started();
    const run = setup.controller.run("print(1)");
    if (!run.ok) throw new Error("run refused");
    setup.latest().send({
      type: "run_done",
      runId: run.runId,
      outcome: { kind: "ok" },
      truncated: false,
      durationMs: 4,
    });
    const request = setup.controller.check("print(1)", tests, { freshWorker: true });
    if (!request.ok) throw new Error("check refused");
    setup.latest().fail();
    expect(setup.events.find((event) => event.type === "check_done")).toMatchObject({
      runId: request.runId,
      results: [
        { status: "failed", reason: "crashed" },
        { status: "not_run" },
        { status: "not_run" },
      ],
    });
  });

  type CheckSetup = ReturnType<typeof checking>;
  const sendAll = (setup: CheckSetup, error?: { kind: "memory"; message: string }) => {
    for (const id of ["first", "second", "third"]) {
      const result =
        error !== undefined && id === "first"
          ? { ...passed(id), status: "failed", reason: "program_error", actual: "", error }
          : passed(id);
      setup.latest().send({ type: "test_result", runId: setup.runId, result });
    }
    const failed = error === undefined ? 0 : 1;
    setup.latest().send({
      type: "check_done",
      runId: setup.runId,
      summary: {
        total: 3,
        passed: 3 - failed,
        failed,
        notRun: 0,
        allPassed: failed === 0,
        timeLimit: false,
      },
    });
  };

  /** The controller stays disposed: no worker alive, no timer, no new worker, no start. */
  function expectCheckDisposed(setup: CheckSetup, workers: number) {
    expect(setup.workers).toHaveLength(workers);
    expect(setup.workers.every((worker) => worker.terminated)).toBe(true);
    expect(setup.timers.size).toBe(0);
    expect(setup.controller.status).toBe("disposed");
    setup.controller.start();
    expect(setup.workers).toHaveLength(workers);
    expect(setup.controller.check("print(1)", tests)).toEqual({ ok: false, error: "not_ready" });
  }

  // Every way a check ends.
  const checkEnds: [string, (setup: CheckSetup) => void][] = [
    ["the time limit", (setup) => setup.advance(TIME_LIMIT_MS)],
    ["stop", (setup) => setup.controller.stop()],
    ["a worker error", (setup) => setup.latest().fail()],
    [
      "a fatal message",
      (setup) => setup.latest().send({ type: "fatal", reason: "runtime_crashed" }),
    ],
    ["a memory error", (setup) => sendAll(setup, { kind: "memory", message: "MemoryError" })],
    ["a finished check", (setup) => sendAll(setup)],
  ];

  it.each(checkEnds)(
    "[FR-RUN-01] dispose from the check_done event after %s keeps the controller disposed",
    (_name, trigger) => {
      const setup = checking({
        onEvent: (event, controller) => {
          if (event.type === "check_done") controller.dispose();
        },
      });
      trigger(setup);
      expect(setup.events.at(-1)?.type).toBe("check_done");
      expectCheckDisposed(setup, 1);
    },
  );

  it("[FR-RUN-01] dispose from a test_result event starts no clock for the next test case", () => {
    const setup = checking({
      onEvent: (event, controller) => {
        if (event.type === "test_result") controller.dispose();
      },
    });
    setup.latest().send({ type: "test_result", runId: setup.runId, result: passed("first") });
    expect(setup.events.at(-1)?.type).toBe("test_result");
    expectCheckDisposed(setup, 1);
  });

  /** A used worker, then a fresh check that waits for a new worker. */
  function waiting(listen: Listeners) {
    const setup = checking(listen);
    sendAll(setup);
    const request = setup.controller.check("print(1)", tests, { freshWorker: true });
    if (!request.ok) throw new Error("check refused");
    return setup;
  }

  it("[FR-RUN-01] dispose from the restarting event of a fresh check starts no new worker and refuses the check", () => {
    const setup = checking({
      onEvent: (event, controller) => {
        if (event.type === "restarting") controller.dispose();
      },
    });
    sendAll(setup);
    expect(setup.controller.check("print(1)", tests, { freshWorker: true })).toEqual({
      ok: false,
      error: "not_ready",
    });
    expect(setup.events.at(-1)).toEqual({ type: "restarting", reason: "isolation" });
    expectCheckDisposed(setup, 1);
  });

  it("[FR-RUN-01] dispose from the ready event that sent a waiting check stops its clock", () => {
    let dispose = false;
    const setup = waiting({
      onEvent: (event, controller) => {
        if (dispose && event.type === "ready") controller.dispose();
      },
    });
    dispose = true;
    setup.makeReady();
    expect(setup.latest().received.map((message) => message.type)).toEqual(["init", "check"]);
    expect(setup.events.at(-1)?.type).toBe("ready");
    expectCheckDisposed(setup, 2);
  });

  it("[FR-RUN-01] dispose from the check_done event of a waiting check whose new worker fails sends no failed", () => {
    let dispose = false;
    const setup = waiting({
      onEvent: (event, controller) => {
        if (dispose && event.type === "check_done") controller.dispose();
      },
    });
    dispose = true;
    setup.latest().fail();
    expect(setup.events.at(-1)?.type).toBe("check_done");
    expectCheckDisposed(setup, 2);
  });
});
