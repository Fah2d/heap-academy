import { describe, expect, it, vi } from "vitest";
import type { TestResult } from "@/grader/grade";
import { HARNESS_VERSION } from "@/grader/harness";
import type { TestCase, TestCaseId } from "@/grader/test-case";
import { gradableHash } from "../gradable-hash";
import {
  type CheckProgram,
  validateLessonContent,
  type ValidationContent,
} from "./validate-lesson";

const testCases: TestCase[] = ["t1", "t2"].map((id) => ({
  id: id as TestCaseId,
  name: `Case ${id}`,
  stdin: "",
  afterCode: "",
  expected: "ok",
  match: "normalized",
  hint: "",
}));

const content: ValidationContent = {
  title: "Say hello",
  slug: "say-hello",
  instructionsMd: "Print ok.",
  starterCode: "# start",
  solutionCode: "print('ok')",
  wrongAnswers: [
    { label: "Prints no", code: "print('no')" },
    { label: "Prints nothing", code: "pass" },
  ],
  testCases,
};

const result = (
  testCase: TestCase,
  status: "passed" | "failed",
  reason: "mismatch" | "stopped" | "time_limit" = "mismatch",
): TestResult =>
  status === "passed"
    ? {
        testCaseId: testCase.id,
        status,
        actual: "ok",
        truncated: false,
        harnessVersion: HARNESS_VERSION,
      }
    : {
        testCaseId: testCase.id,
        status,
        reason,
        actual: "",
        truncated: false,
        harnessVersion: HARNESS_VERSION,
      };

/** The solution passes everything; every other program fails everything. */
const honest: CheckProgram = (source, tests) =>
  Promise.resolve(
    tests.map((testCase) =>
      result(testCase, source === content.solutionCode ? "passed" : "failed"),
    ),
  );

describe("validateLessonContent [FR-ADM-06, FR-ADM-07]", () => {
  it("[FR-GRD-05] checks the solution, the starter and each wrong answer, in that order, against every test case", async () => {
    const check = vi.fn(honest);
    const outcome = await validateLessonContent(content, check);
    expect(check.mock.calls.map(([source]) => source)).toEqual([
      "print('ok')",
      "# start",
      "print('no')",
      "pass",
    ]);
    for (const [, tests] of check.mock.calls) expect(tests).toEqual(testCases);
    expect(outcome.kind).toBe("done");
    if (outcome.kind !== "done") return;
    expect(outcome.passed).toBe(true);
    expect(outcome.rules.every((rule) => rule.state === "passed")).toBe(true);
  });

  it("[FR-ADM-06] gives the solution's results, for the verdict per test case and Fill from solution", async () => {
    const outcome = await validateLessonContent(content, honest);
    expect(outcome.kind === "done" && outcome.solution).toEqual(
      testCases.map((testCase) => result(testCase, "passed")),
    );
  });

  it("[FR-ADM-07] gives the hash of the content it was given, for the save to compare", async () => {
    const outcome = await validateLessonContent(content, honest);
    expect(outcome.kind === "done" && outcome.hash).toBe(await gradableHash(content));
  });

  it("[FR-GRD-05] reports a failing rule and does not pass", async () => {
    const starterPasses: CheckProgram = (source, tests) =>
      Promise.resolve(
        tests.map((testCase) => result(testCase, source === "pass" ? "failed" : "passed")),
      );
    const outcome = await validateLessonContent(content, starterPasses);
    expect(outcome.kind === "done" && outcome.passed).toBe(false);
    expect(
      outcome.kind === "done" && outcome.rules.find((rule) => rule.rule === "starter_fails"),
    ).toEqual({ rule: "starter_fails", state: "failed" });
  });

  it("[FR-ADM-07] runs nothing for an incomplete lesson, and names what is missing", async () => {
    const check = vi.fn(honest);
    const outcome = await validateLessonContent(
      { ...content, instructionsMd: " ", testCases: [] },
      check,
    );
    expect(check).not.toHaveBeenCalled();
    expect(outcome.kind === "done" && outcome.rules[0]).toEqual({
      rule: "complete",
      state: "failed",
      missing: ["instructions", "test_cases"],
    });
    expect(outcome.kind === "done" && outcome.solution).toBeUndefined();
  });

  it("[FR-ADM-07] ends at the first stopped check, and runs nothing after it", async () => {
    const check = vi.fn<CheckProgram>((source, tests) =>
      Promise.resolve(
        source === "# start"
          ? tests.map((testCase) => result(testCase, "failed", "stopped"))
          : tests.map((testCase) => result(testCase, "passed")),
      ),
    );
    expect(await validateLessonContent(content, check)).toEqual({ kind: "stopped" });
    expect(check).toHaveBeenCalledTimes(2);
  });

  it("[FR-ADM-07] says the runtime is unavailable when a check cannot run, and runs nothing after it", async () => {
    const check = vi.fn<CheckProgram>(() => Promise.resolve(undefined));
    expect(await validateLessonContent(content, check)).toEqual({ kind: "unavailable" });
    expect(check).toHaveBeenCalledTimes(1);
  });

  it("[FR-ADM-07] still reports a time limit as a failed rule, not as a stop", async () => {
    const slow: CheckProgram = (source, tests) =>
      Promise.resolve(
        tests.map((testCase) =>
          source === "pass"
            ? result(testCase, "failed", "time_limit")
            : result(testCase, source === content.solutionCode ? "passed" : "failed"),
        ),
      );
    const outcome = await validateLessonContent(content, slow);
    expect(outcome.kind === "done" && outcome.passed).toBe(false);
    expect(
      outcome.kind === "done" && outcome.rules.find((rule) => rule.rule === "no_time_limit"),
    ).toEqual({
      rule: "no_time_limit",
      state: "failed",
      programs: [{ program: "wrong_answer", index: 1 }],
    });
  });
});
