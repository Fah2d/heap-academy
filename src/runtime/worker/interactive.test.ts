import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { WorkerMessage } from "../protocol.ts";
import { createWorkerCore } from "./core.ts";

// Interactive input in real Pyodide under Node (architecture section 5.3).
// Node, like the browsers of E-08, has WebAssembly stack switching, so the
// worker core finds the capability itself; the second runtime is loaded with
// the capability removed, as a browser without it would be. Neither has the
// lock-down or the worker's policy: those are the browser tests' (e2e).

const PYODIDE = fileURLToPath(new URL("../../../node_modules/pyodide/", import.meta.url));
const VERSION = (JSON.parse(readFileSync(`${PYODIDE}package.json`, "utf8")) as { version: string })
  .version;
const LOADING_MS = 60_000;

type Answer = string | undefined;

/** A worker core on a real runtime, a clock the test moves, and answers to give. */
async function startCore() {
  let clock = 0;
  const posted: WorkerMessage[] = [];
  let listener: ((message: WorkerMessage) => void) | undefined;
  const core = createWorkerCore({
    post: (message) => {
      posted.push(message);
      listener?.(message);
    },
    now: () => clock,
    fetchJson: () =>
      Promise.resolve({
        version: VERSION,
        files: [{ name: "pyodide.mjs", bytes: 1, gzipBytes: 1, brotliBytes: 1 }],
        totalBytes: 1,
        totalBrotliBytes: 1,
      }),
    importModule: (url) => import(url),
    countFetchedBytes: () => () => undefined,
    lockDown: () => ({ ok: true, remaining: [] }),
  });
  const ready = new Promise<WorkerMessage>((resolve) => {
    listener = (message) => {
      if (message.type === "ready" || message.type === "fatal") resolve(message);
    };
  });
  core.receive({ type: "init", assetBase: PYODIDE });
  const readyMessage = await ready;

  /**
   * Runs a program and answers each input request from `answers`, after
   * `waitMs` on the clock; `undefined` ends the input.
   */
  async function run(
    source: string,
    {
      mode = "interactive",
      answers = [],
      stdin,
      waitMs = 0,
    }: {
      mode?: "interactive" | "batch";
      answers?: Answer[];
      stdin?: string[];
      waitMs?: number;
    } = {},
  ) {
    const runId = `run-${String(posted.length)}`;
    const start = posted.length;
    const queue = [...answers];
    const done = new Promise<WorkerMessage>((resolve) => {
      listener = (message) => {
        if (message.type === "input_request") {
          clock += waitMs;
          const answer = queue.shift();
          queueMicrotask(() => {
            core.receive(
              answer === undefined
                ? { type: "input_end", runId }
                : { type: "input", runId, line: answer },
            );
          });
        }
        if (message.type === "run_done" || message.type === "fatal") resolve(message);
      };
    });
    core.receive({ type: "run", runId, source, mode, ...(stdin !== undefined && { stdin }) });
    const end = await done;
    const transcript = posted
      .slice(start)
      .filter((message) => message.type === "output" || message.type === "input_request")
      .map((message) => (message.type === "output" ? message.text : "<input>"));
    return { end, transcript };
  }

  return { readyMessage, run, core, advance: (ms: number) => (clock += ms) };
}

describe("interactive input in Pyodide", () => {
  let runtime: Awaited<ReturnType<typeof startCore>>;
  beforeAll(async () => {
    runtime = await startCore();
  }, LOADING_MS);

  it("[NFR-COMPAT-04] detects the capability at ready", () => {
    expect(runtime.readyMessage).toMatchObject({
      type: "ready",
      capabilities: { interactiveInput: true },
    });
  });

  it("[FR-WSP-08] a program that calls input() twice pauses for each answer, with each prompt shown first", async () => {
    const { end, transcript } = await runtime.run(
      'name = input("Name? ")\nage = input("Age? ")\nprint(f"{name} is {age}")',
      { answers: ["Sara", "12"] },
    );
    expect(transcript).toEqual(["Name? ", "<input>", "Age? ", "<input>", "Sara is 12\n"]);
    expect(end).toMatchObject({ type: "run_done", outcome: { kind: "ok" } });
  });

  it("[FR-RUN-02] time spent waiting for an answer is not counted in the run's duration", async () => {
    const { end } = await runtime.run('input("A? ")\ninput("B? ")', {
      answers: ["1", "2"],
      waitMs: 10_000,
    });
    expect(end).toMatchObject({ type: "run_done", outcome: { kind: "ok" } });
    expect(end.type === "run_done" && end.durationMs).toBeLessThan(1_000);
  });

  it("[FR-WSP-08] the end of input is input_ended at the line that read past it", async () => {
    const { end } = await runtime.run('a = input()\nb = input("B? ")\nprint(a, b)', {
      answers: ["x", undefined],
    });
    expect(end).toMatchObject({
      outcome: { kind: "input_ended", message: "EOFError: EOF when reading a line", line: 2 },
    });
  });

  it("[FR-WSP-08] sys.stdin reads line by line, and read() takes everything until the end", async () => {
    const { end, transcript } = await runtime.run(
      "import sys\nprint(sys.stdin.readline().strip())\nprint(repr(sys.stdin.read()))",
      { answers: ["one", "two", "three", undefined] },
    );
    expect(transcript.filter((text) => text !== "<input>")).toEqual([
      "one\n",
      "'two\\nthree\\n'\n",
    ]);
    expect(end).toMatchObject({ outcome: { kind: "ok" } });
  });

  it("[FR-RUN-04] the next run gets the runtime's own standard input back", async () => {
    await runtime.run("input()", { answers: ["x"] });
    const { end, transcript } = await runtime.run("import sys\nprint(sys.stdin.readline() == '')", {
      mode: "batch",
    });
    expect(transcript).toEqual(["True\n"]);
    expect(end).toMatchObject({ outcome: { kind: "ok" } });
  });

  it("[FR-WSP-08] a batch run still reads the lines it was given on a runtime that has the capability", async () => {
    const { transcript } = await runtime.run("print(input() + input())", {
      mode: "batch",
      stdin: ["a", "b"],
    });
    expect(transcript).toEqual(["ab\n"]);
  });

  it("[FR-RUN-02] an old run's reader, kept by the program, gives the end of input and posts no request", async () => {
    // Standard library attributes survive a run (ADR-0004), so a program can keep its reader.
    await runtime.run("import sys, math\nmath.kept = sys.stdin");
    const { end, transcript } = await runtime.run(
      "import math\nprint(repr(math.kept.readline()))",
      { mode: "batch" },
    );
    expect(transcript).toEqual(["''\n"]);
    expect(end).toMatchObject({ outcome: { kind: "ok" } });
  });

  it("[FR-RUN-02] an answer for a run that is not waiting is dropped", async () => {
    runtime.core.receive({ type: "input", runId: "run-0", line: "late" });
    const { transcript } = await runtime.run('print("still fine")', { mode: "batch" });
    expect(transcript).toEqual(["still fine\n"]);
  });
});

describe("interactive input without stack switching", () => {
  const removed = Reflect.get(WebAssembly, "Suspending") as unknown;
  let runtime: Awaited<ReturnType<typeof startCore>>;
  beforeAll(async () => {
    // As in a browser without the capability: removed before the runtime loads.
    Reflect.deleteProperty(WebAssembly, "Suspending");
    runtime = await startCore();
  }, LOADING_MS);
  afterAll(() => {
    Reflect.set(WebAssembly, "Suspending", removed);
  });

  it("[NFR-COMPAT-04] reports no interactive input at ready when the capability is removed", () => {
    expect(runtime.readyMessage).toMatchObject({ capabilities: { interactiveInput: false } });
  });

  it("[FR-WSP-08] the batch path passes the same program, with the answers given before Run", async () => {
    const { end, transcript } = await runtime.run(
      'name = input("Name? ")\nage = input("Age? ")\nprint(f"{name} is {age}")',
      { mode: "batch", stdin: ["Sara", "12"] },
    );
    expect(transcript.join("")).toBe("Name? Age? Sara is 12\n");
    expect(end).toMatchObject({ outcome: { kind: "ok" } });
  });

  it("[FR-WSP-08] the batch path ends with input_ended when the program reads past the answers", async () => {
    const { end } = await runtime.run("input()\ninput()", { mode: "batch", stdin: ["only one"] });
    expect(end).toMatchObject({ outcome: { kind: "input_ended", line: 2 } });
  });

  it("[NFR-COMPAT-04] refuses an interactive run it did not offer", async () => {
    const { end } = await runtime.run("print(1)");
    expect(end).toEqual({ type: "fatal", reason: "unexpected_message" });
  });
});
