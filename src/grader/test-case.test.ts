import { describe, expect, it } from "vitest";
import {
  CHECK_TEST_LIMIT,
  characterCount,
  parseTestCase,
  parseTestCases,
  TEST_CASE_LIMITS,
} from "./test-case.ts";

const valid = {
  id: "greets-sara",
  name: "Greets Sara by name",
  stdin: "Sara\n",
  afterCode: "",
  expected: "What is your name? Hello, Sara!",
  match: "normalized",
  hint: "Use the name you read.",
};

describe("parseTestCase", () => {
  it("[FR-GRD-01] accepts every field of the model", () => {
    expect(parseTestCase(valid)).toEqual({ ok: true, value: valid });
  });

  it("[FR-GRD-01] gives an absent input, follow-up code and hint as empty, and the match mode as normalized", () => {
    const { id, name, expected } = valid;
    expect(parseTestCase({ id, name, expected })).toEqual({
      ok: true,
      value: { id, name, expected, stdin: "", afterCode: "", hint: "", match: "normalized" },
    });
  });

  it("[FR-GRD-03] accepts each comparison mode and refuses any other", () => {
    for (const match of ["normalized", "exact", "contains"]) {
      expect(parseTestCase({ ...valid, match }).ok).toBe(true);
    }
    expect(parseTestCase({ ...valid, match: "regex" })).toEqual({
      ok: false,
      error: { code: "invalid_field", field: "match" },
    });
  });

  it.each([
    ["name", TEST_CASE_LIMITS.name],
    ["stdin", TEST_CASE_LIMITS.stdin],
    ["afterCode", TEST_CASE_LIMITS.afterCode],
    ["expected", TEST_CASE_LIMITS.expected],
    ["hint", TEST_CASE_LIMITS.hint],
  ] as const)(
    "[FR-GRD-01] accepts %s at its limit of %i characters and refuses one more",
    (field, limit) => {
      // A character outside the basic plane counts once, as a reader counts it.
      expect(parseTestCase({ ...valid, [field]: "😀".repeat(limit) }).ok).toBe(true);
      expect(parseTestCase({ ...valid, [field]: "a".repeat(limit + 1) })).toEqual({
        ok: false,
        error: { code: "too_long", field },
      });
    },
  );

  it.each([
    ["null", null],
    ["an array", [valid]],
    ["a string", "test"],
    ["a class instance", new Map()],
  ])("[FR-GRD-01] refuses %s", (_label, value) => {
    expect(parseTestCase(value)).toEqual({
      ok: false,
      error: { code: "not_an_object", field: "testCase" },
    });
  });

  it("[FR-GRD-01] refuses an unknown field", () => {
    expect(parseTestCase({ ...valid, solution: "print(1)" })).toEqual({
      ok: false,
      error: { code: "unknown_field", field: "testCase" },
    });
  });

  it.each(["id", "name", "expected"] as const)(
    "[FR-GRD-01] refuses a test case without %s",
    (field) => {
      const { [field]: _removed, ...rest } = valid;
      expect(parseTestCase(rest)).toEqual({ ok: false, error: { code: "missing_field", field } });
    },
  );

  it.each(["id", "name", "stdin", "afterCode", "expected", "hint"] as const)(
    "[FR-GRD-01] refuses null or a number in %s",
    (field) => {
      for (const bad of [null, 3]) {
        expect(parseTestCase({ ...valid, [field]: bad })).toEqual({
          ok: false,
          error: { code: "invalid_field", field },
        });
      }
    },
  );

  it("[FR-GRD-01] refuses a blank name and an ID that is not a short slug", () => {
    expect(parseTestCase({ ...valid, name: "   " }).ok).toBe(false);
    for (const id of ["", "has space", "-leading", "a".repeat(65), "ünï"]) {
      expect(parseTestCase({ ...valid, id })).toEqual({
        ok: false,
        error: { code: "invalid_field", field: "id" },
      });
    }
  });
});

describe("parseTestCases", () => {
  const many = (count: number) =>
    Array.from({ length: count }, (_, index) => ({ ...valid, id: `case-${String(index)}` }));

  it("[FR-GRD-01] accepts 1 to the limit of test cases", () => {
    // Twelve, from docs/spec/04-content-system.md section 1.3.
    expect(CHECK_TEST_LIMIT).toBe(12);
    expect(parseTestCases(many(1)).ok).toBe(true);
    expect(parseTestCases(many(12)).ok).toBe(true);
    expect(parseTestCases(many(13)).ok).toBe(false);
  });

  it("[FR-GRD-01] refuses none, too many, or something that is not a list", () => {
    for (const value of [[], many(CHECK_TEST_LIMIT + 1), valid, null]) {
      expect(parseTestCases(value)).toEqual({
        ok: false,
        error: { code: "invalid_field", field: "testCase", index: undefined },
      });
    }
  });

  it("[FR-GRD-01] names the test case and field that was refused", () => {
    const cases = many(3);
    cases[2] = { ...valid, id: "case-2", expected: "x".repeat(TEST_CASE_LIMITS.expected + 1) };
    expect(parseTestCases(cases)).toEqual({
      ok: false,
      error: { code: "too_long", field: "expected", index: 2 },
    });
  });

  it("[FR-GRD-01] refuses two test cases with one ID", () => {
    expect(parseTestCases([valid, valid])).toEqual({
      ok: false,
      error: { code: "invalid_field", field: "id", index: 1 },
    });
  });
});

describe("characterCount", () => {
  it("[FR-GRD-01] counts a character outside the basic plane once", () => {
    expect(characterCount("a😀é")).toBe(3);
  });
});
