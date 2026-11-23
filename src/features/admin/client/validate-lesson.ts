import type { TestResult } from "@/grader/grade";
import type { TestCase } from "@/grader/test-case";
import type { GradableContent } from "@/grader/test-case-list";
import {
  type RuleState,
  type ValidationRuns,
  validateLesson,
  validationPassed,
} from "@/grader/validation";
import { gradableHash } from "../gradable-hash";

// Validate, in the lesson editor (docs/spec/03-experience.md section 7.6;
// docs/spec/04-content-system.md section 4.1; FR-ADM-06, FR-ADM-07). The
// solution, the starter and each wrong answer are checked in turn against
// the test cases, through the learners' worker and harness (the caller's
// CheckProgram), and the checklist is decided from the results. The hash is
// of the content given here, so a save can tell whether it is saving exactly
// what passed.

/**
 * Checks one program against the test cases and gives one result per test
 * case, or undefined when the runtime cannot run it (it failed to load, or
 * the editor closed).
 */
export type CheckProgram = (
  source: string,
  tests: readonly TestCase[],
) => Promise<TestResult[] | undefined>;

export type ValidationContent = GradableContent & {
  title: string;
  slug: string;
  instructionsMd: string;
};

export type ValidationOutcome =
  | {
      kind: "done";
      rules: RuleState[];
      passed: boolean;
      hash: string;
      /** The solution's result per test case; absent when nothing ran. */
      solution: TestResult[] | undefined;
    }
  /** The owner pressed Stop: no rule is decided. */
  | { kind: "stopped" }
  | { kind: "unavailable" };

const wasStopped = (results: readonly TestResult[]) =>
  results.some((result) => result.status === "failed" && result.reason === "stopped");

export async function validateLessonContent(
  content: ValidationContent,
  checkProgram: CheckProgram,
): Promise<ValidationOutcome> {
  const hash = await gradableHash(content);
  const basics = {
    title: content.title,
    slug: content.slug,
    instructionsMd: content.instructionsMd,
    testCaseCount: content.testCases.length,
  };
  const unchecked = validateLesson(basics, undefined);
  if (unchecked[0]?.state !== "passed") {
    return { kind: "done", rules: unchecked, passed: false, hash, solution: undefined };
  }

  const programs = [
    content.solutionCode,
    content.starterCode,
    ...content.wrongAnswers.map((answer) => answer.code),
  ];
  const results: TestResult[][] = [];
  for (const source of programs) {
    const checked = await checkProgram(source, content.testCases);
    if (checked === undefined) return { kind: "unavailable" };
    if (wasStopped(checked)) return { kind: "stopped" };
    results.push(checked);
  }
  const [solution = [], starter = [], ...wrongAnswers] = results;
  const runs: ValidationRuns = { solution, starter, wrongAnswers };
  const rules = validateLesson(basics, runs);
  return { kind: "done", rules, passed: validationPassed(rules), hash, solution };
}
