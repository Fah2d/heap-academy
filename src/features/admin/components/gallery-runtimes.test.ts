import { describe, expect, it } from "vitest";
import type { TestResult } from "@/grader/grade";
import { HARNESS_VERSION } from "@/grader/harness";
import type { TestCase, TestCaseId } from "@/grader/test-case";
import type { PythonState } from "../client/validation-runtime";
import { fixedResultsRuntime } from "./gallery-runtimes";

const testCase: TestCase = {
  id: "doubles" as TestCaseId,
  name: "Doubles",
  stdin: "3",
  afterCode: "",
  expected: "6",
  match: "normalized",
  hint: "",
};

const timedOut: TestResult = {
  testCaseId: testCase.id,
  status: "failed",
  reason: "time_limit",
  actual: "",
  truncated: false,
  harnessVersion: HARNESS_VERSION,
};

describe("fixedResultsRuntime", () => {
  it("[FR-ADM-06] is ready at once and gives each program the results made for it", async () => {
    const states: PythonState[] = [];
    const seen: string[] = [];
    const runtime = fixedResultsRuntime((source, tests) => {
      seen.push(source);
      return tests.map(() => timedOut);
    })((state) => states.push(state));

    const results = await runtime.checkProgram("while True: pass", [testCase]);

    expect(states).toEqual(["ready"]);
    expect(seen).toEqual(["while True: pass"]);
    expect(results).toEqual([timedOut]);
  });

  it("[FR-ADM-06] gives no results when the gallery stands for Python that could not run the programs", async () => {
    const runtime = fixedResultsRuntime(() => undefined)(() => undefined);
    expect(await runtime.checkProgram("print(1)", [testCase])).toBeUndefined();
  });
});
