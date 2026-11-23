import { describe, expect, it, vi } from "vitest";
import type { TestResult } from "@/grader/grade";
import { HARNESS_VERSION } from "@/grader/harness";
import type { TestCase, TestCaseId } from "@/grader/test-case";
import type { ControllerEvent, RunRequest } from "@/runtime/controller";
import type { RunId } from "@/runtime/protocol";
import { createControllerChecks } from "./controller-checks";

const tests: TestCase[] = [
  {
    id: "t1" as TestCaseId,
    name: "Prints ok",
    stdin: "",
    afterCode: "",
    expected: "ok",
    match: "normalized",
    hint: "",
  },
];

const results: TestResult[] = [
  {
    testCaseId: "t1" as TestCaseId,
    status: "passed",
    actual: "ok",
    truncated: false,
    harnessVersion: HARNESS_VERSION,
  },
];

const summary = {
  total: 1,
  passed: 1,
  failed: 0,
  notRun: 0,
  allPassed: true,
  timeLimit: false,
};

function fakeController(answers: RunRequest[]) {
  return {
    check: vi.fn((_source: string, _tests: readonly TestCase[], _options?: unknown) => {
      const answer = answers.shift();
      if (answer === undefined) throw new Error("no answer left");
      return answer;
    }),
  };
}

const runId = (value: string) => value as RunId;
const done = (id: string): ControllerEvent => ({
  type: "check_done",
  runId: runId(id),
  results,
  summary,
});

describe("createControllerChecks [FR-ADM-06]", () => {
  it("checks on a fresh worker and resolves with the results of its own check", async () => {
    const controller = fakeController([{ ok: true, runId: runId("r1") }]);
    const checks = createControllerChecks(controller);
    const pending = checks.checkProgram("print('ok')", tests);
    expect(controller.check).toHaveBeenCalledWith("print('ok')", tests, { freshWorker: true });
    checks.handle(done("r0"));
    checks.handle(done("r1"));
    expect(await pending).toEqual(results);
  });

  it("waits for the runtime to be ready when it is loading or restarting, then checks", async () => {
    const controller = fakeController([
      { ok: false, error: "not_ready" },
      { ok: true, runId: runId("r2") },
    ]);
    const checks = createControllerChecks(controller);
    const pending = checks.checkProgram("print('ok')", tests);
    expect(controller.check).toHaveBeenCalledTimes(1);
    checks.handle({ type: "ready", runtimeVersion: "314.0.7", interactiveInput: true });
    expect(controller.check).toHaveBeenCalledTimes(2);
    checks.handle(done("r2"));
    expect(await pending).toEqual(results);
  });

  it("gives undefined when the runtime fails, when the check is refused as invalid, and when the editor closes", async () => {
    const failing = createControllerChecks(fakeController([{ ok: false, error: "not_ready" }]));
    const first = failing.checkProgram("x", tests);
    failing.handle({ type: "failed" });
    expect(await first).toBeUndefined();

    const invalid = createControllerChecks(fakeController([{ ok: false, error: "invalid" }]));
    expect(await invalid.checkProgram("x", tests)).toBeUndefined();

    const closing = createControllerChecks(fakeController([{ ok: true, runId: runId("r3") }]));
    const third = closing.checkProgram("x", tests);
    closing.dispose();
    expect(await third).toBeUndefined();
    expect(await closing.checkProgram("x", tests)).toBeUndefined();
  });

  it("ignores a ready event when nothing waits, and a check_done after it resolved", async () => {
    const controller = fakeController([{ ok: true, runId: runId("r4") }]);
    const checks = createControllerChecks(controller);
    checks.handle({ type: "ready", runtimeVersion: "314.0.7", interactiveInput: true });
    expect(controller.check).not.toHaveBeenCalled();
    const pending = checks.checkProgram("x", tests);
    checks.handle(done("r4"));
    checks.handle(done("r4"));
    expect(await pending).toEqual(results);
  });

  it("refuses a second check while one is in progress, so two programs never share a run", async () => {
    const checks = createControllerChecks(fakeController([{ ok: true, runId: runId("r5") }]));
    const first = checks.checkProgram("x", tests);
    expect(await checks.checkProgram("y", tests)).toBeUndefined();
    checks.handle(done("r5"));
    expect(await first).toEqual(results);
  });
});
