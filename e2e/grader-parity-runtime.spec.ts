import { expect, test } from "@playwright/test";
import { verdictOf, PARITY_CASES } from "../src/grader/parity-cases";
import type { TestResult } from "../src/grader/grade";
import { HARNESS_VERSION } from "../src/grader/harness";
import { runtimeAssetBase, WORKER_URL } from "../src/runtime/assets";
import { TIME_LIMIT_MS } from "../src/runtime/controller";

// The parity suite in the browser (FR-GRD-04): the same cases the Node
// runner's test runs (src/grader/node-runner/runner.test.ts), against the
// real worker and harness in Chromium, Firefox and WebKit (the runtime-*
// projects). The section 7 example lesson is among them (WP-3.3 "Done when").
//
// The page drives the worker with the protocol directly and owns the clock
// as the controller does: each test case gets the time limit, and at the
// limit the worker is terminated, that test case fails with time_limit, and
// the rest are not run. It opens the development runtime page only for an
// origin whose policy allows the worker.
//
// Loading Pyodide takes seconds, and one case waits for the 5 second limit,
// so these tests have a longer budget than the default 30 s.
test.describe.configure({ timeout: 120_000 });

test.describe("grader parity", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/dev/runtime");
  });

  for (const parity of PARITY_CASES) {
    test(`[FR-GRD-04] same verdicts as under Node: ${parity.name}`, async ({ page }) => {
      const results = await page.evaluate(
        async ({ workerUrl, assetBase, harnessVersion, timeLimitMs, source, tests }) => {
          const worker = new Worker(workerUrl, { type: "module" });
          const next = () =>
            new Promise<{ type: string; [key: string]: unknown }>((resolve, reject) => {
              const onMessage = (event: MessageEvent<{ type: string; [key: string]: unknown }>) => {
                if (event.data.type === "progress") return;
                worker.removeEventListener("message", onMessage);
                resolve(event.data);
              };
              worker.addEventListener("message", onMessage);
              worker.addEventListener("error", () => reject(new Error("worker error")), {
                once: true,
              });
            });
          worker.postMessage({ type: "init", assetBase, harnessVersion });
          const ready = await next();
          if (ready.type !== "ready")
            throw new Error(`worker did not start: ${JSON.stringify(ready)}`);
          worker.postMessage({ type: "check", runId: "parity-1", source, tests });
          const collected: unknown[] = [];
          for (;;) {
            const timeout = new Promise<"time_limit">((resolve) =>
              setTimeout(() => resolve("time_limit"), timeLimitMs),
            );
            const message = await Promise.race([next(), timeout]);
            if (message === "time_limit") {
              worker.terminate();
              tests.slice(collected.length).forEach((testCase, index) => {
                collected.push(
                  index === 0
                    ? {
                        testCaseId: testCase.id,
                        status: "failed",
                        reason: "time_limit",
                        actual: "",
                        truncated: false,
                        harnessVersion,
                      }
                    : { testCaseId: testCase.id, status: "not_run", harnessVersion },
                );
              });
              return collected;
            }
            if (message.type === "test_result") collected.push(message["result"]);
            else if (message.type === "check_done") break;
            else throw new Error(`unexpected message: ${JSON.stringify(message)}`);
          }
          worker.terminate();
          return collected;
        },
        {
          workerUrl: WORKER_URL,
          assetBase: runtimeAssetBase,
          harnessVersion: HARNESS_VERSION,
          timeLimitMs: TIME_LIMIT_MS,
          source: parity.source,
          tests: [...parity.testCases],
        },
      );
      expect((results as TestResult[]).map(verdictOf)).toEqual(parity.expected);
    });
  }
});
