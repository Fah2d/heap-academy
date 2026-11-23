import { grade } from "@/grader/grade";
import { HARNESS_VERSION } from "@/grader/harness";
import type { TestCase, TestCaseId } from "@/grader/test-case";
import type { CheckProgram } from "../client/validate-lesson";
import type { OpenValidationRuntime, PythonState } from "../client/validation-runtime";

// Development only: the Python of the admin gallery's lesson editors
// (src/app/dev/admin/page.dev.tsx). Twelve editors on one page would start
// twelve workers, and the states "Python loading", "validating" and
// "validation failed" need a Python that stays in them. The verdicts come
// from the grader's own `grade`, on output the gallery fixes per test case.

const noop = () => undefined;

/**
 * Python that is ready at once. The solution prints `solutionPrints` for each
 * test case; every other program prints `otherPrints`.
 */
export function scriptedRuntime(
  solutionCode: string,
  solutionPrints: ReadonlyMap<TestCaseId, string>,
  otherPrints: string,
): OpenValidationRuntime {
  const checkProgram: CheckProgram = (source, tests) =>
    Promise.resolve(
      tests.map((testCase: TestCase) =>
        grade(testCase, {
          version: HARNESS_VERSION,
          stage: "program",
          output: source === solutionCode ? (solutionPrints.get(testCase.id) ?? "") : otherPrints,
          truncated: false,
          error: undefined,
        }),
      ),
    );
  return (onState) => {
    onState("ready");
    return { checkProgram, stop: noop, retry: noop, dispose: noop };
  };
}

/**
 * Python that stays in `state`, and a check that never ends until Stop, as a
 * real one waits for a Python that is still loading.
 */
export function stuckRuntime(state: PythonState): OpenValidationRuntime {
  return (onState) => {
    let release: () => void = noop;
    onState(state);
    return {
      checkProgram: () =>
        new Promise((resolve) => {
          release = () => resolve(undefined);
        }),
      stop: () => release(),
      retry: noop,
      dispose: () => release(),
    };
  };
}
