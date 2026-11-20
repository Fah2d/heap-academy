// The Node runner (docs/spec/04-content-system.md section 3.2): runs a check
// in Pyodide inside a Node worker thread, with the browser's time limit
// behavior. Each test case gets the limit; at the limit the thread is
// terminated, that test case fails with `time_limit`, the ones after it are
// not run, and the next check starts a new thread. The grader's own tests
// and the parity suite use it (FR-GRD-04). Tests and scripts only (ADR-0032).

import { Worker } from "node:worker_threads";
import {
  type CheckSummary,
  grade,
  parseHarnessResult,
  summarize,
  type TestResult,
  unfinished,
} from "../grade.ts";
import { TEST_CASE_TIME_LIMIT_MS, type TestCase } from "../test-case.ts";

export type CheckReport = { results: TestResult[]; summary: CheckSummary };

export type NodeRunner = {
  check: (source: string, testCases: readonly TestCase[]) => Promise<CheckReport>;
  /** Ends the thread. The runner starts a new one if it is used again. */
  close: () => Promise<void>;
};

type CaseOutcome = { kind: "text"; text: unknown } | { kind: "time_limit" } | { kind: "crashed" };

function isMessage(value: unknown, type: string): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && Reflect.get(value, "type") === type;
}

function startThread(): Promise<Worker> {
  const worker = new Worker(new URL("./thread.ts", import.meta.url));
  return new Promise((resolve, reject) => {
    const cleanup = () => {
      worker.off("message", onMessage);
      worker.off("error", onError);
      worker.off("exit", onExit);
    };
    const onMessage = (message: unknown) => {
      if (!isMessage(message, "ready")) return;
      cleanup();
      resolve(worker);
    };
    const onError = (error: Error) => {
      cleanup();
      reject(error);
    };
    const onExit = (code: number) => {
      cleanup();
      reject(new Error(`the Node runner's thread exited with ${String(code)} while loading`));
    };
    worker.on("message", onMessage);
    worker.on("error", onError);
    worker.on("exit", onExit);
  });
}

function runCase(
  worker: Worker,
  source: string,
  testCase: TestCase,
  timeLimitMs: number,
): Promise<CaseOutcome> {
  return new Promise((resolve) => {
    const finish = (outcome: CaseOutcome) => {
      clearTimeout(timer);
      worker.off("message", onMessage);
      worker.off("error", onFailure);
      worker.off("exit", onFailure);
      resolve(outcome);
    };
    const onMessage = (message: unknown) => {
      if (isMessage(message, "result")) finish({ kind: "text", text: message["text"] });
    };
    const onFailure = () => {
      finish({ kind: "crashed" });
    };
    const timer = setTimeout(() => {
      finish({ kind: "time_limit" });
    }, timeLimitMs);
    worker.on("message", onMessage);
    worker.on("error", onFailure);
    worker.on("exit", onFailure);
    worker.postMessage({ source, stdin: testCase.stdin, afterCode: testCase.afterCode });
  });
}

export function createNodeRunner({ timeLimitMs = TEST_CASE_TIME_LIMIT_MS } = {}): NodeRunner {
  let thread: Promise<Worker> | undefined;

  async function discard(): Promise<void> {
    const current = thread;
    thread = undefined;
    if (current !== undefined) await (await current).terminate();
  }

  async function check(source: string, testCases: readonly TestCase[]): Promise<CheckReport> {
    const results: TestResult[] = [];
    for (const [index, testCase] of testCases.entries()) {
      thread ??= startThread();
      const outcome = await runCase(await thread, source, testCase, timeLimitMs);
      const parsed = outcome.kind === "text" ? parseHarnessResult(outcome.text) : undefined;
      if (parsed === undefined) {
        // The clock ran out, or the thread or the harness broke: a new thread
        // for the next check, and nothing more on this one.
        await discard();
        results.push(
          ...unfinished(
            testCases.slice(index),
            outcome.kind === "time_limit" ? "time_limit" : "crashed",
          ),
        );
        break;
      }
      results.push(grade(testCase, parsed));
    }
    return { results, summary: summarize(results) };
  }

  return { check, close: discard };
}
