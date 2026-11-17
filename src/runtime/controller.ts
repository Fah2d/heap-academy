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

/** FR-RUN-02: seconds of execution a run may take, waiting for input aside. */
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
export type RestartReason = "time_limit" | "stopped" | "crashed" | "memory" | "output_limit";

export type ControllerEvent =
  | { type: "progress"; loadedBytes: number; totalBytes: number }
  | { type: "ready"; runtimeVersion: string; interactiveInput: boolean }
  | { type: "output"; runId: RunId; stream: OutputStream; text: string }
  | { type: "run_done"; result: RunResult }
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
  "idle" | "loading" | "ready" | "running" | "restarting" | "failed" | "disposed";

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

export type RuntimeController = {
  readonly status: ControllerStatus;
  /** Starts the runtime. Does nothing unless it is idle or has failed. */
  start: () => void;
  run: (source: string, stdin?: string[]) => RunRequest;
  /** Ends the current run, if there is one, and starts a new worker. */
  stop: () => void;
  dispose: () => void;
};

/** The run in progress; `received` counts the characters of output that reached the page. */
type Current = { runId: RunId; started: number; timer: unknown; received: number };

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
  let current: Current | undefined;
  let sequence = 0;

  function finish(outcome: RunOutcome, truncated: boolean, durationMs?: number): void {
    if (current === undefined) return;
    timers.clearTimeout(current.timer);
    const result: RunResult = {
      runId: current.runId,
      outcome,
      // A program that catches the write error and keeps going ends at the
      // time limit; the cap it hit is still reported (FR-RUN-03).
      truncated: truncated || current.received >= OUTPUT_LIMIT,
      durationMs: durationMs ?? Math.max(0, Math.round(now() - current.started)),
    };
    current = undefined;
    onEvent({ type: "run_done", result });
  }

  function end(): void {
    worker?.terminate();
    worker = undefined;
  }

  function restart(reason: RestartReason): void {
    end();
    status = "restarting";
    onEvent({ type: "restarting", reason });
    spawn();
  }

  /** The worker died or gave up. What follows depends on what it was doing. */
  function crashed(): void {
    if (status === "running") {
      finish({ kind: "crashed" }, false);
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
        status = "ready";
        onEvent({
          type: "ready",
          runtimeVersion: message.runtimeVersion,
          interactiveInput: message.capabilities.interactiveInput,
        });
        return;
      case "output":
        if (current?.runId !== message.runId) return unexpected();
        current.received += characterCount(message.text);
        onEvent(message);
        return;
      case "input_request":
        // Interactive input arrives in WP-3.2; this controller sends batch runs only.
        return unexpected();
      case "run_done":
        if (current?.runId !== message.runId) return unexpected();
        finish(message.outcome, message.truncated, message.durationMs);
        // A program that ran out of memory may leave the runtime's memory
        // grown; a new worker gives it back. One stopped at the output cap may
        // leave text in Python's stream buffers, which the next run would
        // print; a new worker has none.
        if (message.outcome.kind === "memory") return restart("memory");
        if (message.outcome.kind === "output_limit") return restart("output_limit");
        status = "ready";
        return;
      case "fatal":
        report({ code: "fatal", reason: message.reason });
        return crashed();
      default: {
        const unreachable: never = message;
        return unreachable;
      }
    }
  }

  function spawn(): void {
    const next = createWorker();
    worker = next;
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
    next.postMessage({ type: "init", assetBase });
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
      const timer = timers.setTimeout(() => {
        if (current?.runId !== runId) return;
        finish({ kind: "time_limit" }, false);
        restart("time_limit");
      }, timeLimitMs);
      current = { runId, started: now(), timer, received: 0 };
      worker.postMessage(message);
      return { ok: true, runId };
    },
    stop() {
      if (status !== "running") return;
      finish({ kind: "stopped" }, false);
      restart("stopped");
    },
    dispose() {
      if (current !== undefined) timers.clearTimeout(current.timer);
      current = undefined;
      end();
      status = "disposed";
    },
  };
}
