import { describe, expect, it } from "vitest";
import type { TestResult } from "@/grader/grade";
import { HARNESS_VERSION } from "@/grader/harness";
import type { TestCase, TestCaseId } from "@/grader/test-case";
import type { RuleState } from "@/grader/validation";
import type { ValidationContent } from "./client/validate-lesson";
import {
  checkedNow,
  solutionViews,
  validatedHashFor,
  type ValidationState,
} from "./validation-view";

const testCase = (id: string, over: Partial<TestCase> = {}): TestCase => ({
  id: id as TestCaseId,
  name: `Case ${id}`,
  stdin: "3",
  afterCode: "",
  expected: "6",
  match: "normalized",
  hint: "",
  ...over,
});

const content: ValidationContent = {
  title: "Double",
  slug: "double",
  instructionsMd: "Print twice the number.",
  starterCode: "",
  solutionCode: "print(int(input()) * 2)",
  wrongAnswers: [],
  testCases: [testCase("t1"), testCase("t2", { stdin: "4", expected: "9" }), testCase("t3")],
};

const passedRules: RuleState[] = [
  { rule: "complete", state: "passed" },
  { rule: "solution_passes", state: "passed" },
  { rule: "starter_fails", state: "passed" },
  { rule: "wrong_answers_fail", state: "passed" },
  { rule: "no_time_limit", state: "passed" },
];

const solution: TestResult[] = [
  {
    testCaseId: "t1" as TestCaseId,
    status: "passed",
    actual: "6\n",
    truncated: false,
    harnessVersion: HARNESS_VERSION,
  },
  {
    testCaseId: "t2" as TestCaseId,
    status: "failed",
    reason: "mismatch",
    actual: "8\n",
    truncated: false,
    harnessVersion: HARNESS_VERSION,
  },
  {
    testCaseId: "t3" as TestCaseId,
    status: "failed",
    reason: "program_error",
    actual: "",
    truncated: false,
    error: { kind: "runtime", message: "ValueError: invalid literal" },
    harnessVersion: HARNESS_VERSION,
  },
];

const done = (over: Partial<Extract<ValidationState, { kind: "done" }>> = {}): ValidationState => ({
  kind: "done",
  rules: passedRules,
  passed: true,
  hash: "a".repeat(64),
  solution,
  checked: content,
  ...over,
});

describe("checkedNow [FR-ADM-07]", () => {
  it("says the check covers the content now in the editor when nothing changed", () => {
    expect(checkedNow(done(), content)).toEqual({ gradable: true, whole: true });
  });

  it("keeps the gradable content checked when only the title changes, but not the whole lesson", () => {
    expect(checkedNow(done(), { ...content, title: "Twice" })).toEqual({
      gradable: true,
      whole: false,
    });
  });

  it("still covers the whole lesson once a save trims the title it checked", () => {
    const checked = done({ checked: { ...content, title: "  Double " } });
    expect(checkedNow(checked, content)).toEqual({ gradable: true, whole: true });
  });

  it("says neither once a test case changes", () => {
    const changed = { ...content, testCases: [testCase("t1", { expected: "7" })] };
    expect(checkedNow(done(), changed)).toEqual({ gradable: false, whole: false });
  });

  it("says neither when nothing finished", () => {
    expect(checkedNow({ kind: "idle" }, content)).toEqual({ gradable: false, whole: false });
    expect(checkedNow({ kind: "stopped" }, content)).toEqual({ gradable: false, whole: false });
  });
});

describe("validatedHashFor [FR-ADM-07, T-22]", () => {
  it("gives the hash only for a passing check of the gradable content now in the editor", () => {
    expect(validatedHashFor(done(), content)).toBe("a".repeat(64));
    expect(validatedHashFor(done(), { ...content, title: "Twice" })).toBe("a".repeat(64));
    expect(validatedHashFor(done({ passed: false }), content)).toBeUndefined();
    expect(validatedHashFor(done(), { ...content, solutionCode: "print(6)" })).toBeUndefined();
    expect(validatedHashFor({ kind: "running", stopping: false }, content)).toBeUndefined();
  });
});

describe("solutionViews [FR-ADM-06]", () => {
  it("gives each test case the solution's verdict and actual output", () => {
    const views = solutionViews(done(), content);
    expect(views.get("t1" as TestCaseId)).toEqual({
      actual: "6\n",
      truncated: false,
      cleaned: false,
      verdict: { state: "pass" },
      fillable: true,
    });
    expect(views.get("t2" as TestCaseId)).toEqual({
      actual: "8\n",
      truncated: false,
      cleaned: false,
      verdict: { state: "fail", reason: "mismatch" },
      fillable: true,
    });
    expect(views.get("t3" as TestCaseId)).toEqual({
      actual: "",
      truncated: false,
      cleaned: false,
      verdict: {
        state: "fail",
        reason: "program_error",
        error: { kind: "runtime", message: "ValueError: invalid literal" },
      },
      fillable: false,
    });
  });

  it("offers Fill from solution only when the expected output differs from what the solution printed", () => {
    const filled = {
      ...content,
      testCases: [testCase("t1", { expected: "6\n" }), ...content.testCases.slice(1)],
    };
    expect(solutionViews(done(), filled).get("t1" as TestCaseId)?.fillable).toBe(false);
  });

  it("keeps the actual output but drops the verdict once the expected output changes", () => {
    const edited = {
      ...content,
      testCases: [content.testCases[0], testCase("t2", { stdin: "4", expected: "8" })].filter(
        (entry) => entry !== undefined,
      ),
    };
    expect(solutionViews(done(), edited).get("t2" as TestCaseId)).toEqual({
      actual: "8\n",
      truncated: false,
      cleaned: false,
      verdict: undefined,
      fillable: true,
    });
  });

  it("drops a test case whose input or follow-up code changed, and every one when the solution changed", () => {
    const newInput = { ...content, testCases: [testCase("t1", { stdin: "5" })] };
    expect(solutionViews(done(), newInput).size).toBe(0);
    const newAfter = { ...content, testCases: [testCase("t1", { afterCode: "print(x)" })] };
    expect(solutionViews(done(), newAfter).size).toBe(0);
    expect(solutionViews(done(), { ...content, solutionCode: "print(6)" }).size).toBe(0);
  });

  it("gives nothing for a test case that was not run, a new test case, or no finished check", () => {
    const notRun: TestResult[] = [
      { testCaseId: "t1" as TestCaseId, status: "not_run", harnessVersion: HARNESS_VERSION },
    ];
    expect(solutionViews(done({ solution: notRun }), content).get("t1" as TestCaseId)).toEqual({
      actual: "",
      truncated: false,
      cleaned: false,
      verdict: { state: "not_run" },
      fillable: false,
    });
    const added = { ...content, testCases: [...content.testCases, testCase("t9")] };
    expect(solutionViews(done(), added).has("t9" as TestCaseId)).toBe(false);
    expect(solutionViews(done({ solution: undefined }), content).size).toBe(0);
    expect(solutionViews({ kind: "unavailable" }, content).size).toBe(0);
  });

  it("does not offer to fill from output that was cut at the limit", () => {
    const cut: TestResult[] = [
      {
        testCaseId: "t1" as TestCaseId,
        status: "failed",
        reason: "mismatch",
        actual: "6",
        truncated: true,
        harnessVersion: HARNESS_VERSION,
      },
    ];
    expect(solutionViews(done({ solution: cut }), content).get("t1" as TestCaseId)?.fillable).toBe(
      false,
    );
  });

  it("[T-07] shows output and Python's message without control characters, and does not fill from it", () => {
    const printed: TestResult[] = [
      {
        testCaseId: "t1" as TestCaseId,
        status: "failed",
        reason: "mismatch",
        actual: "\u001b[2J6\u202e\n",
        truncated: false,
        harnessVersion: HARNESS_VERSION,
      },
      {
        testCaseId: "t3" as TestCaseId,
        status: "failed",
        reason: "program_error",
        actual: "",
        truncated: false,
        error: { kind: "runtime", message: "ValueError: \u001b[31mbad\u0007" },
        harnessVersion: HARNESS_VERSION,
      },
    ];
    const views = solutionViews(done({ solution: printed }), content);
    expect(views.get("t1" as TestCaseId)).toEqual({
      actual: "6\n",
      truncated: false,
      cleaned: true,
      verdict: { state: "fail", reason: "mismatch" },
      fillable: false,
    });
    expect(views.get("t3" as TestCaseId)?.verdict).toEqual({
      state: "fail",
      reason: "program_error",
      error: { kind: "runtime", message: "ValueError: bad" },
    });
  });
});
