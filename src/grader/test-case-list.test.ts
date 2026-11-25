import { describe, expect, it } from "vitest";
import { CHECK_TEST_LIMIT, type TestCase, type TestCaseId, TEST_CASE_LIMITS } from "./test-case.ts";
import {
  addTestCase,
  duplicateTestCase,
  gradableText,
  moveTestCase,
  removeTestCase,
  testCaseProblems,
} from "./test-case-list.ts";

const make = (id: string, name = `Case ${id}`): TestCase => ({
  id: id as TestCaseId,
  name,
  stdin: "",
  afterCode: "",
  expected: "ok",
  match: "normalized",
  hint: "",
});

const list = [make("a"), make("b"), make("c")];

describe("test case list", () => {
  it("[FR-ADM-05] adds an empty test case at the end with the ID it is given", () => {
    const result = addTestCase(list, "d");
    expect(result).toEqual({
      ok: true,
      value: [
        ...list,
        {
          id: "d",
          name: "",
          stdin: "",
          afterCode: "",
          expected: "",
          match: "normalized",
          hint: "",
        },
      ],
    });
  });

  it("[FR-ADM-05] duplicates a test case right after itself, with a new ID", () => {
    const result = duplicateTestCase(list, 0, "a2");
    expect(result).toEqual({
      ok: true,
      value: [list[0], { ...make("a"), id: "a2" }, list[1], list[2]],
    });
  });

  it("[FR-ADM-05] refuses an add or a duplicate past the limit of 12, by name", () => {
    const full = Array.from({ length: CHECK_TEST_LIMIT }, (_, index) => make(`t${index}`));
    expect(addTestCase(full, "x")).toEqual({ ok: false, error: "limit" });
    expect(duplicateTestCase(full, 0, "x")).toEqual({ ok: false, error: "limit" });
  });

  it("[FR-ADM-05] refuses a new ID that is malformed or already in the lesson", () => {
    expect(addTestCase(list, "b")).toEqual({ ok: false, error: "id_taken" });
    expect(addTestCase(list, "bad id")).toEqual({ ok: false, error: "invalid_id" });
    expect(duplicateTestCase(list, 1, "c")).toEqual({ ok: false, error: "id_taken" });
  });

  it("[FR-ADM-05] moves a test case up and down, and leaves the ends where they are", () => {
    expect(moveTestCase(list, 1, "up").map((testCase) => testCase.id)).toEqual(["b", "a", "c"]);
    expect(moveTestCase(list, 1, "down").map((testCase) => testCase.id)).toEqual(["a", "c", "b"]);
    expect(moveTestCase(list, 0, "up")).toEqual(list);
    expect(moveTestCase(list, 2, "down")).toEqual(list);
  });

  it("[FR-ADM-05] deletes one test case and keeps the order of the rest", () => {
    expect(removeTestCase(list, 1).map((testCase) => testCase.id)).toEqual(["a", "c"]);
  });

  it("[FR-ADM-05] leaves the list unchanged for an index outside it", () => {
    expect(duplicateTestCase(list, 3, "z")).toEqual({ ok: true, value: list });
    expect(moveTestCase(list, -1, "down")).toEqual(list);
    expect(removeTestCase(list, 5)).toEqual(list);
  });

  it("[FR-ADM-05] does not change the list it is given", () => {
    const before = structuredClone(list);
    addTestCase(list, "d");
    duplicateTestCase(list, 0, "e");
    moveTestCase(list, 0, "down");
    removeTestCase(list, 0);
    expect(list).toEqual(before);
  });
});

describe("testCaseProblems", () => {
  it("[FR-ADM-05] finds nothing wrong in a complete test case", () => {
    expect(testCaseProblems(make("a"))).toEqual([]);
  });

  it("[FR-ADM-05] names every field that is empty or over its limit, with the limit", () => {
    const problems = testCaseProblems({
      ...make("a", " "),
      stdin: "x".repeat(TEST_CASE_LIMITS.stdin + 1),
      afterCode: "x".repeat(TEST_CASE_LIMITS.afterCode + 1),
      expected: "x".repeat(TEST_CASE_LIMITS.expected + 1),
      hint: "x".repeat(TEST_CASE_LIMITS.hint + 1),
    });
    expect(problems).toEqual([
      { field: "name", code: "missing" },
      { field: "stdin", code: "too_long", limit: TEST_CASE_LIMITS.stdin },
      { field: "afterCode", code: "too_long", limit: TEST_CASE_LIMITS.afterCode },
      { field: "expected", code: "too_long", limit: TEST_CASE_LIMITS.expected },
      { field: "hint", code: "too_long", limit: TEST_CASE_LIMITS.hint },
    ]);
  });

  it("[FR-ADM-05] counts characters as a reader does, so an emoji is one", () => {
    const name = "😀".repeat(TEST_CASE_LIMITS.name);
    expect(testCaseProblems(make("a", name))).toEqual([]);
    expect(testCaseProblems(make("a", `${name}x`))).toEqual([
      { field: "name", code: "too_long", limit: TEST_CASE_LIMITS.name },
    ]);
  });

  it("[FR-ADM-05] accepts an empty expected output, which a program that prints nothing must match", () => {
    expect(testCaseProblems({ ...make("a"), expected: "" })).toEqual([]);
  });
});

describe("gradableText", () => {
  const content = {
    starterCode: "# start\n",
    solutionCode: "print(1)\n",
    wrongAnswers: [{ label: "prints two", code: "print(2)\n" }],
    testCases: list,
  };

  it("[FR-ADM-07] is the same for the same content", () => {
    expect(gradableText(content)).toBe(gradableText(structuredClone(content)));
  });

  it("[FR-ADM-07] changes with the starter, the solution, a wrong answer, or any test case field", () => {
    const base = gradableText(content);
    const changed = [
      { ...content, starterCode: "# start" },
      { ...content, solutionCode: "print(1) \n" },
      { ...content, wrongAnswers: [{ label: "prints two", code: "print(3)\n" }] },
      { ...content, wrongAnswers: [{ label: "prints 2", code: "print(2)\n" }] },
      { ...content, wrongAnswers: [] },
      { ...content, testCases: [list[1], list[0], list[2]] as TestCase[] },
      { ...content, testCases: [{ ...make("a"), stdin: "x" }, list[1], list[2]] as TestCase[] },
      { ...content, testCases: [{ ...make("a"), match: "exact" }, list[1], list[2]] as TestCase[] },
      { ...content, testCases: [{ ...make("a"), hint: "h" }, list[1], list[2]] as TestCase[] },
      {
        ...content,
        testCases: [{ ...make("a"), afterCode: "print(x)" }, list[1], list[2]] as TestCase[],
      },
    ];
    for (const other of changed) expect(gradableText(other)).not.toBe(base);
  });

  it("[FR-ADM-07] does not depend on the order of keys in a test case", () => {
    const [first, ...rest] = list;
    const reordered = { ...content, testCases: [{ hint: "", ...first } as TestCase, ...rest] };
    expect(gradableText(reordered)).toBe(gradableText(content));
  });

  it("[FR-ADM-07] cannot be made equal by moving text between fields", () => {
    const one = { ...content, starterCode: "a", solutionCode: "bc" };
    const two = { ...content, starterCode: "ab", solutionCode: "c" };
    expect(gradableText(one)).not.toBe(gradableText(two));
  });
});
