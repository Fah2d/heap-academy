import { createOutputCollector, head } from "../output.ts";
import {
  type FatalReason,
  MESSAGE_LIMIT,
  type OutputStream,
  type PageMessage,
  parsePageMessage,
  type WorkerMessage,
  type WorkerOutcome,
} from "../protocol.ts";
import type { LockdownResult } from "../lockdown.ts";
import { parseRuntimeManifest, type RuntimeManifest } from "../manifest.ts";
import { parseRunReport, RUN_SUPPORT_SOURCE } from "./run-support.ts";
import { grade, parseHarnessResult, summarize, type TestResult } from "../../grader/grade.ts";
import { HARNESS_SOURCE, HARNESS_VERSION } from "../../grader/harness.ts";

// What the Python worker does with each message (architecture sections 5.1
// to 5.6). The worker's entry file connects this to the real global scope;
// tests connect it to a fake runtime. It never stops itself: the page owns
// the clock and ends a run by terminating the worker (section 5.4).

/** The part of the Pyodide API the worker uses, checked when it loads. */
export type Runtime = {
  version: string;
  setStdout: (handler: { write: (buffer: Uint8Array) => number }) => void;
  setStderr: (handler: { write: (buffer: Uint8Array) => number }) => void;
  setStdin: (handler: { stdin: () => string | undefined }) => void;
  runPython: (code: string) => unknown;
};

export type WorkerHost = {
  post: (message: WorkerMessage) => void;
  now: () => number;
  /** Fetches and decodes a JSON file. Used only while loading, before the lock-down. */
  fetchJson: (url: string) => Promise<unknown>;
  /** Imports an ES module by URL. */
  importModule: (url: string) => Promise<unknown>;
  /** Counts the bytes every fetch receives until the returned function is called. */
  countFetchedBytes: (onBytes: (bytes: number) => void) => () => void;
  lockDown: () => LockdownResult;
};

/** The interval between progress messages while loading, as for output. */
export const PROGRESS_INTERVAL_MS = 50;

type Runner = (source: string) => unknown;
/** The harness's `check` for one test case (docs/spec/04-content-system.md section 3.1). */
type Checker = (source: string, stdin: string, afterCode: string) => unknown;

type Loaded = { runtime: Runtime; run: Runner; check: Checker };

type State =
  | { name: "idle" }
  | { name: "loading" }
  | ({ name: "ready" } & Loaded)
  | { name: "running" }
  | { name: "dead" };

function isRuntime(value: unknown): value is Runtime {
  if (typeof value !== "object" || value === null) return false;
  return (
    typeof Reflect.get(value, "version") === "string" &&
    ["setStdout", "setStderr", "setStdin", "runPython"].every(
      (name) => typeof Reflect.get(value, name) === "function",
    )
  );
}

export function createWorkerCore(host: WorkerHost): { receive: (data: unknown) => void } {
  let state: State = { name: "idle" };

  function die(reason: FatalReason): void {
    state = { name: "dead" };
    host.post({ type: "fatal", reason });
  }

  async function load(assetBase: string): Promise<void> {
    let manifest: RuntimeManifest;
    try {
      const parsed = parseRuntimeManifest(await host.fetchJson(`${assetBase}manifest.json`));
      if (!parsed.ok) return die("load_failed");
      manifest = parsed.value;
    } catch {
      return die("load_failed");
    }

    // Progress against the build-time manifest (section 5.2): bytes as they
    // arrive for fetched files, and an imported module's size once loaded.
    const totalBytes = manifest.totalBytes;
    let loadedBytes = 0;
    let lastSent = host.now();
    const report = (force: boolean) => {
      if (!force && host.now() - lastSent < PROGRESS_INTERVAL_MS) return;
      lastSent = host.now();
      host.post({ type: "progress", loadedBytes: Math.min(loadedBytes, totalBytes), totalBytes });
    };
    report(true);
    const stopCounting = host.countFetchedBytes((bytes) => {
      loadedBytes += bytes;
      report(false);
    });
    const imported = (name: string) => {
      loadedBytes += manifest.files.find((file) => file.name === name)?.bytes ?? 0;
      report(false);
    };

    let runtime: Runtime;
    let run: Runner;
    let check: Checker;
    try {
      const loader = await host.importModule(`${assetBase}pyodide.mjs`);
      imported("pyodide.mjs");
      const loadPyodide: unknown =
        typeof loader === "object" && loader !== null
          ? Reflect.get(loader, "loadPyodide")
          : undefined;
      if (typeof loadPyodide !== "function") return die("load_failed");
      const loaded: unknown = await Reflect.apply(loadPyodide, undefined, [
        { indexURL: assetBase },
      ]);
      imported("pyodide.asm.mjs");
      if (!isRuntime(loaded)) return die("load_failed");
      if (loaded.version !== manifest.version) return die("version_mismatch");
      const runner: unknown = loaded.runPython(RUN_SUPPORT_SOURCE);
      if (typeof runner !== "function") return die("load_failed");
      const checker: unknown = loaded.runPython(HARNESS_SOURCE);
      if (typeof checker !== "function") return die("load_failed");
      runtime = loaded;
      run = (source) => Reflect.apply(runner, undefined, [source]) as unknown;
      check = (source, stdin, afterCode) =>
        Reflect.apply(checker, undefined, [source, stdin, afterCode]) as unknown;
    } catch {
      return die("load_failed");
    } finally {
      stopCounting();
    }

    // Nothing is fetched after this point, so the network goes now (section 5.6).
    if (!host.lockDown().ok) return die("lockdown_failed");
    loadedBytes = totalBytes;
    report(true);
    state = { name: "ready", runtime, run, check };
    // Interactive input arrives in WP-3.2; until then every run is batch.
    host.post({
      type: "ready",
      runtimeVersion: runtime.version,
      capabilities: { interactiveInput: false },
    });
  }

  function execute(loaded: Loaded, message: Extract<PageMessage, { type: "run" }>): void {
    const { runtime, run } = loaded;
    const { runId } = message;
    const started = host.now();
    const output = createOutputCollector({
      send: ({ stream, text }) => {
        host.post({ type: "output", runId, stream, text });
      },
      now: host.now,
    });
    const writer = (stream: OutputStream) => {
      const decoder = new TextDecoder();
      return {
        decoder,
        handler: {
          write(buffer: Uint8Array): number {
            // Past the cap the write fails, so the program stops at its next
            // print instead of looping until the time limit.
            if (!output.write(stream, decoder.decode(buffer, { stream: true }))) {
              throw new Error("output limit");
            }
            return buffer.length;
          },
        },
      };
    };
    const stdout = writer("stdout");
    const stderr = writer("stderr");
    const lines = [...(message.stdin ?? [])];
    runtime.setStdout(stdout.handler);
    runtime.setStderr(stderr.handler);
    runtime.setStdin({
      stdin: () => {
        const line = lines.shift();
        return line === undefined ? undefined : `${line}\n`;
      },
    });

    let reportText: unknown;
    try {
      reportText = run(message.source);
    } catch {
      // The run support catches what the program raises and guards what it
      // reads from the error afterwards, so this is the runtime itself
      // failing. The worker cannot be trusted any more.
      output.flush();
      return die("runtime_crashed");
    }
    output.write("stdout", stdout.decoder.decode());
    output.write("stderr", stderr.decoder.decode());
    output.flush();

    const report = typeof reportText === "string" ? parseRunReport(reportText) : undefined;
    if (report === undefined) return die("runtime_crashed");
    const outcome: WorkerOutcome = output.truncated
      ? { kind: "output_limit", message: "" }
      : report.kind === "ok"
        ? { kind: "ok" }
        : {
            kind: report.kind,
            // The run support cuts it already; this keeps the message within
            // what the page accepts whatever the runtime returned.
            message: head(report.message, MESSAGE_LIMIT),
            ...(report.line !== undefined && { line: report.line }),
          };
    state = { name: "ready", ...loaded };
    host.post({
      type: "run_done",
      runId,
      outcome,
      truncated: output.truncated,
      durationMs: Math.max(0, Math.round(host.now() - started)),
    });
  }

  /**
   * Runs each test case in turn with the harness, which captures output and
   * input itself (section 2.2), and posts each result as it is decided, so
   * the page's clock restarts for every test case. Checks always use the
   * test case's input, whatever the input strategy (architecture section 5.3).
   */
  function runChecks(loaded: Loaded, message: Extract<PageMessage, { type: "check" }>): void {
    const { runtime, check } = loaded;
    const { runId } = message;
    // Nothing a test case writes past the harness, through sys.__stdout__,
    // may reach the page as a run's output.
    const discard = { write: (buffer: Uint8Array) => buffer.length };
    runtime.setStdout(discard);
    runtime.setStderr(discard);
    runtime.setStdin({ stdin: () => undefined });
    const results: TestResult[] = [];
    for (const testCase of message.tests) {
      let text: unknown;
      try {
        text = check(message.source, testCase.stdin, testCase.afterCode);
      } catch {
        // The runtime failed, or learner code made the harness raise (harness.ts, check).
        return die("runtime_crashed");
      }
      const parsed = parseHarnessResult(text);
      if (parsed === undefined || parsed.version !== HARNESS_VERSION) return die("runtime_crashed");
      const result = grade(testCase, parsed);
      results.push(result);
      host.post({ type: "test_result", runId, result });
    }
    state = { name: "ready", ...loaded };
    host.post({ type: "check_done", runId, summary: summarize(results) });
  }

  function receive(data: unknown): void {
    if (state.name === "dead") return;
    const parsed = parsePageMessage(data);
    if (!parsed.ok) return die("malformed_message");
    const message = parsed.value;
    switch (message.type) {
      case "init":
        if (state.name !== "idle") return die("unexpected_message");
        // The page and this worker were built together; a different harness
        // means a stale cached worker, whose verdicts the page cannot trust.
        if (message.harnessVersion !== HARNESS_VERSION) return die("version_mismatch");
        state = { name: "loading" };
        void load(message.assetBase);
        return;
      case "run": {
        // `ready` said interactive input is not available, so the page sends batch runs.
        if (state.name !== "ready" || message.mode !== "batch") {
          return die("unexpected_message");
        }
        const loaded = state;
        state = { name: "running" };
        execute(loaded, message);
        return;
      }
      case "check": {
        if (state.name !== "ready") return die("unexpected_message");
        const loaded = state;
        state = { name: "running" };
        runChecks(loaded, message);
        return;
      }
      case "input":
      case "input_end":
        // An answer to a request that is no longer waiting. This worker sends
        // no input requests until WP-3.2, so every answer is one of these.
        return;
      default: {
        const unreachable: never = message;
        return unreachable;
      }
    }
  }

  return { receive };
}
