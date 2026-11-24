import { type CheckSummary, summarize, type TestResult, unfinished } from "../grader/grade.ts";
import { HARNESS_VERSION } from "../grader/harness.ts";
import type { TestCase } from "../grader/test-case.ts";
import { characterCount } from "./output.ts";
import {
  createRunId,
  type FatalReason,
  OUTPUT_LIMIT,
  type OutputStream,
  type PageMessage,
  type ParseError,
  parsePageMessage,
  parseWorkerMessage,
  type RunId,
  type WorkerOutcome,
} from "./protocol.ts";

// The page's side of the Python runtime: it starts the worker, sends runs,
// owns the clock, and replaces the worker whenever it has to stop one
// (architecture sections 5.1 and 5.4). A busy loop cannot read a message, so
// a run is never asked to stop: the worker is terminated and a new one starts.
// The workspace statechart (WP-3.4) drives this from the interface.

/**
 * FR-RUN-02: seconds of execution a run may take, waiting for input aside.
 * Each test case of a check is its own run with this limit.
 */
export const TIME_LIMIT_MS = 5_000;

/** The part of a Worker the controller uses, so tests can give it a fake one. */
export type WorkerLike = {
  postMessage: (message: PageMessage) => void;
  terminate: () => void;
  addEventListener: (
    type: "message" | "messageerror" | "error",
    listener: (event: { data?: unknown }) => void,
  ) => void;
};

export type Timers = {
  setTimeout: (callback: () => void, delayMs: number) => unknown;
  clearTimeout: (handle: unknown) => void;
};

/** How a run ended: as the worker reported it, or as the page decided. */
export type RunOutcome = WorkerOutcome | { kind: "time_limit" | "stopped" | "crashed" };

export type RunResult = {
  runId: RunId;
  outcome: RunOutcome;
  truncated: boolean;
  durationMs: number;
};

/** Why the controller is starting a new worker. */
export type RestartReason =
  "time_limit" | "stopped" | "crashed" | "memory" | "output_limit" | "isolation";

export type ControllerEvent =
  | { type: "progress"; loadedBytes: number; totalBytes: number }
  /**
   * A worker finished loading. After an isolation restart the controller may
   * already be `checking` when this arrives: read `status`, not this event.
   */
  | { type: "ready"; runtimeVersion: string; interactiveInput: boolean }
  | { type: "output"; runId: RunId; stream: OutputStream; text: string }
  | { type: "run_done"; result: RunResult }
  | { type: "test_result"; runId: RunId; result: TestResult }
  | { type: "check_done"; runId: RunId; results: TestResult[]; summary: CheckSummary }
  | { type: "restarting"; reason: RestartReason }
  | { type: "failed" };

/** Something the controller dropped or acted on, for the error report. */
export type ControllerReport =
  | { code: "malformed_message"; error: ParseError }
  | { code: "unexpected_message"; messageType: string }
  | { code: "fatal"; reason: FatalReason }
  | { code: "message_error" }
  | { code: "worker_error" };

export type ControllerStatus =
  "idle" | "loading" | "ready" | "running" | "checking" | "restarting" | "failed" | "disposed";

export type RunRequest = { ok: true; runId: RunId } | { ok: false; error: "not_ready" | "invalid" };

export type ControllerOptions = {
  createWorker: () => WorkerLike;
  assetBase: string;
  timers: Timers;
  now: () => number;
  onEvent: (event: ControllerEvent) => void;
  report: (report: ControllerReport) => void;
  timeLimitMs?: number;
};

export type CheckOptions = { freshWorker?: boolean };

export type RuntimeController = {
  readonly status: ControllerStatus;
  /** Starts the runtime. Does nothing unless it is idle or has failed. */
  start: () => void;
  run: (source: string, stdin?: string[]) => RunRequest;
  /**
   * Runs the test cases against the program (architecture section 5.2,
   * `check`). With `freshWorker`, on a worker that has run anything, a new
   * worker starts first: a program can change what later checks on its
   * worker report (T-22, T-23). Validate (WP-4.3) must use it for every
   * program; the spec text for that is an open owner decision.
   */
  check: (source: string, tests: readonly TestCase[], options?: CheckOptions) => RunRequest;
  /** Ends the current run or check, if there is one, and starts a new worker. */
  stop: () => void;
  dispose: () => void;
};

/** The run in progress; `received` counts the characters of output that reached the page. */
type Current = { kind: "run"; runId: RunId; started: number; timer: unknown; received: number };

/** The check in progress: its test cases, the results so far, and the current test case's clock. */
type CurrentCheck = {
  kind: "check";
  runId: RunId;
  tests: readonly TestCase[];
  results: TestResult[];
  timer: unknown;
};

export function createRuntimeController({
  createWorker,
  assetBase,
  timers,
  now,
  onEvent,
  report,
  timeLimitMs = TIME_LIMIT_MS,
}: ControllerOptions): RuntimeController {
  let status: ControllerStatus = "idle";
  let worker: WorkerLike | undefined;
  let current: Current | CurrentCheck | undefined;
  /** Whether the live worker has been sent a run or a check since it started. */
  let used = false;
  /** A check waiting for the new worker it asked for. */
  let pending: PageMessage | undefined;
  let sequence = 0;

  /** The worker ended the run and says whether the output was cut. */
  function finishReported(outcome: WorkerOutcome, truncated: boolean, durationMs: number): void {
    if (current?.kind !== "run") return;
    timers.clearTimeout(current.timer);
    const result: RunResult = { runId: current.runId, outcome, truncated, durationMs };
    current = undefined;
    onEvent({ type: "run_done", result });
  }

  /**
   * The page ended the run. A program that caught the write error and kept
   * going reached the cap without the worker saying so; the cap is still
   * reported (FR-RUN-03).
   */
  function finish(outcome: RunOutcome): void {
    if (current?.kind !== "run") return;
    timers.clearTimeout(current.timer);
    const result: RunResult = {
      runId: current.runId,
      outcome,
      truncated: current.received >= OUTPUT_LIMIT,
      durationMs: Math.max(0, Math.round(now() - current.started)),
    };
    current = undefined;
    onEvent({ type: "run_done", result });
  }

  /** Each test case gets the full limit: the clock restarts with every result. */
  function startCaseClock(check: CurrentCheck): void {
    timers.clearTimeout(check.timer);
    check.timer = timers.setTimeout(() => {
      if (current !== check) return;
      endCheck("time_limit");
      restart("time_limit");
    }, timeLimitMs);
  }

  function completeCheck(results: TestResult[], summary: CheckSummary): void {
    if (current?.kind !== "check") return;
    timers.clearTimeout(current.timer);
    const { runId } = current;
    current = undefined;
    onEvent({ type: "check_done", runId, results, summary });
  }

  /** The page ended the check: the running test case gets the reason, the rest are not run. */
  function endCheck(reason: "time_limit" | "stopped" | "crashed"): void {
    if (current?.kind !== "check") return;
    const results = [
      ...current.results,
      ...unfinished(current.tests.slice(current.results.length), reason),
    ];
    completeCheck(results, summarize(results));
  }

  function end(): void {
    worker?.terminate();
    worker = undefined;
  }

  /**
   * The `onEvent` and `report` listeners may call `dispose`; after that no
   * worker is started and the status stays `disposed`. A function, because
   * TypeScript's narrowing of `status` does not see a listener change it.
   */
  function isDisposed(): boolean {
    return status === "disposed";
  }

  function restart(reason: RestartReason): void {
    if (isDisposed()) return;
    end();
    status = "restarting";
    onEvent({ type: "restarting", reason });
    if (isDisposed()) return;
    spawn();
  }

  /** The worker died or gave up. What follows depends on what it was doing. */
  function crashed(): void {
    if (isDisposed()) return;
    if (pending !== undefined) {
      pending = undefined;
      endCheck("crashed");
      if (isDisposed()) return;
    }
    if (status === "running") {
      finish({ kind: "crashed" });
      restart("crashed");
    } else if (status === "checking") {
      endCheck("crashed");
      restart("crashed");
    } else if (status === "ready") {
      restart("crashed");
    } else {
      end();
      status = "failed";
      onEvent({ type: "failed" });
    }
  }

  function receive(data: unknown): void {
    const parsed = parseWorkerMessage(data);
    if (!parsed.ok) {
      report({ code: "malformed_message", error: parsed.error });
      return;
    }
    const message = parsed.value;
    const unexpected = () => {
      report({ code: "unexpected_message", messageType: message.type });
    };
    switch (message.type) {
      case "progress":
        if (status !== "loading" && status !== "restarting") return unexpected();
        onEvent(message);
        return;
      case "ready":
        if (status !== "loading" && status !== "restarting") return unexpected();
        // A check that asked for a new worker goes to it before anything is
        // reported, so a page that acts on "ready" finds the controller
        // checking, and cannot start a run or a second check in between.
        if (pending !== undefined && current?.kind === "check") {
          const check = pending;
          pending = undefined;
          send(current, check);
        } else {
          status = "ready";
        }
        onEvent({
          type: "ready",
          runtimeVersion: message.runtimeVersion,
          interactiveInput: message.capabilities.interactiveInput,
        });
        return;
      case "output":
        if (current?.kind !== "run" || current.runId !== message.runId) return unexpected();
        current.received += characterCount(message.text);
        onEvent(message);
        return;
      case "input_request":
        // Interactive input arrives in WP-3.2; this controller sends batch runs only.
        return unexpected();
      case "run_done":
        if (current?.kind !== "run" || current.runId !== message.runId) return unexpected();
        finishReported(message.outcome, message.truncated, message.durationMs);
        if (isDisposed()) return;
        // A program that ran out of memory may leave the runtime's memory
        // grown; a new worker gives it back. One stopped at the output cap may
        // leave text in Python's stream buffers, which the next run would
        // print; a new worker has none.
        if (message.outcome.kind === "memory") return restart("memory");
        if (message.outcome.kind === "output_limit") return restart("output_limit");
        status = "ready";
        return;
      case "test_result": {
        const check = current;
        if (check?.kind !== "check" || check.runId !== message.runId) return unexpected();
        // Results arrive in the order of the test cases, one each.
        if (message.result.testCaseId !== check.tests[check.results.length]?.id) {
          report({ code: "unexpected_message", messageType: message.type });
          return crashed();
        }
        check.results.push(message.result);
        onEvent({ type: "test_result", runId: check.runId, result: message.result });
        if (isDisposed()) return;
        if (check.results.length < check.tests.length) startCaseClock(check);
        return;
      }
      case "check_done": {
        const check = current;
        if (check?.kind !== "check" || check.runId !== message.runId) return unexpected();
        const summary = summarize(check.results);
        if (
          check.results.length !== check.tests.length ||
          JSON.stringify(summary) !== JSON.stringify(message.summary)
        ) {
          report({ code: "unexpected_message", messageType: message.type });
          return crashed();
        }
        const results = check.results;
        completeCheck(results, summary);
        if (isDisposed()) return;
        // As after a run: a memory error may leave the runtime's memory grown.
        const memory = results.some(
          (result) => result.status === "failed" && result.error?.kind === "memory",
        );
        if (memory) return restart("memory");
        status = "ready";
        return;
      }
      case "fatal":
        report({ code: "fatal", reason: message.reason });
        return crashed();
      default: {
        const unreachable: never = message;
        return unreachable;
      }
    }
  }

  /** Sends a check to the live worker and starts its first test case's clock. */
  function send(check: CurrentCheck, message: PageMessage): void {
    status = "checking";
    used = true;
    startCaseClock(check);
    worker?.postMessage(message);
  }

  function spawn(): void {
    const next = createWorker();
    worker = next;
    used = false;
    // A terminated worker can still have messages in flight; they are ignored.
    const live = () => worker === next;
    next.addEventListener("message", (event) => {
      if (live()) receive(event.data);
    });
    next.addEventListener("messageerror", () => {
      if (live()) report({ code: "message_error" });
    });
    next.addEventListener("error", () => {
      if (!live()) return;
      report({ code: "worker_error" });
      crashed();
    });
    next.postMessage({ type: "init", assetBase, harnessVersion: HARNESS_VERSION });
  }

  return {
    get status() {
      return status;
    },
    start() {
      if (status !== "idle" && status !== "failed") return;
      status = "loading";
      spawn();
    },
    run(source, stdin) {
      if (status !== "ready" || worker === undefined) return { ok: false, error: "not_ready" };
      sequence += 1;
      const runId = createRunId(sequence);
      const message: PageMessage = {
        type: "run",
        runId,
        source,
        mode: "batch",
        ...(stdin !== undefined && { stdin }),
      };
      // The worker refuses a malformed message by giving up, so it is checked here first.
      if (!parsePageMessage(message).ok) return { ok: false, error: "invalid" };
      status = "running";
      used = true;
      const timer = timers.setTimeout(() => {
        if (current?.runId !== runId) return;
        finish({ kind: "time_limit" });
        restart("time_limit");
      }, timeLimitMs);
      current = { kind: "run", runId, started: now(), timer, received: 0 };
      worker.postMessage(message);
      return { ok: true, runId };
    },
    check(source, tests, options = {}) {
      if (status !== "ready" || worker === undefined) return { ok: false, error: "not_ready" };
      sequence += 1;
      const runId = createRunId(sequence);
      const message: PageMessage = { type: "check", runId, source, tests: [...tests] };
      if (!parsePageMessage(message).ok) return { ok: false, error: "invalid" };
      const check: CurrentCheck = { kind: "check", runId, tests, results: [], timer: undefined };
      current = check;
      if (options.freshWorker === true && used) {
        pending = message;
        restart("isolation");
        // A `restarting` listener that disposed the controller gets no check.
        if (isDisposed()) return { ok: false, error: "not_ready" };
      } else {
        send(check, message);
      }
      return { ok: true, runId };
    },
    stop() {
      if (pending !== undefined) {
        // The new worker is still starting; the check never reached it.
        pending = undefined;
        endCheck("stopped");
        return;
      }
      if (status === "running") {
        finish({ kind: "stopped" });
        restart("stopped");
      } else if (status === "checking") {
        endCheck("stopped");
        restart("stopped");
      }
    },
    dispose() {
      if (current !== undefined) timers.clearTimeout(current.timer);
      current = undefined;
      pending = undefined;
      end();
      status = "disposed";
    },
  };
}
