import { afterAll, describe, expect, it } from "vitest";
import { EXAMPLE_LESSON } from "../example-lesson.ts";
import { PARITY_CASES, verdictOf } from "../parity-cases.ts";
import type { TestCase, TestCaseId } from "../test-case.ts";
import { createNodeRunner } from "./runner.ts";

// The Node runner runs the harness in Pyodide inside a worker thread, with
// the browser's time limit behavior (docs/spec/04-content-system.md
// section 3.2). These tests start real threads.

const runner = createNodeRunner();
afterAll(() => runner.close());

const LOADING_MS = 60_000;

const one = (fields: Partial<TestCase>): TestCase => ({
  id: "case" as TestCaseId,
  name: "case",
  stdin: "",
  afterCode: "",
  expected: "",
  match: "normalized",
  hint: "",
  ...fields,
});

describe("the Node runner", () => {
  it(
    "[FR-GRD-04] gives the example lesson of section 7 its stated verdicts",
    async () => {
      const statuses = async (source: string) =>
        (await runner.check(source, EXAMPLE_LESSON.testCases)).results.map(
          (result) => result.status,
        );
      expect(await statuses(EXAMPLE_LESSON.solution)).toEqual(EXAMPLE_LESSON.verdicts.solution);
      expect(await statuses(EXAMPLE_LESSON.starter)).toEqual(EXAMPLE_LESSON.verdicts.starter);
      expect(await statuses(EXAMPLE_LESSON.wrongAnswer.code)).toEqual(
        EXAMPLE_LESSON.verdicts.wrongAnswer,
      );
    },
    LOADING_MS,
  );

  it(
    "[FR-GRD-04] with only the first test case, the wrong answer would have been accepted",
    async () => {
      const report = await runner.check(
        EXAMPLE_LESSON.wrongAnswer.code,
        EXAMPLE_LESSON.testCases.slice(0, 1),
      );
      expect(report.summary.allPassed).toBe(true);
    },
    LOADING_MS,
  );

  it(
    "[FR-GRD-01] reports each failure with the actual output, the error, and the summary",
    async () => {
      const report = await runner.check("x = 1\nprint(x / 0)", [
        one({ id: "a" as TestCaseId, expected: "1" }),
        one({ id: "b" as TestCaseId, afterCode: "print(missing)", expected: "1" }),
      ]);
      expect(report.results[0]).toMatchObject({
        testCaseId: "a",
        status: "failed",
        reason: "program_error",
        actual: "",
        error: { kind: "runtime", message: "ZeroDivisionError: division by zero", line: 2 },
      });
      expect(report.summary).toEqual({
        total: 2,
        passed: 0,
        failed: 2,
        notRun: 0,
        allPassed: false,
        timeLimit: false,
      });
    },
    LOADING_MS,
  );

  it.each(PARITY_CASES.map((parity) => [parity.name, parity] as const))(
    "[FR-GRD-04] parity: %s",
    async (_name, parity) => {
      const report = await runner.check(parity.source, parity.testCases);
      expect(report.results.map(verdictOf)).toEqual(parity.expected);
    },
    LOADING_MS,
  );

  it(
    "[NFR-PERF-06] once the runtime is ready, a check of ten test cases takes 500 ms or less",
    async () => {
      const tests = Array.from({ length: 10 }, (_, index) =>
        one({
          id: `case-${String(index)}` as TestCaseId,
          afterCode: `print(area(${String(index)}, 2))`,
          expected: String(index * 2),
        }),
      );
      const source = "def area(width, height):\n    return width * height\n";
      await runner.check(source, tests.slice(0, 1));
      const started = performance.now();
      const report = await runner.check(source, tests);
      const elapsed = performance.now() - started;
      expect(report.summary.allPassed).toBe(true);
      expect(elapsed).toBeLessThanOrEqual(500);
    },
    LOADING_MS,
  );

  it(
    "[FR-RUN-02] terminates the thread at the time limit, and the next check starts a new one",
    async () => {
      const quick = createNodeRunner({ timeLimitMs: 300 });
      try {
        const looped = await quick.check("while True:\n    pass", [
          one({}),
          one({ id: "next" as TestCaseId }),
        ]);
        expect(looped.results.map(verdictOf)).toEqual([
          { status: "failed", reason: "time_limit" },
          { status: "not_run" },
        ]);
        expect(looped.summary.timeLimit).toBe(true);
        const next = await quick.check('print("fresh")', [one({ expected: "fresh" })]);
        expect(next.summary.allPassed).toBe(true);
      } finally {
        await quick.close();
      }
    },
    LOADING_MS,
  );

  it(
    "[FR-RUN-06] a thread that dies during a test case is a crash, and the next check starts a new one",
    async () => {
      const report = await runner.check("import os\nos._exit(1)", [
        one({}),
        one({ id: "next" as TestCaseId }),
      ]);
      expect(report.results.map(verdictOf)).toEqual([
        { status: "failed", reason: "crashed" },
        { status: "not_run" },
      ]);
      const next = await runner.check('print("fresh")', [one({ expected: "fresh" })]);
      expect(next.summary.allPassed).toBe(true);
    },
    LOADING_MS,
  );

  it(
    "[FR-RUN-06] after a memory error the next test case runs on a new thread",
    async () => {
      // A module attribute outlives the harness's soft reset (ADR-0004), so
      // it shows whether the second test case ran on the same interpreter.
      const source =
        'import json\nprint(hasattr(json, "heap_marker"))\njson.heap_marker = 1\nraise MemoryError';
      const report = await runner.check(source, [one({}), one({ id: "next" as TestCaseId })]);
      expect(report.results).toMatchObject([
        { status: "failed", reason: "program_error", actual: "False\n" },
        { status: "failed", reason: "program_error", actual: "False\n" },
      ]);
    },
    LOADING_MS,
  );

  it(
    "[FR-RUN-06] a result from another harness version is a crash, and the rest are not run",
    async () => {
      // The stand-in answers with a result that would pass, except for its version.
      const otherVersion = createNodeRunner({
        threadUrl: new URL(
          "../../../scripts/testing/other-harness-version-thread.ts",
          import.meta.url,
        ),
      });
      try {
        const report = await otherVersion.check("", [one({}), one({ id: "next" as TestCaseId })]);
        expect(report.results.map(verdictOf)).toEqual([
          { status: "failed", reason: "crashed" },
          { status: "not_run" },
        ]);
      } finally {
        await otherVersion.close();
      }
    },
    LOADING_MS,
  );

  it(
    "[FR-RUN-04] what a timer callback does between test cases is undone and collected before the next one",
    async () => {
      // WP-3.3 security review 6, round 2, not checked there: the thread runs
      // one test case per message, so a JavaScript timer the first case set
      // fires between cases. Its callback makes a reference cycle whose
      // __del__ writes, turns the collector off and replaces print; before,
      // the next case's own collection wrote INJECTED into that case's
      // output. json keeps the callback's mark (ADR-0004), which shows that
      // it ran before the second case.
      const source = [
        "import sys, json, builtins",
        "if input() == 'first':",
        "    import gc, js",
        "    from pyodide.ffi import create_proxy",
        "    class Link:",
        "        def __init__(self):",
        "            self.me = self",
        "        def __del__(self, sys=sys):",
        '            sys.stdout.write("INJECTED ")',
        "    def later(*args, b=builtins, Link=Link, gc=gc, json=json):",
        "        json.heap_fired = True",
        "        gc.disable()",
        "        Link()",
        '        b.print = lambda *a, **k: sys.stdout.write("HIJACK ")',
        "    json.heap_keep = (create_proxy(later), Link)",
        "    js.setTimeout(json.heap_keep[0], 0)",
        "else:",
        "    import gc",
        '    print(getattr(json, "heap_fired", False), gc.isenabled())',
        "    gc.collect()",
        'print("ok")',
      ].join("\n");
      const report = await runner.check(source, [
        one({ id: "first" as TestCaseId, stdin: "first\n", expected: "ok" }),
        one({ id: "second" as TestCaseId, stdin: "second\n", expected: "True True\nok" }),
      ]);
      expect(report.results).toMatchObject([
        { status: "passed", actual: "ok\n" },
        { status: "passed", actual: "True True\nok\n" },
      ]);
    },
    LOADING_MS,
  );

  it(
    "[FR-GRD-04] close ends the thread, and the runner starts a new one when used again",
    async () => {
      await runner.close();
      await runner.close();
      expect(
        (await runner.check('print("again")', [one({ expected: "again" })])).summary.allPassed,
      ).toBe(true);
    },
    LOADING_MS,
  );
});
