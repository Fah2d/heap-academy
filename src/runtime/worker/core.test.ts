import { describe, expect, it } from "vitest";
import type { WorkerMessage } from "../protocol.ts";
import { createRunId, MESSAGE_LIMIT, parseWorkerMessage } from "../protocol.ts";
import { createWorkerCore, type Runtime, type WorkerHost } from "./core.ts";
import { INTERACTIVE_PROBE_ANSWER, INTERACTIVE_PROBE_SOURCE } from "./run-support.ts";

// The worker's message handling with a fake Pyodide. The real one runs in the
// browser tests (e2e/runtime.spec.ts); the run support's Python is tested in
// CPython (run-support.test.ts).

const BASE = "/_runtime/pyodide/314.0.7/";
const MANIFEST = {
  version: "314.0.7",
  files: [
    { name: "pyodide.mjs", bytes: 10, gzipBytes: 5, brotliBytes: 4 },
    { name: "pyodide.asm.mjs", bytes: 20, gzipBytes: 8, brotliBytes: 6 },
    { name: "pyodide.asm.wasm", bytes: 70, gzipBytes: 30, brotliBytes: 25 },
  ],
  totalBytes: 100,
  totalBrotliBytes: 35,
};
const encoder = new TextEncoder();

type Program = (io: {
  print: (text: string, stream?: "stdout" | "stderr") => void;
  input: () => string | undefined;
}) => string;

function fakeRuntime(version = "314.0.7") {
  let stdout: { write: (buffer: Uint8Array) => number } | undefined;
  let stderr: { write: (buffer: Uint8Array) => number } | undefined;
  let stdin: { stdin: () => string | undefined } | undefined;
  const programs = new Map<string, Program>();
  const runtime: Runtime = {
    version,
    setStdout: (handler) => (stdout = handler),
    setStderr: (handler) => (stderr = handler),
    setStdin: (handler) => (stdin = handler),
    runPython: () => (source: string) => {
      const program = programs.get(source);
      if (program === undefined) throw new Error("runtime broke");
      return program({
        print: (text, stream = "stdout") => {
          (stream === "stdout" ? stdout : stderr)?.write(encoder.encode(text));
        },
        input: () => stdin?.stdin(),
      });
    },
  };
  return { runtime, programs };
}

function setUp({
  runtime = fakeRuntime().runtime,
  manifest = MANIFEST as unknown,
  lockdownOk = true,
}: { runtime?: Runtime; manifest?: unknown; lockdownOk?: boolean } = {}) {
  const posted: WorkerMessage[] = [];
  let time = 0;
  let counting: ((bytes: number) => void) | undefined;
  const imported: string[] = [];
  const calls: string[] = [];
  const host: WorkerHost = {
    post: (message) => posted.push(message),
    now: () => time,
    fetchJson: (url) => {
      calls.push(`fetch ${url}`);
      return Promise.resolve(manifest);
    },
    importModule: (url) => {
      imported.push(url);
      return Promise.resolve({
        loadPyodide: (options: { indexURL: string }) => {
          calls.push(`loadPyodide ${options.indexURL}`);
          counting?.(70);
          return Promise.resolve(runtime);
        },
      });
    },
    countFetchedBytes: (onBytes) => {
      counting = onBytes;
      return () => {
        counting = undefined;
        calls.push("counting stopped");
      };
    },
    lockDown: () => {
      calls.push("lockdown");
      return lockdownOk ? { ok: true } : { ok: false, remaining: ["fetch"] };
    },
  };
  const core = createWorkerCore(host);
  return { core, posted, calls, imported, advance: (ms: number) => (time += ms) };
}

async function ready(setup: ReturnType<typeof setUp>) {
  setup.core.receive({ type: "init", assetBase: BASE });
  await new Promise((resolve) => setTimeout(resolve, 0));
}

const runId = createRunId(1);
const ok = JSON.stringify({ kind: "ok", message: "", line: null });

describe("worker: loading", () => {
  it("[FR-RUN-01] loads from the asset base, reports progress, locks down, then says ready", async () => {
    const setup = setUp();
    await ready(setup);
    expect(setup.imported).toEqual([`${BASE}pyodide.mjs`]);
    expect(setup.calls).toEqual([
      `fetch ${BASE}manifest.json`,
      `loadPyodide ${BASE}`,
      "counting stopped",
      "lockdown",
    ]);
    const progress = setup.posted.filter((message) => message.type === "progress");
    expect(progress[0]).toEqual({ type: "progress", loadedBytes: 0, totalBytes: 100 });
    expect(progress.at(-1)).toEqual({ type: "progress", loadedBytes: 100, totalBytes: 100 });
    expect(setup.posted.at(-1)).toEqual({
      type: "ready",
      runtimeVersion: "314.0.7",
      capabilities: { interactiveInput: false },
    });
  });

  it("[T-01] refuses to become ready when the lock-down did not hold", async () => {
    const setup = setUp({ lockdownOk: false });
    await ready(setup);
    expect(setup.posted.at(-1)).toEqual({ type: "fatal", reason: "lockdown_failed" });
  });

  it("[FR-RUN-07] refuses a runtime whose version is not the one built", async () => {
    const setup = setUp({ runtime: fakeRuntime("314.0.8").runtime });
    await ready(setup);
    expect(setup.posted.at(-1)).toEqual({ type: "fatal", reason: "version_mismatch" });
  });

  it("[FR-RUN-07] gives up when the size manifest is not valid", async () => {
    const setup = setUp({ manifest: { ...MANIFEST, totalBytes: 1 } });
    await ready(setup);
    expect(setup.posted).toEqual([{ type: "fatal", reason: "load_failed" }]);
  });

  it("[NFR-SEC-01] gives up on a malformed message, and then ignores everything", async () => {
    const setup = setUp();
    setup.core.receive({ type: "init", assetBase: BASE, code: "alert(1)" });
    setup.core.receive({ type: "init", assetBase: BASE });
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(setup.posted).toEqual([{ type: "fatal", reason: "malformed_message" }]);
  });

  it("[NFR-SEC-01] gives up on a run before it is ready", () => {
    const setup = setUp();
    setup.core.receive({ type: "run", runId, source: "x", mode: "batch" });
    expect(setup.posted).toEqual([{ type: "fatal", reason: "unexpected_message" }]);
  });
});

describe("worker: runs", () => {
  it("[FR-RUN-01] streams output and reports the outcome", async () => {
    const { runtime, programs } = fakeRuntime();
    programs.set("hello", ({ print }) => {
      print("hello\n");
      print("warning\n", "stderr");
      return ok;
    });
    const setup = setUp({ runtime });
    await ready(setup);
    setup.posted.length = 0;
    setup.core.receive({ type: "run", runId, source: "hello", mode: "batch" });
    expect(setup.posted).toEqual([
      { type: "output", runId, stream: "stdout", text: "hello\n" },
      { type: "output", runId, stream: "stderr", text: "warning\n" },
      { type: "run_done", runId, outcome: { kind: "ok" }, truncated: false, durationMs: 0 },
    ]);
  });

  it("[FR-RUN-01] runs one program after another on the same worker", async () => {
    const { runtime, programs } = fakeRuntime();
    programs.set("one", ({ print }) => {
      print("1\n");
      return ok;
    });
    programs.set("two", ({ print }) => {
      print("2\n");
      return ok;
    });
    const setup = setUp({ runtime });
    await ready(setup);
    setup.core.receive({ type: "run", runId, source: "one", mode: "batch" });
    setup.posted.length = 0;
    const second = createRunId(2);
    setup.core.receive({ type: "run", runId: second, source: "two", mode: "batch" });
    expect(setup.posted).toEqual([
      { type: "output", runId: second, stream: "stdout", text: "2\n" },
      { type: "run_done", runId: second, outcome: { kind: "ok" }, truncated: false, durationMs: 0 },
    ]);
  });

  it("[FR-RUN-01] keeps an error summary within what the page accepts", async () => {
    const { runtime, programs } = fakeRuntime();
    const long = JSON.stringify({ kind: "runtime", message: "x".repeat(5_000), line: 1 });
    programs.set("long", () => long);
    const setup = setUp({ runtime });
    await ready(setup);
    setup.core.receive({ type: "run", runId, source: "long", mode: "batch" });
    const done = setup.posted.at(-1);
    expect(parseWorkerMessage(done).ok).toBe(true);
    expect(done).toMatchObject({ outcome: { message: "x".repeat(MESSAGE_LIMIT) } });
  });

  it("[FR-RUN-01] feeds batch input one line at a time, then ends it", async () => {
    const { runtime, programs } = fakeRuntime();
    const seen: (string | undefined)[] = [];
    programs.set("read", ({ input }) => {
      seen.push(input(), input(), input());
      return JSON.stringify({ kind: "input_ended", message: "EOFError", line: 3 });
    });
    const setup = setUp({ runtime });
    await ready(setup);
    setup.core.receive({ type: "run", runId, source: "read", mode: "batch", stdin: ["Ada", "36"] });
    expect(seen).toEqual(["Ada\n", "36\n", undefined]);
    expect(setup.posted.at(-1)).toMatchObject({
      outcome: { kind: "input_ended", message: "EOFError", line: 3 },
    });
  });

  it("[FR-RUN-03] stops a print flood at the cap and reports output_limit", async () => {
    const { runtime, programs } = fakeRuntime();
    let writes = 0;
    programs.set("flood", ({ print }) => {
      try {
        for (;;) {
          print("x".repeat(1000));
          writes += 1;
        }
      } catch {
        return JSON.stringify({ kind: "runtime", message: "OSError", line: 1 });
      }
    });
    const setup = setUp({ runtime });
    await ready(setup);
    setup.core.receive({ type: "run", runId, source: "flood", mode: "batch" });
    expect(writes).toBe(64);
    const output = setup.posted.filter((message) => message.type === "output");
    expect(output.reduce((total, message) => total + message.text.length, 0)).toBe(64_000);
    expect(setup.posted.at(-1)).toMatchObject({
      type: "run_done",
      outcome: { kind: "output_limit", message: "" },
      truncated: true,
    });
  });

  it("[FR-RUN-06] reports a memory error as the program's outcome", async () => {
    const { runtime, programs } = fakeRuntime();
    programs.set("bomb", () => JSON.stringify({ kind: "memory", message: "MemoryError", line: 1 }));
    const setup = setUp({ runtime });
    await ready(setup);
    setup.core.receive({ type: "run", runId, source: "bomb", mode: "batch" });
    expect(setup.posted.at(-1)).toMatchObject({ outcome: { kind: "memory", line: 1 } });
  });

  it("[FR-RUN-06] gives up when the runtime itself fails, so the page starts a new worker", async () => {
    const setup = setUp();
    await ready(setup);
    setup.core.receive({ type: "run", runId, source: "unknown", mode: "batch" });
    expect(setup.posted.at(-1)).toEqual({ type: "fatal", reason: "runtime_crashed" });
  });

  it("[NFR-COMPAT-04] refuses an interactive run, since ready said it is not available", async () => {
    const setup = setUp();
    await ready(setup);
    setup.core.receive({ type: "run", runId, source: "x", mode: "interactive" });
    expect(setup.posted.at(-1)).toEqual({ type: "fatal", reason: "unexpected_message" });
  });

  it("[FR-RUN-01] decodes a character split across two writes", async () => {
    const { runtime, programs } = fakeRuntime();
    const setup = setUp({ runtime });
    await ready(setup);
    let stdout: { write: (buffer: Uint8Array) => number } | undefined;
    const setStdout = runtime.setStdout;
    runtime.setStdout = (handler) => {
      stdout = handler;
      setStdout(handler);
    };
    programs.set("split", () => {
      const bytes = encoder.encode("é\n");
      stdout?.write(bytes.slice(0, 1));
      stdout?.write(bytes.slice(1));
      return ok;
    });
    setup.core.receive({ type: "run", runId, source: "split", mode: "batch" });
    expect(setup.posted[setup.posted.length - 2]).toEqual({
      type: "output",
      runId,
      stream: "stdout",
      text: "é\n",
    });
  });
});

/**
 * A fake runtime that can pause: its runner has `callPromising`, and the
 * capability probe gets back whatever `probeAnswer` is.
 */
function pausingRuntime(probeAnswer: unknown = INTERACTIVE_PROBE_ANSWER) {
  type Program = (requestLine: () => Promise<string | undefined>) => Promise<string>;
  const state: { program: Program | undefined } = { program: undefined };
  const run = Object.assign(() => ok, {
    callPromising: (_source: string, requestLine: () => Promise<string | undefined>) =>
      state.program!(requestLine),
  });
  const runtime: Runtime = {
    version: "314.0.7",
    setStdout: () => undefined,
    setStderr: () => undefined,
    setStdin: () => undefined,
    runPython: (code) =>
      code === INTERACTIVE_PROBE_SOURCE
        ? { callPromising: (request: () => Promise<unknown>) => request().then(() => probeAnswer) }
        : run,
  };
  return { runtime, state };
}

const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

describe("worker: interactive input", () => {
  it("[NFR-COMPAT-04] offers interactive input only when a real wait returns the promised value", async () => {
    const working = setUp({ runtime: pausingRuntime().runtime });
    await ready(working);
    expect(working.posted.at(-1)).toMatchObject({ capabilities: { interactiveInput: true } });
    const broken = setUp({ runtime: pausingRuntime("something else").runtime });
    await ready(broken);
    expect(broken.posted.at(-1)).toMatchObject({ capabilities: { interactiveInput: false } });
  });

  it("[FR-RUN-02] asks once at a time, and leaves the wait out of the duration", async () => {
    const { runtime, state } = pausingRuntime();
    const setup = setUp({ runtime });
    await ready(setup);
    const seen: (string | undefined)[] = [];
    state.program = async (requestLine) => {
      const first = requestLine();
      seen.push(await requestLine());
      seen.push(await first);
      return ok;
    };
    setup.core.receive({ type: "run", runId, source: "x", mode: "interactive" });
    await settle();
    expect(setup.posted.filter((message) => message.type === "input_request")).toEqual([
      { type: "input_request", runId },
    ]);
    setup.advance(10_000);
    setup.core.receive({ type: "input", runId: createRunId(2), line: "not this run" });
    setup.core.receive({ type: "input", runId, line: "answer" });
    await settle();
    expect(seen).toEqual([undefined, "answer"]);
    expect(setup.posted.at(-1)).toMatchObject({ type: "run_done", durationMs: 0 });
  });

  it("[FR-RUN-06] gives up when an interactive run's runtime fails", async () => {
    const { runtime, state } = pausingRuntime();
    const setup = setUp({ runtime });
    await ready(setup);
    state.program = () => Promise.reject(new Error("runtime broke"));
    setup.core.receive({ type: "run", runId, source: "x", mode: "interactive" });
    await settle();
    expect(setup.posted.at(-1)).toEqual({ type: "fatal", reason: "runtime_crashed" });
  });
});
