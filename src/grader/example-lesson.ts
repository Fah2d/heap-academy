// The complete example lesson of docs/spec/04-content-system.md section 7,
// with the verdicts the section states. The Node runner's tests and the
// browser parity suite both run it (WP-3.3 "Done when").

import type { TestCase, TestCaseId } from "./test-case.ts";

const EXAMPLE_TEST_CASES: readonly TestCase[] = [
  {
    id: "greets-sara" as TestCaseId,
    name: "Greets Sara by name",
    stdin: "Sara\n",
    afterCode: "",
    expected: "What is your name? Hello, Sara!",
    match: "normalized",
    hint: "",
  },
  {
    id: "works-for-omar" as TestCaseId,
    name: "Works for a different name",
    stdin: "Omar\n",
    afterCode: "",
    expected: "What is your name? Hello, Omar!",
    match: "normalized",
    hint: "",
  },
];

export const EXAMPLE_LESSON = {
  title: "Say hello by name",
  instructions:
    '## Ask, then answer\n\n`input()` waits for the person to type something, and gives you what they typed.\n\n```python\nname = input("What is your name? ")\nprint("Hello, " + name + "!")\n```\n\n## Your task\n\nAsk for a name. Then print a greeting that uses it.\n',
  hints: ["`input()` gives you what the person typed. Keep it in a variable."],
  starter: "# Ask for a name, then greet that person.\n",
  solution: 'name = input("What is your name? ")\nprint("Hello, " + name + "!")\n',
  wrongAnswer: {
    label: "prints a fixed name",
    code: 'input("What is your name? ")\nprint("Hello, Sara!")\n',
  },
  testCases: EXAMPLE_TEST_CASES,
  /** Section 7: the statuses each program must get, test case by test case. */
  verdicts: {
    solution: ["passed", "passed"],
    starter: ["failed", "failed"],
    wrongAnswer: ["passed", "failed"],
  },
} as const;
