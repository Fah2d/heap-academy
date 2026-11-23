// From what the harness reports for one test case to its verdict
// (docs/spec/04-content-system.md section 2.2), and the summary of a check.
// The worker and the Node runner both decide verdicts here (FR-GRD-04).
//
// This module imports only grader modules, so the worker, compiled without a
// bundler (ADR-0033), can import it.

import { matches } from "./compare.ts";
import {
  HARNESS_MESSAGE_LIMIT,
  HARNESS_NAME_LIMIT,
  HARNESS_OUTPUT_LIMIT,
  HARNESS_VERSION,
} from "./harness.ts";
import type { TestCase, TestCaseId } from "./test-case.ts";

/** The errors learner code can end with inside the harness. */
export const GRADED_ERROR_KINDS = ["syntax", "runtime", "input_ended", "memory"] as const;
export type GradedErrorKind = (typeof GRADED_ERROR_KINDS)[number];

export type GradedError = {
  kind: GradedErrorKind;
  message: string;
  /** A line of the learner's program. */
  line?: number;
  /** For follow-up code that names something the program did not define. */
  missingName?: string;
};

/** What the harness returns for one test case. */
export type HarnessResult = {
  version: string;
  stage: "program" | "after_code";
  output: string;
  truncated: boolean;
  error: (GradedError | { kind: "output_limit" }) | undefined;
};

/**
 * Why a test case failed. `time_limit`, `stopped` and `crashed` are decided
 * by whoever owns the clock and the worker: the page, or the Node runner.
 */
export const FAILURE_REASONS = [
  "mismatch",
  "program_error",
  "after_code_error",
  "output_limit",
  "time_limit",
  "stopped",
  "crashed",
] as const;
export type FailureReason = (typeof FAILURE_REASONS)[number];

export type TestResult =
  | {
      testCaseId: TestCaseId;
      status: "passed";
      actual: string;
      truncated: false;
      harnessVersion: string;
    }
  | {
      testCaseId: TestCaseId;
      status: "failed";
      reason: FailureReason;
      actual: string;
      truncated: boolean;
      error?: GradedError;
      harnessVersion: string;
    }
  | {
      /** A test case after one that reached the time limit or crashed the worker is not run. */
      testCaseId: TestCaseId;
      status: "not_run";
      harnessVersion: string;
    };

export type CheckSummary = {
  total: number;
  passed: number;
  failed: number;
  notRun: number;
  /** Every test case ran and passed. */
  allPassed: boolean;
  /** Some test case reached the time limit (validation rule 5, section 4.1). */
  timeLimit: boolean;
};

const STAGES = ["program", "after_code"] as const;

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  const prototype: unknown = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function hasOnly(value: Record<string, unknown>, keys: readonly string[]): boolean {
  return Object.keys(value).every((key) => keys.includes(key));
}

function isLine(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 1;
}

/** Text no longer than `limit` characters, counting a character outside the basic plane once. */
function isTextWithin(value: unknown, limit: number): value is string {
  // Two UTF-16 units per character at most; the exact count only when it could matter.
  if (typeof value !== "string") return false;
  if (value.length <= limit) return true;
  if (value.length > limit * 2) return false;
  let count = 0;
  for (const _character of value) {
    count += 1;
    if (count > limit) return false;
  }
  return true;
}

function parseGradedError(value: unknown, allowMissingName: boolean): GradedError | undefined {
  if (!isPlainObject(value) || !hasOnly(value, ["kind", "message", "line", "missingName"])) {
    return undefined;
  }
  const kind = GRADED_ERROR_KINDS.find((option) => option === value["kind"]);
  const { message, line, missingName } = value;
  if (kind === undefined || !isTextWithin(message, HARNESS_MESSAGE_LIMIT)) return undefined;
  const error: GradedError = { kind, message };
  if (line !== undefined) {
    if (!isLine(line)) return undefined;
    error.line = line;
  }
  if (missingName !== undefined) {
    if (!allowMissingName || !isTextWithin(missingName, HARNESS_NAME_LIMIT) || missingName === "")
      return undefined;
    error.missingName = missingName;
  }
  return error;
}

/**
 * Parses the JSON text the harness returns. Anything else means the runtime
 * is broken: the caller treats it as a crash, never as the program's fault.
 */
export function parseHarnessResult(text: unknown): HarnessResult | undefined {
  if (typeof text !== "string") return undefined;
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    return undefined;
  }
  if (
    !isPlainObject(value) ||
    !hasOnly(value, ["version", "stage", "output", "truncated", "error"])
  ) {
    return undefined;
  }
  const stage = STAGES.find((option) => option === value["stage"]);
  const { version, output, truncated, error } = value;
  if (
    typeof version !== "string" ||
    stage === undefined ||
    !isTextWithin(output, HARNESS_OUTPUT_LIMIT) ||
    typeof truncated !== "boolean"
  ) {
    return undefined;
  }
  if (error === null) return { version, stage, output, truncated, error: undefined };
  if (!isPlainObject(error) || !hasOnly(error, ["kind", "message", "line", "name"]))
    return undefined;
  if (error["kind"] === "output_limit") {
    return { version, stage, output, truncated, error: { kind: "output_limit" } };
  }
  const { kind, message, line, name } = error;
  const graded = parseGradedError(
    {
      kind,
      message,
      ...(line !== null && { line }),
      ...(name !== null && { missingName: name }),
    },
    // Only follow-up code can need a name, as on the page (parseTestResult).
    stage === "after_code",
  );
  if (graded === undefined) return undefined;
  return { version, stage, output, truncated, error: graded };
}

/** The verdict for one test case from what the harness reported (section 2.2). */
export function grade(testCase: TestCase, result: HarnessResult): TestResult {
  const base = {
    testCaseId: testCase.id,
    actual: result.output,
    truncated: result.truncated,
    harnessVersion: result.version,
  };
  const { error } = result;
  if (error !== undefined) {
    if (error.kind === "output_limit") return { ...base, status: "failed", reason: "output_limit" };
    const reason = result.stage === "after_code" ? "after_code_error" : "program_error";
    return { ...base, status: "failed", reason, error };
  }
  // Output cut with no error: the program wrote around the capture or caught
  // the limit's exception. It is still the output limit, as for a run.
  if (result.truncated) return { ...base, status: "failed", reason: "output_limit" };
  if (matches(result.output, testCase.expected, testCase.match)) {
    return { ...base, status: "passed", truncated: false };
  }
  return { ...base, status: "failed", reason: "mismatch" };
}

/**
 * The result for the test case that was running when the clock ran out, the
 * learner pressed Stop, or the worker died, and `not_run` for each one after it.
 */
export function unfinished(
  testCases: readonly TestCase[],
  reason: "time_limit" | "stopped" | "crashed",
): TestResult[] {
  return testCases.map((testCase, index) =>
    index === 0
      ? {
          testCaseId: testCase.id,
          status: "failed",
          reason,
          actual: "",
          truncated: false,
          harnessVersion: HARNESS_VERSION,
        }
      : { testCaseId: testCase.id, status: "not_run", harnessVersion: HARNESS_VERSION },
  );
}

export function summarize(results: readonly TestResult[]): CheckSummary {
  const count = (status: TestResult["status"]) =>
    results.filter((result) => result.status === status).length;
  const passed = count("passed");
  return {
    total: results.length,
    passed,
    failed: count("failed"),
    notRun: count("not_run"),
    allPassed: results.length > 0 && passed === results.length,
    timeLimit: results.some(
      (result) => result.status === "failed" && result.reason === "time_limit",
    ),
  };
}

/** Parses a test result that crossed from the worker to the page. */
export function parseTestResult(value: unknown): TestResult | undefined {
  if (!isPlainObject(value)) return undefined;
  const { testCaseId, status, harnessVersion } = value;
  if (
    typeof testCaseId !== "string" ||
    !/^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/.test(testCaseId) ||
    typeof harnessVersion !== "string" ||
    harnessVersion.length > 16
  ) {
    return undefined;
  }
  const id = testCaseId as TestCaseId;
  if (status === "not_run") {
    if (!hasOnly(value, ["testCaseId", "status", "harnessVersion"])) return undefined;
    return { testCaseId: id, status, harnessVersion };
  }
  const { actual, truncated } = value;
  if (!isTextWithin(actual, HARNESS_OUTPUT_LIMIT) || typeof truncated !== "boolean")
    return undefined;
  if (status === "passed") {
    if (!hasOnly(value, ["testCaseId", "status", "actual", "truncated", "harnessVersion"])) {
      return undefined;
    }
    if (truncated) return undefined;
    return { testCaseId: id, status, actual, truncated, harnessVersion };
  }
  if (status !== "failed") return undefined;
  if (
    !hasOnly(value, [
      "testCaseId",
      "status",
      "reason",
      "actual",
      "truncated",
      "error",
      "harnessVersion",
    ])
  ) {
    return undefined;
  }
  const reason = FAILURE_REASONS.find((option) => option === value["reason"]);
  if (reason === undefined) return undefined;
  const result: TestResult = { testCaseId: id, status, reason, actual, truncated, harnessVersion };
  if (!Object.hasOwn(value, "error") || value["error"] === undefined) {
    return reason === "program_error" || reason === "after_code_error" ? undefined : result;
  }
  if (reason !== "program_error" && reason !== "after_code_error") return undefined;
  const error = parseGradedError(value["error"], reason === "after_code_error");
  if (error === undefined) return undefined;
  return { ...result, error };
}

/** Parses a check summary that crossed from the worker to the page. */
export function parseCheckSummary(value: unknown): CheckSummary | undefined {
  if (!isPlainObject(value)) return undefined;
  if (!hasOnly(value, ["total", "passed", "failed", "notRun", "allPassed", "timeLimit"]))
    return undefined;
  const { total, passed, failed, notRun, allPassed, timeLimit } = value;
  const counts = [total, passed, failed, notRun];
  if (
    !counts.every((item) => typeof item === "number" && Number.isSafeInteger(item) && item >= 0)
  ) {
    return undefined;
  }
  if (typeof allPassed !== "boolean" || typeof timeLimit !== "boolean") return undefined;
  const summary = { total, passed, failed, notRun, allPassed, timeLimit } as CheckSummary;
  if (summary.passed + summary.failed + summary.notRun !== summary.total) return undefined;
  if (summary.allPassed !== (summary.total > 0 && summary.passed === summary.total))
    return undefined;
  return summary;
}
