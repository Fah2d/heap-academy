// The parity suite (FR-GRD-04): lessons, programs, and the verdict each test
// case must get. The Node runner's test and the browser test
// (e2e/grader-parity.spec.ts) run these same cases, so a verdict that differs
// between Pyodide under Node and a browser engine fails one of them.

import { EXAMPLE_LESSON } from "./example-lesson.ts";
import type { FailureReason, TestResult } from "./grade.ts";
import type { MatchMode, TestCase, TestCaseId } from "./test-case.ts";

export type ExpectedVerdict =
  { status: "passed" } | { status: "failed"; reason: FailureReason } | { status: "not_run" };

export type ParityCase = {
  name: string;
  source: string;
  testCases: readonly TestCase[];
  expected: readonly ExpectedVerdict[];
};

const passed: ExpectedVerdict = { status: "passed" };
const failed = (reason: FailureReason): ExpectedVerdict => ({ status: "failed", reason });

function testCase(
  id: string,
  fields: { stdin?: string; afterCode?: string; expected: string; match?: MatchMode },
): TestCase {
  return {
    id: id as TestCaseId,
    name: id,
    stdin: fields.stdin ?? "",
    afterCode: fields.afterCode ?? "",
    expected: fields.expected,
    match: fields.match ?? "normalized",
    hint: "",
  };
}

const areaCases = [
  testCase("area-3-4", { afterCode: "print(area(3, 4))", expected: "12" }),
  testCase("area-5-5", { afterCode: "print(area(5, 5))", expected: "25" }),
];

export const PARITY_CASES: readonly ParityCase[] = [
  {
    name: "section 7: the solution passes both",
    source: EXAMPLE_LESSON.solution,
    testCases: EXAMPLE_LESSON.testCases,
    expected: [passed, passed],
  },
  {
    name: "section 7: the starter fails both",
    source: EXAMPLE_LESSON.starter,
    testCases: EXAMPLE_LESSON.testCases,
    expected: [failed("mismatch"), failed("mismatch")],
  },
  {
    name: "section 7: the wrong answer passes the first and fails the second",
    source: EXAMPLE_LESSON.wrongAnswer.code,
    testCases: EXAMPLE_LESSON.testCases,
    expected: [passed, failed("mismatch")],
  },
  {
    name: "a variable checked by follow-up code",
    source: "age = 12\n",
    testCases: [
      testCase("age-is-int", { afterCode: "print(type(age).__name__)", expected: "int" }),
    ],
    expected: [passed],
  },
  {
    name: "a function checked by follow-up code",
    source: "def area(width, height):\n    return width * height\n",
    testCases: areaCases,
    expected: [passed, passed],
  },
  {
    name: "follow-up code needs a name the program did not define",
    source: "def size(width, height):\n    return width * height\n",
    testCases: areaCases,
    expected: [failed("after_code_error"), failed("after_code_error")],
  },
  {
    name: "a learner error fails every test case",
    source: "print(1 / 0)\n",
    testCases: areaCases,
    expected: [failed("program_error"), failed("program_error")],
  },
  {
    name: "a syntax error fails every test case",
    source: "def area(width, height)\n    return width * height\n",
    testCases: areaCases,
    expected: [failed("program_error"), failed("program_error")],
  },
  {
    name: "reading past the input fails",
    source: "first = input()\nsecond = input()\nprint(first, second)\n",
    testCases: [testCase("two-answers", { stdin: "a\n", expected: "a b" })],
    expected: [failed("program_error")],
  },
  {
    name: "the comparison modes",
    source: 'print("Total: 12  ")\nprint()\n',
    testCases: [
      testCase("normalized", { expected: "Total: 12" }),
      testCase("exact", { expected: "Total: 12", match: "exact" }),
      testCase("contains", { expected: "12", match: "contains" }),
      testCase("case-matters", { expected: "total: 12" }),
    ],
    expected: [passed, failed("mismatch"), passed, failed("mismatch")],
  },
  {
    name: "deleting builtins in one test case does not affect the next",
    source:
      'import builtins\nif input() == "break":\n    del builtins.print\n    del builtins.len\nelse:\n    print(len("abc"))\n',
    testCases: [
      testCase("breaks", { stdin: "break\n", expected: "" }),
      testCase("still-works", { stdin: "fine\n", expected: "3" }),
    ],
    expected: [passed, passed],
  },
  {
    name: "a flood stops at the output limit",
    source: 'while True:\n    print("flood")\n',
    testCases: [testCase("flood", { expected: "flood" })],
    expected: [failed("output_limit")],
  },
  {
    name: "a runaway program reaches the time limit and the rest are not run",
    source: 'if input() == "loop":\n    while True:\n        pass\nprint("done")\n',
    testCases: [
      testCase("finishes", { stdin: "go\n", expected: "done" }),
      testCase("loops", { stdin: "loop\n", expected: "done" }),
      testCase("after-the-loop", { stdin: "go\n", expected: "done" }),
    ],
    expected: [passed, failed("time_limit"), { status: "not_run" }],
  },
];

/** The verdict part of a result, for comparison with the expected verdict. */
export function verdictOf(result: TestResult): ExpectedVerdict {
  switch (result.status) {
    case "passed":
      return passed;
    case "failed":
      return failed(result.reason);
    case "not_run":
      return { status: "not_run" };
    default: {
      const unreachable: never = result;
      return unreachable;
    }
  }
}
