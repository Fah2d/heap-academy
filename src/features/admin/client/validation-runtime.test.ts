import { describe, expect, it, vi } from "vitest";
import type { TestCase } from "@/grader/test-case";
import type { ControllerEvent, RunRequest } from "@/runtime/controller";
import type { RunId } from "@/runtime/protocol";
import { connectValidationRuntime, type PythonState } from "./validation-runtime";

function fakeController() {
  let emit: (event: ControllerEvent) => void = () => undefined;
  const controller = {
    start: vi.fn(),
    stop: vi.fn(),
    dispose: vi.fn(),
    check: vi.fn(
      (_source: string, _tests: readonly TestCase[], _options?: unknown): RunRequest => ({
        ok: true,
        runId: "r1" as RunId,
      }),
    ),
  };
  const create = (onEvent: (event: ControllerEvent) => void) => {
    emit = onEvent;
    return controller;
  };
  return { controller, create, emit: (event: ControllerEvent) => emit(event) };
}

const ready: ControllerEvent = { type: "ready", runtimeVersion: "314.0.7", interactiveInput: true };

describe("connectValidationRuntime [FR-ADM-06]", () => {
  it("starts Python at once and says loading, then ready", () => {
    const fake = fakeController();
    const states: PythonState[] = [];
    connectValidationRuntime(fake.create, (state) => states.push(state));
    expect(fake.controller.start).toHaveBeenCalledTimes(1);
    fake.emit({ type: "progress", loadedBytes: 1, totalBytes: 2 });
    fake.emit(ready);
    expect(states).toEqual(["loading", "ready"]);
  });

  it("says failed when Python cannot start, and loading again on a retry", () => {
    const fake = fakeController();
    const states: PythonState[] = [];
    const runtime = connectValidationRuntime(fake.create, (state) => states.push(state));
    fake.emit({ type: "failed" });
    runtime.retry();
    expect(fake.controller.start).toHaveBeenCalledTimes(2);
    expect(states).toEqual(["loading", "failed", "loading"]);
  });

  it("keeps saying ready while a fresh worker starts between two programs", () => {
    const fake = fakeController();
    const states: PythonState[] = [];
    connectValidationRuntime(fake.create, (state) => states.push(state));
    fake.emit(ready);
    fake.emit({ type: "restarting", reason: "isolation" });
    expect(states).toEqual(["loading", "ready"]);
  });

  it("checks through the controller, and Stop stops the check that has begun", async () => {
    const fake = fakeController();
    const runtime = connectValidationRuntime(fake.create, () => undefined);
    const pending = runtime.checkProgram("print(1)", []);
    expect(fake.controller.check).toHaveBeenCalledWith("print(1)", [], { freshWorker: true });
    runtime.stop();
    expect(fake.controller.stop).toHaveBeenCalledTimes(1);
    fake.emit({
      type: "check_done",
      runId: "r1" as RunId,
      results: [],
      summary: {
        total: 0,
        passed: 0,
        failed: 0,
        notRun: 0,
        allPassed: true,
        timeLimit: false,
      },
      ended: "stopped",
    });
    expect(await pending).toEqual([]);
  });

  it("ends the controller and whatever waits when the editor closes", async () => {
    const fake = fakeController();
    const runtime = connectValidationRuntime(fake.create, () => undefined);
    const pending = runtime.checkProgram("x", []);
    runtime.dispose();
    expect(await pending).toBeUndefined();
    expect(fake.controller.dispose).toHaveBeenCalledTimes(1);
  });
});
