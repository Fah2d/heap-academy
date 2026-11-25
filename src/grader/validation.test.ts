import { describe, expect, it } from "vitest";
import type { TestResult } from "./grade.ts";
import { HARNESS_VERSION } from "./harness.ts";
import type { TestCaseId } from "./test-case.ts";
import {
  type LessonBasics,
  validateLesson,
  type ValidationRuns,
  validationPassed,
} from "./validation.ts";

const ids = ["first", "second"] as TestCaseId[];

const passed = (index: number): TestResult => ({
  testCaseId: ids[index] as TestCaseId,
  status: "passed",
  actual: "ok",
  truncated: false,
  harnessVersion: HARNESS_VERSION,
});

const failed = (
  index: number,
  reason: Extract<TestResult, { status: "failed" }>["reason"] = "mismatch",
): TestResult => ({
  testCaseId: ids[index] as TestCaseId,
  status: "failed",
  reason,
  actual: "no",
  truncated: false,
  harnessVersion: HARNESS_VERSION,
});

const notRun = (index: number): TestResult => ({
  testCaseId: ids[index] as TestCaseId,
  status: "not_run",
  harnessVersion: HARNESS_VERSION,
});

const basics: LessonBasics = {
  title: "Say hello by name",
  slug: "say-hello",
  instructionsMd: "Ask for a name.",
  testCaseCount: 2,
};

const good: ValidationRuns = {
  solution: [passed(0), passed(1)],
  starter: [failed(0), failed(1)],
  wrongAnswers: [[passed(0), failed(1)]],
};

const stateOf = (rules: ReturnType<typeof validateLesson>, rule: string) =>
  rules.find((entry) => entry.rule === rule);

describe("validateLesson", () => {
  it("[FR-ADM-07] [FR-GRD-05] passes a complete lesson whose solution passes, starter fails and wrong answer fails", () => {
    const rules = validateLesson(basics, good);
    expect(rules.map((entry) => entry.rule)).toEqual([
      "complete",
      "solution_passes",
      "starter_fails",
      "wrong_answers_fail",
      "no_time_limit",
    ]);
    expect(rules.every((entry) => entry.state === "passed")).toBe(true);
    expect(validationPassed(rules)).toBe(true);
  });

  it("[FR-ADM-07] names every missing part of the lesson, and runs nothing else", () => {
    const rules = validateLesson(
      { title: " ", slug: "", instructionsMd: "\n", testCaseCount: 0 },
      undefined,
    );
    expect(stateOf(rules, "complete")).toEqual({
      rule: "complete",
      state: "failed",
      missing: ["title", "slug", "instructions", "test_cases"],
    });
    for (const rule of [
      "solution_passes",
      "starter_fails",
      "wrong_answers_fail",
      "no_time_limit",
    ]) {
      expect(stateOf(rules, rule)?.state).toBe("not_run");
    }
    expect(validationPassed(rules)).toBe(false);
  });

  it("[FR-ADM-07] leaves the code rules not run when the lesson is complete but nothing ran yet", () => {
    const rules = validateLesson(basics, undefined);
    expect(stateOf(rules, "complete")?.state).toBe("passed");
    expect(stateOf(rules, "solution_passes")?.state).toBe("not_run");
    expect(validationPassed(rules)).toBe(false);
  });

  it("[FR-GRD-05] fails the solution rule and names each test case it did not pass", () => {
    const rules = validateLesson(basics, { ...good, solution: [passed(0), failed(1)] });
    expect(stateOf(rules, "solution_passes")).toEqual({
      rule: "solution_passes",
      state: "failed",
      testCaseIds: ["second"],
    });
    expect(validationPassed(rules)).toBe(false);
  });

  it("[FR-GRD-05] counts a test case the solution never reached as not passed", () => {
    const rules = validateLesson(basics, {
      ...good,
      solution: [failed(0, "crashed"), notRun(1)],
    });
    expect(stateOf(rules, "solution_passes")).toEqual({
      rule: "solution_passes",
      state: "failed",
      testCaseIds: ["first", "second"],
    });
  });

  it("[FR-GRD-05] fails the starter rule when the starter already passes every test case", () => {
    const rules = validateLesson(basics, { ...good, starter: [passed(0), passed(1)] });
    expect(stateOf(rules, "starter_fails")).toEqual({ rule: "starter_fails", state: "failed" });
    expect(validationPassed(rules)).toBe(false);
  });

  it("[FR-GRD-05] fails the wrong-answer rule and names each wrong answer that passes everything", () => {
    const rules = validateLesson(basics, {
      ...good,
      wrongAnswers: [
        [passed(0), failed(1)],
        [passed(0), passed(1)],
        [passed(0), passed(1)],
      ],
    });
    expect(stateOf(rules, "wrong_answers_fail")).toEqual({
      rule: "wrong_answers_fail",
      state: "failed",
      wrongAnswers: [1, 2],
    });
  });

  it("[FR-GRD-05] passes the wrong-answer rule for a lesson with no wrong answer", () => {
    const rules = validateLesson(basics, { ...good, wrongAnswers: [] });
    expect(stateOf(rules, "wrong_answers_fail")?.state).toBe("passed");
    expect(validationPassed(rules)).toBe(true);
  });

  it("[FR-ADM-07] fails the time rule and names every program that reached the limit", () => {
    const rules = validateLesson(basics, {
      solution: [passed(0), passed(1)],
      starter: [failed(0, "time_limit"), notRun(1)],
      wrongAnswers: [
        [passed(0), failed(1)],
        [failed(0, "time_limit"), notRun(1)],
      ],
    });
    expect(stateOf(rules, "no_time_limit")).toEqual({
      rule: "no_time_limit",
      state: "failed",
      programs: [{ program: "starter" }, { program: "wrong_answer", index: 1 }],
    });
    // A starter that only fails by running out of time still fails a test
    // case; the time rule is what refuses it.
    expect(stateOf(rules, "starter_fails")?.state).toBe("passed");
    expect(validationPassed(rules)).toBe(false);
  });

  it("[FR-ADM-07] names the solution when it reached the time limit", () => {
    const rules = validateLesson(basics, {
      ...good,
      solution: [failed(0, "time_limit"), notRun(1)],
    });
    expect(stateOf(rules, "no_time_limit")).toEqual({
      rule: "no_time_limit",
      state: "failed",
      programs: [{ program: "solution" }],
    });
  });

  it("[FR-ADM-07] treats a validation the owner stopped as not run, so a stop never passes or fails a rule", () => {
    const rules = validateLesson(basics, {
      ...good,
      starter: [failed(0, "stopped"), notRun(1)],
    });
    expect(stateOf(rules, "complete")?.state).toBe("passed");
    for (const rule of [
      "solution_passes",
      "starter_fails",
      "wrong_answers_fail",
      "no_time_limit",
    ]) {
      expect(stateOf(rules, rule)?.state).toBe("not_run");
    }
    expect(validationPassed(rules)).toBe(false);
  });

  it("[FR-ADM-07] refuses runs that do not cover exactly the lesson's test cases", () => {
    expect(() => validateLesson(basics, { ...good, solution: [passed(0)] })).toThrow(
      "validation_runs_do_not_match",
    );
    expect(() =>
      validateLesson(basics, { ...good, wrongAnswers: [[passed(0), passed(1), passed(1)]] }),
    ).toThrow("validation_runs_do_not_match");
  });
});
