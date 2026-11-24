// The test case list of the lesson editor (docs/spec/03-experience.md
// section 7.5; FR-ADM-05) and the text of a lesson's gradable content, which
// the dashboard and the save action both hash (docs/spec/04-content-system.md
// section 4.2; FR-ADM-07). Every operation returns a new list.
//
// This module imports only grader modules, like the rest of the grader.

import {
  CHECK_TEST_LIMIT,
  characterCount,
  TEST_CASE_ID,
  TEST_CASE_LIMITS,
  type TestCase,
  type TestCaseId,
} from "./test-case.ts";

export type ListChange =
  | { ok: true; value: TestCase[] }
  /** `limit`: the lesson already has 12. `id_taken`, `invalid_id`: the caller's new ID cannot be used. */
  | { ok: false; error: "limit" | "id_taken" | "invalid_id" };

function checkNewId(list: readonly TestCase[], id: string): ListChange | undefined {
  if (list.length >= CHECK_TEST_LIMIT) return { ok: false, error: "limit" };
  if (!TEST_CASE_ID.test(id)) return { ok: false, error: "invalid_id" };
  if (list.some((testCase) => testCase.id === id)) return { ok: false, error: "id_taken" };
  return undefined;
}

/** An empty test case at the end. The ID comes from the caller, so this stays free of randomness. */
export function addTestCase(list: readonly TestCase[], id: string): ListChange {
  const refused = checkNewId(list, id);
  if (refused !== undefined) return refused;
  return {
    ok: true,
    value: [
      ...list,
      {
        id: id as TestCaseId,
        name: "",
        stdin: "",
        afterCode: "",
        expected: "",
        match: "normalized",
        hint: "",
      },
    ],
  };
}

/** A copy right after the original, under a new ID. */
export function duplicateTestCase(
  list: readonly TestCase[],
  index: number,
  id: string,
): ListChange {
  const original = list[index];
  if (original === undefined) return { ok: true, value: [...list] };
  const refused = checkNewId(list, id);
  if (refused !== undefined) return refused;
  return {
    ok: true,
    value: [
      ...list.slice(0, index + 1),
      { ...original, id: id as TestCaseId },
      ...list.slice(index + 1),
    ],
  };
}

/** Moves one place; the first cannot go up and the last cannot go down. */
export function moveTestCase(
  list: readonly TestCase[],
  index: number,
  direction: "up" | "down",
): TestCase[] {
  const target = direction === "up" ? index - 1 : index + 1;
  const moving = list[index];
  const other = list[target];
  if (moving === undefined || other === undefined) return [...list];
  const next = [...list];
  next[target] = moving;
  next[index] = other;
  return next;
}

export function removeTestCase(list: readonly TestCase[], index: number): TestCase[] {
  return list.filter((_, position) => position !== index);
}

type TextField = "name" | "stdin" | "afterCode" | "expected" | "hint";

export type TestCaseProblem =
  { field: "name"; code: "missing" } | { field: TextField; code: "too_long"; limit: number };

/**
 * Every field the owner must fix, in the editor's order, so each gets its own
 * message. The expected output may be empty: a program that should print
 * nothing is checked that way.
 */
export function testCaseProblems(testCase: TestCase): TestCaseProblem[] {
  const problems: TestCaseProblem[] = [];
  const fields: readonly TextField[] = ["name", "stdin", "afterCode", "expected", "hint"];
  for (const field of fields) {
    if (field === "name" && testCase.name.trim() === "") {
      problems.push({ field, code: "missing" });
      continue;
    }
    const limit = TEST_CASE_LIMITS[field];
    if (characterCount(testCase[field]) > limit) problems.push({ field, code: "too_long", limit });
  }
  return problems;
}

export type GradableContent = {
  starterCode: string;
  solutionCode: string;
  wrongAnswers: readonly { label: string; code: string }[];
  testCases: readonly TestCase[];
};

/**
 * One text for the starter, the solution, the wrong answers and the test
 * cases, with a fixed shape, so equal content gives equal text whatever the
 * order of keys, and no text can move from one field to another unseen.
 */
export function gradableText(content: GradableContent): string {
  return JSON.stringify([
    content.starterCode,
    content.solutionCode,
    content.wrongAnswers.map((answer) => [answer.label, answer.code]),
    content.testCases.map((testCase) => [
      testCase.id,
      testCase.name,
      testCase.stdin,
      testCase.afterCode,
      testCase.expected,
      testCase.match,
      testCase.hint,
    ]),
  ]);
}
