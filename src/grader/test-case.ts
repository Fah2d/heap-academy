// The one test case model (FR-GRD-01; docs/spec/04-content-system.md
// section 2.1) and its limits. The parser imports nothing, because the Python
// worker is compiled without a bundler and cannot load a schema library
// (ADR-0033); the worker, the page, the dashboard and the Node runner all
// parse test cases with this one function. A refusal names the field, never
// the value, so the dashboard can say which field to fix.

export type TestCaseId = string & { readonly __brand: "TestCaseId" };

export const MATCH_MODES = ["normalized", "exact", "contains"] as const;
export type MatchMode = (typeof MATCH_MODES)[number];

export type TestCase = {
  id: TestCaseId;
  /** What the learner reads, written as a requirement. */
  name: string;
  /** The program's input, one answer per line. */
  stdin: string;
  /** Python run after the program, in its namespace. Empty when there is none. */
  afterCode: string;
  expected: string;
  match: MatchMode;
  /** Shown when this test case fails. Empty when there is none. */
  hint: string;
};

/** Limits in characters, as a reader counts them (section 2.1). */
export const TEST_CASE_LIMITS = {
  name: 80,
  stdin: 2_000,
  afterCode: 2_000,
  expected: 5_000,
  hint: 200,
} as const;

/** A lesson has 1 to 12 test cases (section 1.3), so a check carries at most 12. */
export const CHECK_TEST_LIMIT = 12;

/** Each test case is its own run, with a run's time limit (section 2.2; FR-RUN-02). */
export const TEST_CASE_TIME_LIMIT_MS = 5_000;

const TEST_CASE_ID = /^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/;

export type TestCaseField =
  "testCase" | "id" | "name" | "stdin" | "afterCode" | "expected" | "match" | "hint";

export type TestCaseError = {
  code: "not_an_object" | "unknown_field" | "missing_field" | "invalid_field" | "too_long";
  field: TestCaseField;
};

export type TestCaseResult = { ok: true; value: TestCase } | { ok: false; error: TestCaseError };

const FIELDS: readonly string[] = ["id", "name", "stdin", "afterCode", "expected", "match", "hint"];

/** Characters as a reader counts them: a character outside the basic plane is one. */
export function characterCount(text: string): number {
  let count = 0;
  for (const _character of text) count += 1;
  return count;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  const prototype: unknown = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

/** Parses one test case. `stdin`, `afterCode` and `hint` may be absent (empty); `match` defaults to `normalized`. */
export function parseTestCase(value: unknown): TestCaseResult {
  if (!isPlainObject(value))
    return { ok: false, error: { code: "not_an_object", field: "testCase" } };
  for (const key of Object.keys(value)) {
    if (!FIELDS.includes(key))
      return { ok: false, error: { code: "unknown_field", field: "testCase" } };
  }

  type TextField = Exclude<TestCaseField, "testCase" | "match">;
  const read = (field: TextField, required: boolean, limit: number | undefined) => {
    const raw = Object.hasOwn(value, field) ? value[field] : undefined;
    if (raw === undefined) {
      return required
        ? ({ ok: false, error: { code: "missing_field", field } } as const)
        : ({ ok: true, text: "" } as const);
    }
    if (typeof raw !== "string")
      return { ok: false, error: { code: "invalid_field", field } } as const;
    if (limit !== undefined && characterCount(raw) > limit) {
      return { ok: false, error: { code: "too_long", field } } as const;
    }
    return { ok: true, text: raw } as const;
  };

  const id = read("id", true, undefined);
  if (!id.ok) return id;
  if (!TEST_CASE_ID.test(id.text))
    return { ok: false, error: { code: "invalid_field", field: "id" } };
  const name = read("name", true, TEST_CASE_LIMITS.name);
  if (!name.ok) return name;
  if (name.text.trim() === "")
    return { ok: false, error: { code: "invalid_field", field: "name" } };
  const stdin = read("stdin", false, TEST_CASE_LIMITS.stdin);
  if (!stdin.ok) return stdin;
  const afterCode = read("afterCode", false, TEST_CASE_LIMITS.afterCode);
  if (!afterCode.ok) return afterCode;
  const expected = read("expected", true, TEST_CASE_LIMITS.expected);
  if (!expected.ok) return expected;
  const hint = read("hint", false, TEST_CASE_LIMITS.hint);
  if (!hint.ok) return hint;

  const rawMatch = Object.hasOwn(value, "match") ? value["match"] : undefined;
  const match =
    rawMatch === undefined ? "normalized" : MATCH_MODES.find((mode) => mode === rawMatch);
  if (match === undefined) return { ok: false, error: { code: "invalid_field", field: "match" } };

  return {
    ok: true,
    value: {
      id: id.text as TestCaseId,
      name: name.text,
      stdin: stdin.text,
      afterCode: afterCode.text,
      expected: expected.text,
      match,
      hint: hint.text,
    },
  };
}

export type TestCaseListResult =
  | { ok: true; value: TestCase[] }
  | { ok: false; error: TestCaseError & { index: number | undefined } };

/** Parses the test cases of one check: 1 to CHECK_TEST_LIMIT, with distinct IDs. */
export function parseTestCases(value: unknown): TestCaseListResult {
  if (!Array.isArray(value) || value.length === 0 || value.length > CHECK_TEST_LIMIT) {
    return { ok: false, error: { code: "invalid_field", field: "testCase", index: undefined } };
  }
  const cases: TestCase[] = [];
  const seen = new Set<string>();
  for (const [index, item] of value.entries()) {
    const parsed = parseTestCase(item);
    if (!parsed.ok) return { ok: false, error: { ...parsed.error, index } };
    if (seen.has(parsed.value.id)) {
      return { ok: false, error: { code: "invalid_field", field: "id", index } };
    }
    seen.add(parsed.value.id);
    cases.push(parsed.value);
  }
  return { ok: true, value: cases };
}
