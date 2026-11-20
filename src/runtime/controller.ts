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
  /** The program is waiting for a line (interactive runs only). */
  | { type: "input_request"; runId: RunId }
  /** The page sent a line, or the end of input, for the console to echo. */
  | { type: "input"; runId: RunId; line: string }
  | { type: "input_end"; runId: RunId }
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
  "idle" | "loading" | "ready" | "running" | "awaitingInput" | "restarting" | "failed" | "disposed";

export type RunRequest = { ok: true; runId: RunId } | { ok: false; error: "not_ready" | "invalid" };

export type InputRequest = { ok: true } | { ok: false; error: "not_waiting" | "invalid" };

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
  /** Whether the live worker can pause a program for input, as it said at `ready`. */
  readonly interactiveInput: boolean;
  /**
   * Runs a program. With `stdin`, or where the worker cannot pause a program,
   * it is a batch run that reads those lines; otherwise it is interactive and
   * asks for each line (architecture section 5.3).
   */
  run: (source: string, stdin?: string[]) => RunRequest;
  /** Answers the program's request for a line, and its clock starts again. */
  sendInput: (line: string) => InputRequest;
  /** Tells the program there is no more input. */
  endInput: () => InputRequest;
  /** Ends the current run, if there is one, and starts a new worker. */
  stop: () => void;
  dispose: () => void;
};

/**
 * The run in progress. `received` counts the characters of output that
 * reached the page. The clock counts only execution: `spentMs` before the
 * current stretch, which began at `resumed`; while the program waits for
 * input there is no stretch and no timer (section 5.4).
 */
type Current = {
  runId: RunId;
  timer: unknown;
  received: number;
  spentMs: number;
  resumed: number | undefined;
  /** Whether the run may ask for input. */
  interactive: boolean;
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
  let current: Current | undefined;
  let sequence = 0;
  let interactiveInput = false;

  function spent(run: Current): number {
    return run.spentMs + (run.resumed === undefined ? 0 : Math.max(0, now() - run.resumed));
  }

  /** Starts a stretch of execution with what is left of the time limit. */
  function resume(run: Current): void {
    run.resumed = now();
    const { runId } = run;
    run.timer = timers.setTimeout(
      () => {
        if (current?.runId !== runId) return;
        finish({ kind: "time_limit" });
        restart("time_limit");
      },
      Math.max(0, timeLimitMs - run.spentMs),
    );
  }

  /** The program asked for input: its clock stops until the answer. */
  function pause(run: Current): void {
    timers.clearTimeout(run.timer);
    run.spentMs = spent(run);
    run.resumed = undefined;
  }

  /** The worker ended the run and says whether the output was cut. */
  function finishReported(outcome: WorkerOutcome, truncated: boolean, durationMs: number): void {
    if (current === undefined) return;
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
    if (current === undefined) return;
    timers.clearTimeout(current.timer);
    const result: RunResult = {
      runId: current.runId,
      outcome,
      truncated: current.received >= OUTPUT_LIMIT,
      durationMs: Math.round(spent(current)),
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
    if (status === "running" || status === "awaitingInput") {
      finish({ kind: "crashed" });
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
        interactiveInput = message.capabilities.interactiveInput;
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
        // Only a running interactive run asks; a second request while one
        // waits would stop a clock that is already stopped.
        if (current?.runId !== message.runId || status !== "running" || !current.interactive) {
          return unexpected();
        }
        pause(current);
        status = "awaitingInput";
        onEvent(message);
        return;
      case "run_done":
        if (current?.runId !== message.runId) return unexpected();
        finishReported(message.outcome, message.truncated, message.durationMs);
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

  /** Sends the answer or the end of input, and the program's clock runs again. */
  function answer(message: PageMessage, event: ControllerEvent): InputRequest {
    if (status !== "awaitingInput" || current === undefined || worker === undefined) {
      return { ok: false, error: "not_waiting" };
    }
    if (!parsePageMessage(message).ok) return { ok: false, error: "invalid" };
    status = "running";
    resume(current);
    worker.postMessage(message);
    onEvent(event);
    return { ok: true };
  }

  return {
    get status() {
      return status;
    },
    get interactiveInput() {
      return interactiveInput;
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
      const interactive = interactiveInput && stdin === undefined;
      const message: PageMessage = interactive
        ? { type: "run", runId, source, mode: "interactive" }
        : { type: "run", runId, source, mode: "batch", ...(stdin !== undefined && { stdin }) };
      // The worker refuses a malformed message by giving up, so it is checked here first.
      if (!parsePageMessage(message).ok) return { ok: false, error: "invalid" };
      status = "running";
      const run: Current = {
        runId,
        timer: undefined,
        received: 0,
        spentMs: 0,
        resumed: undefined,
        interactive,
      };
      current = run;
      resume(run);
      worker.postMessage(message);
      return { ok: true, runId };
    },
    sendInput(line) {
      const runId = current?.runId;
      if (runId === undefined) return { ok: false, error: "not_waiting" };
      return answer({ type: "input", runId, line }, { type: "input", runId, line });
    },
    endInput() {
      const runId = current?.runId;
      if (runId === undefined) return { ok: false, error: "not_waiting" };
      return answer({ type: "input_end", runId }, { type: "input_end", runId });
    },
    stop() {
      if (status !== "running" && status !== "awaitingInput") return;
      finish({ kind: "stopped" });
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
