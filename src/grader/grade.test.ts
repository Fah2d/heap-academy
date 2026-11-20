import { describe, expect, it } from "vitest";
import {
  grade,
  type HarnessResult,
  parseCheckSummary,
  parseHarnessResult,
  parseTestResult,
  summarize,
  type TestResult,
  unfinished,
} from "./grade.ts";
import { HARNESS_OUTPUT_LIMIT, HARNESS_VERSION } from "./harness.ts";
import type { TestCase, TestCaseId } from "./test-case.ts";

const testCase: TestCase = {
  id: "area-3-4" as TestCaseId,
  name: "area(3, 4) gives 12",
  stdin: "",
  afterCode: "print(area(3, 4))",
  expected: "12",
  match: "normalized",
  hint: "",
};

const harness = (overrides: Partial<HarnessResult>): HarnessResult => ({
  version: HARNESS_VERSION,
  stage: "after_code",
  output: "12\n",
  truncated: false,
  error: undefined,
  ...overrides,
});

const harnessText = (fields: Record<string, unknown>) =>
  JSON.stringify({
    version: "1",
    stage: "program",
    output: "",
    truncated: false,
    error: null,
    ...fields,
  });

describe("grade", () => {
  it("[FR-GRD-01] passes when the output matches", () => {
    expect(grade(testCase, harness({}))).toEqual({
      testCaseId: testCase.id,
      status: "passed",
      actual: "12\n",
      truncated: false,
      harnessVersion: HARNESS_VERSION,
    });
  });

  it("[FR-GRD-01] fails with the actual output when it does not match", () => {
    expect(grade(testCase, harness({ output: "13\n" }))).toMatchObject({
      status: "failed",
      reason: "mismatch",
      actual: "13\n",
    });
  });

  it("[FR-GRD-01] fails on a learner error, with the error", () => {
    const error = {
      kind: "runtime",
      message: "ZeroDivisionError: division by zero",
      line: 2,
    } as const;
    expect(grade(testCase, harness({ stage: "program", error }))).toMatchObject({
      status: "failed",
      reason: "program_error",
      error,
    });
  });

  it("[FR-GRD-01] fails on a follow-up code error, with the missing name", () => {
    const error = {
      kind: "runtime",
      message: "NameError: name 'area' is not defined",
      missingName: "area",
    } as const;
    expect(grade(testCase, harness({ error }))).toMatchObject({
      status: "failed",
      reason: "after_code_error",
      error,
    });
  });

  it("[FR-RUN-03] fails at the output limit, even when the kept output would match", () => {
    expect(
      grade(testCase, harness({ error: { kind: "output_limit" }, truncated: true })),
    ).toMatchObject({
      status: "failed",
      reason: "output_limit",
      truncated: true,
    });
    expect(
      grade({ ...testCase, match: "contains" }, harness({ output: "12\n", truncated: true })),
    ).toMatchObject({ status: "failed", reason: "mismatch" });
  });

  it("[FR-GRD-03] uses the test case's comparison mode", () => {
    expect(grade({ ...testCase, match: "exact" }, harness({})).status).toBe("failed");
    expect(grade({ ...testCase, match: "exact", expected: "12\n" }, harness({})).status).toBe(
      "passed",
    );
  });
});

describe("unfinished and summarize", () => {
  const second = { ...testCase, id: "second" as TestCaseId };
  const third = { ...testCase, id: "third" as TestCaseId };

  it("[FR-GRD-01] the running test case reached the time limit, and the rest are not run", () => {
    const results = unfinished([testCase, second, third], "time_limit");
    expect(results.map((result) => result.status)).toEqual(["failed", "not_run", "not_run"]);
    expect(summarize(results)).toEqual({
      total: 3,
      passed: 0,
      failed: 1,
      notRun: 2,
      allPassed: false,
      timeLimit: true,
    });
  });

  it("[FR-GRD-01] all passed only when every test case ran and passed", () => {
    const passed = grade(testCase, harness({}));
    expect(summarize([passed, passed]).allPassed).toBe(true);
    expect(summarize([]).allPassed).toBe(false);
    expect(summarize(unfinished([testCase], "crashed"))).toMatchObject({
      allPassed: false,
      timeLimit: false,
    });
  });
});

describe("parseHarnessResult", () => {
  it("[FR-GRD-01] reads a result with no error, an error, and the output limit", () => {
    expect(parseHarnessResult(harnessText({ output: "hi\n" }))).toEqual({
      version: "1",
      stage: "program",
      output: "hi\n",
      truncated: false,
      error: undefined,
    });
    expect(
      parseHarnessResult(
        harnessText({
          stage: "after_code",
          error: { kind: "runtime", message: "NameError", line: null, name: "area" },
        }),
      )?.error,
    ).toEqual({ kind: "runtime", message: "NameError", missingName: "area" });
    expect(
      parseHarnessResult(
        harnessText({ error: { kind: "syntax", message: "SyntaxError", line: 3, name: null } }),
      )?.error,
    ).toEqual({ kind: "syntax", message: "SyntaxError", line: 3 });
    expect(
      parseHarnessResult(
        harnessText({
          truncated: true,
          error: { kind: "output_limit", message: "", line: null, name: null },
        }),
      )?.error,
    ).toEqual({ kind: "output_limit" });
  });

  it.each([
    ["not text", 3],
    ["not JSON", "{"],
    ["an array", "[]"],
    ["an extra field", harnessText({ extra: 1 })],
    ["an unknown stage", harnessText({ stage: "setup" })],
    ["output over the limit", harnessText({ output: "x".repeat(HARNESS_OUTPUT_LIMIT + 1) })],
    ["a truncated flag that is not a boolean", harnessText({ truncated: "no" })],
    ["an error that is not an object", harnessText({ error: "boom" })],
    [
      "an unknown error kind",
      harnessText({ error: { kind: "panic", message: "", line: null, name: null } }),
    ],
    ["line 0", harnessText({ error: { kind: "runtime", message: "", line: 0, name: null } })],
    [
      "an empty missing name",
      harnessText({
        stage: "after_code",
        error: { kind: "runtime", message: "", line: null, name: "" },
      }),
    ],
    [
      "a missing name outside the follow-up code",
      harnessText({ error: { kind: "runtime", message: "", line: null, name: "area" } }),
    ],
    [
      "an extra error field",
      harnessText({ error: { kind: "runtime", message: "", line: null, name: null, x: 1 } }),
    ],
  ])("[FR-GRD-01] treats %s as a broken runtime", (_label, text) => {
    expect(parseHarnessResult(text)).toBeUndefined();
  });

  it("[FR-GRD-01] counts output in characters, so the limit holds outside the basic plane", () => {
    expect(
      parseHarnessResult(harnessText({ output: "😀".repeat(HARNESS_OUTPUT_LIMIT) })),
    ).toBeDefined();
    expect(
      parseHarnessResult(harnessText({ output: "😀".repeat(HARNESS_OUTPUT_LIMIT) + "a" })),
    ).toBeUndefined();
  });
});

describe("parseTestResult and parseCheckSummary", () => {
  const samples: TestResult[] = [
    grade(testCase, harness({})),
    grade(testCase, harness({ output: "13" })),
    grade(
      testCase,
      harness({ error: { kind: "runtime", message: "NameError", missingName: "area" } }),
    ),
    grade(
      testCase,
      harness({ stage: "program", error: { kind: "syntax", message: "SyntaxError", line: 1 } }),
    ),
    ...unfinished([testCase, testCase], "time_limit"),
  ];

  it("[FR-GRD-01] reads back every kind of result", () => {
    for (const sample of samples)
      expect(parseTestResult(JSON.parse(JSON.stringify(sample)))).toEqual(sample);
  });

  it.each([
    ["null", null],
    ["a bad ID", { ...samples[0], testCaseId: "has space" }],
    ["an unknown status", { ...samples[0], status: "skipped" }],
    ["a passed result marked truncated", { ...samples[0], truncated: true }],
    ["a passed result with a reason", { ...samples[0], reason: "mismatch" }],
    ["an unknown reason", { ...samples[1], reason: "flaky" }],
    ["a program error without its error", { ...samples[1], reason: "program_error" }],
    ["a mismatch with an error", { ...samples[1], error: { kind: "runtime", message: "" } }],
    [
      "a missing name on a program error",
      { ...samples[3], error: { kind: "runtime", message: "", missingName: "x" } },
    ],
    ["a not-run result with output", { ...samples[5], actual: "" }],
    ["a long harness version", { ...samples[0], harnessVersion: "1".repeat(17) }],
    ["actual output that is not text", { ...samples[1], actual: 1 }],
  ])("[FR-GRD-01] refuses %s", (_label, value) => {
    expect(parseTestResult(value)).toBeUndefined();
  });

  it("[FR-GRD-01] reads a summary whose counts add up, and refuses one whose do not", () => {
    const summary = summarize(samples);
    expect(parseCheckSummary(JSON.parse(JSON.stringify(summary)))).toEqual(summary);
    expect(parseCheckSummary({ ...summary, passed: summary.passed + 1 })).toBeUndefined();
    expect(parseCheckSummary({ ...summary, allPassed: true })).toBeUndefined();
    expect(parseCheckSummary({ ...summary, total: -1 })).toBeUndefined();
    expect(parseCheckSummary({ ...summary, timeLimit: "yes" })).toBeUndefined();
    expect(parseCheckSummary({ ...summary, extra: 1 })).toBeUndefined();
    expect(parseCheckSummary(null)).toBeUndefined();
  });
});
