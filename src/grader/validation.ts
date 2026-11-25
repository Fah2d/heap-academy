// The validation checklist of a lesson (docs/spec/04-content-system.md
// section 4.1; docs/spec/03-experience.md section 7.6; FR-ADM-07, FR-GRD-05).
// The dashboard runs the solution, the starter and each wrong answer against
// the test cases with the learners' worker and harness, then decides each
// rule here, with what the owner needs to fix it.
//
// This module imports only grader modules, like the rest of the grader.

import type { TestResult } from "./grade.ts";
import type { TestCaseId } from "./test-case.ts";

/** The parts rule 1 needs. */
export type LessonBasics = {
  title: string;
  slug: string;
  instructionsMd: string;
  testCaseCount: number;
};

/** Each program's results, one per test case, in the lesson's order. */
export type ValidationRuns = {
  solution: readonly TestResult[];
  starter: readonly TestResult[];
  wrongAnswers: readonly (readonly TestResult[])[];
};

export type LessonPart = "title" | "slug" | "instructions" | "test_cases";

export type TimedOutProgram =
  { program: "solution" } | { program: "starter" } | { program: "wrong_answer"; index: number };

export type RuleState =
  | { rule: "complete"; state: "passed" }
  | { rule: "complete"; state: "failed"; missing: LessonPart[] }
  | { rule: "solution_passes"; state: "passed" }
  | { rule: "solution_passes"; state: "failed"; testCaseIds: TestCaseId[] }
  | { rule: "starter_fails"; state: "passed" }
  | { rule: "starter_fails"; state: "failed" }
  | { rule: "wrong_answers_fail"; state: "passed" }
  | { rule: "wrong_answers_fail"; state: "failed"; wrongAnswers: number[] }
  | { rule: "no_time_limit"; state: "passed" }
  | { rule: "no_time_limit"; state: "failed"; programs: TimedOutProgram[] }
  | { rule: CodeRule; state: "not_run" };

export type ValidationRule = RuleState["rule"];
type CodeRule = "solution_passes" | "starter_fails" | "wrong_answers_fail" | "no_time_limit";

const CODE_RULES: readonly CodeRule[] = [
  "solution_passes",
  "starter_fails",
  "wrong_answers_fail",
  "no_time_limit",
];

const timedOut = (results: readonly TestResult[]) =>
  results.some((result) => result.status === "failed" && result.reason === "time_limit");

const allPass = (results: readonly TestResult[]) =>
  results.every((result) => result.status === "passed");

/**
 * The five rules, in the checklist's order. Without runs, or when the owner
 * stopped one, the four code rules are `not_run`: a stop proves nothing about
 * the lesson. Runs that do not hold one result per test case are a defect of
 * the caller, so they throw.
 */
export function validateLesson(
  basics: LessonBasics,
  runs: ValidationRuns | undefined,
): RuleState[] {
  const missing: LessonPart[] = [];
  if (basics.title.trim() === "") missing.push("title");
  if (basics.slug.trim() === "") missing.push("slug");
  if (basics.instructionsMd.trim() === "") missing.push("instructions");
  if (basics.testCaseCount < 1) missing.push("test_cases");
  const complete: RuleState =
    missing.length === 0
      ? { rule: "complete", state: "passed" }
      : { rule: "complete", state: "failed", missing };

  const notRun = CODE_RULES.map((rule): RuleState => ({ rule, state: "not_run" }));
  if (missing.length > 0 || runs === undefined) return [complete, ...notRun];

  const programs = [runs.solution, runs.starter, ...runs.wrongAnswers];
  if (programs.some((results) => results.length !== basics.testCaseCount)) {
    throw new Error("validation_runs_do_not_match");
  }
  const stopped = programs.some((results) =>
    results.some((result) => result.status === "failed" && result.reason === "stopped"),
  );
  if (stopped) return [complete, ...notRun];

  const notPassed = runs.solution
    .filter((result) => result.status !== "passed")
    .map((result) => result.testCaseId);
  const passingWrongAnswers = runs.wrongAnswers.flatMap((results, index) =>
    allPass(results) ? [index] : [],
  );
  const slow: TimedOutProgram[] = [];
  if (timedOut(runs.solution)) slow.push({ program: "solution" });
  if (timedOut(runs.starter)) slow.push({ program: "starter" });
  runs.wrongAnswers.forEach((results, index) => {
    if (timedOut(results)) slow.push({ program: "wrong_answer", index });
  });

  return [
    complete,
    notPassed.length === 0
      ? { rule: "solution_passes", state: "passed" }
      : { rule: "solution_passes", state: "failed", testCaseIds: notPassed },
    allPass(runs.starter)
      ? { rule: "starter_fails", state: "failed" }
      : { rule: "starter_fails", state: "passed" },
    passingWrongAnswers.length === 0
      ? { rule: "wrong_answers_fail", state: "passed" }
      : { rule: "wrong_answers_fail", state: "failed", wrongAnswers: passingWrongAnswers },
    slow.length === 0
      ? { rule: "no_time_limit", state: "passed" }
      : { rule: "no_time_limit", state: "failed", programs: slow },
  ];
}

/** Publish, and a gradable save of a published lesson, need every rule passed. */
export function validationPassed(rules: readonly RuleState[]): boolean {
  return rules.length === 1 + CODE_RULES.length && rules.every((rule) => rule.state === "passed");
}
