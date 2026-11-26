import { consoleText } from "@/grader/console-text";
import type { FailureReason, GradedError, TestResult } from "@/grader/grade";
import type { TestCase, TestCaseId } from "@/grader/test-case";
import { gradableText } from "@/grader/test-case-list";
import type { RuleState } from "@/grader/validation";
import type { ValidationContent } from "./client/validate-lesson";

// What the lesson editor shows of the last validation (docs/spec/03-experience.md
// sections 7.5 and 7.6; FR-ADM-06, FR-ADM-07). A result belongs to the
// content it checked, so each part is shown only while the editor still
// holds that content: the save's hash, Publish, and each test case's verdict.

export type ValidationState =
  | { kind: "idle" }
  | { kind: "running"; stopping: boolean }
  | { kind: "stopped" }
  | { kind: "unavailable" }
  | {
      kind: "done";
      rules: RuleState[];
      passed: boolean;
      hash: string;
      solution: TestResult[] | undefined;
      /** The content as it was when Validate was pressed. */
      checked: ValidationContent;
    };

/**
 * Whether the last finished check covers the editor's content: `gradable`
 * for the starter, solution, wrong answers and test cases (what the save's
 * hash covers), `whole` for those and the parts of rule 1 (what Publish needs).
 */
export function checkedNow(
  state: ValidationState,
  content: ValidationContent,
): { gradable: boolean; whole: boolean } {
  if (state.kind !== "done") return { gradable: false, whole: false };
  const gradable = gradableText(state.checked) === gradableText(content);
  const whole =
    gradable &&
    // A save trims the title, which changes nothing a learner sees.
    state.checked.title.trim() === content.title.trim() &&
    state.checked.slug === content.slug &&
    state.checked.instructionsMd === content.instructionsMd;
  return { gradable, whole };
}

/** The hash a save sends: only for a passing check of exactly the gradable content it saves. */
export function validatedHashFor(
  state: ValidationState,
  content: ValidationContent,
): string | undefined {
  if (state.kind !== "done" || !state.passed) return undefined;
  return checkedNow(state, content).gradable ? state.hash : undefined;
}

export type SolutionVerdict =
  | { state: "pass" }
  | { state: "fail"; reason: FailureReason; error?: GradedError }
  | { state: "not_run" };

export type SolutionView = {
  actual: string;
  truncated: boolean;
  /** Control characters or escape sequences were removed from `actual` (T-07). */
  cleaned: boolean;
  /** Absent once the expected output or the comparison changed: the verdict was about the old one. */
  verdict: SolutionVerdict | undefined;
  /** Whether "Fill from solution" may copy `actual` into the expected output. */
  fillable: boolean;
};

const sameRun = (a: TestCase, b: TestCase) => a.stdin === b.stdin && a.afterCode === b.afterCode;

function verdictOf(result: TestResult): SolutionVerdict {
  if (result.status === "passed") return { state: "pass" };
  if (result.status === "not_run") return { state: "not_run" };
  return {
    state: "fail",
    reason: result.reason,
    ...(result.error === undefined
      ? {}
      : { error: { ...result.error, message: consoleText(result.error.message).text } }),
  };
}

/**
 * The solution's result for each test case it still describes: the same
 * solution, and the same input and follow-up code. Output is copied only
 * from a program that ran to its end, was not cut at the limit, and printed
 * no control character.
 */
export function solutionViews(
  state: ValidationState,
  content: ValidationContent,
): Map<TestCaseId, SolutionView> {
  const views = new Map<TestCaseId, SolutionView>();
  if (state.kind !== "done" || state.solution === undefined) return views;
  if (state.checked.solutionCode !== content.solutionCode) return views;
  for (const testCase of content.testCases) {
    const checked = state.checked.testCases.find((entry) => entry.id === testCase.id);
    const result = state.solution.find((entry) => entry.testCaseId === testCase.id);
    if (checked === undefined || result === undefined || !sameRun(checked, testCase)) continue;
    // Output with control characters is shown without them and never
    // copied: the copy would not be what the solution printed (T-07).
    const printed = consoleText(result.status === "not_run" ? "" : result.actual);
    const actual = printed.text;
    const truncated = result.status === "failed" && result.truncated;
    const ranToEnd =
      result.status === "passed" || (result.status === "failed" && result.reason === "mismatch");
    views.set(testCase.id, {
      actual,
      truncated,
      cleaned: printed.removed,
      verdict:
        checked.expected === testCase.expected && checked.match === testCase.match
          ? verdictOf(result)
          : undefined,
      fillable: ranToEnd && !truncated && !printed.removed && testCase.expected !== actual,
    });
  }
  return views;
}
