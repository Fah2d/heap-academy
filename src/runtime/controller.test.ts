import { describe, expect, it } from "vitest";
import {
  type ControllerEvent,
  type ControllerReport,
  createRuntimeController,
  TIME_LIMIT_MS,
  type WorkerLike,
} from "./controller.ts";
import { OUTPUT_LIMIT, type PageMessage } from "./protocol.ts";

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

function setUp() {
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
    onEvent: (event) => events.push(event),
    report: (report) => reports.push(report),
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
  return { controller, workers, events, reports, advance, latest, makeReady, timers };
}

function started() {
  const setup = setUp();
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
      { type: "init", assetBase: "/_runtime/pyodide/314.0.7/" },
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
});
