import type { TestResult } from "@/grader/grade";
import type { TestCase } from "@/grader/test-case";
import type { ControllerEvent, RuntimeController } from "@/runtime/controller";
import type { RunId } from "@/runtime/protocol";
import type { CheckProgram } from "./validate-lesson";

// The lesson editor's Validate on the learners' runtime controller
// (.claude/rules/runtimes.md: one grading path). Each program is checked on
// a fresh worker, so one program cannot change what the next one reports
// (T-22, T-23). A check asked for while Python loads or restarts after a
// time limit starts at the next `ready`.

type Waiting = {
  source: string;
  tests: readonly TestCase[];
  runId: RunId | undefined;
  resolve: (results: TestResult[] | undefined) => void;
};

export type ControllerChecks = {
  checkProgram: CheckProgram;
  /** Every controller event goes here. */
  handle: (event: ControllerEvent) => void;
  /** The editor closed: whatever waits gets undefined, and nothing more runs. */
  dispose: () => void;
};

export function createControllerChecks(
  controller: Pick<RuntimeController, "check">,
): ControllerChecks {
  let waiting: Waiting | undefined;
  let disposed = false;

  const settle = (results: TestResult[] | undefined) => {
    const current = waiting;
    waiting = undefined;
    current?.resolve(results);
  };

  const begin = () => {
    if (waiting === undefined || waiting.runId !== undefined) return;
    const request = controller.check(waiting.source, waiting.tests, { freshWorker: true });
    if (request.ok) waiting.runId = request.runId;
    else if (request.error === "invalid") settle(undefined);
    // not_ready: the next `ready` begins it.
  };

  return {
    checkProgram: (source, tests) => {
      if (disposed || waiting !== undefined) return Promise.resolve(undefined);
      return new Promise((resolve) => {
        waiting = { source, tests, runId: undefined, resolve };
        begin();
      });
    },
    handle: (event) => {
      if (event.type === "ready") begin();
      else if (event.type === "failed") settle(undefined);
      else if (
        event.type === "check_done" &&
        waiting?.runId !== undefined &&
        event.runId === waiting.runId
      ) {
        settle(event.results);
      }
    },
    dispose: () => {
      disposed = true;
      settle(undefined);
    },
  };
}
