import { describe, expect, it } from "vitest";
import { createRunId } from "@/runtime/protocol";
import { addReport, INITIAL_VIEW, reduceView, startRun } from "./runtime-view";

const runId = createRunId(1);

describe("runtime page view", () => {
  it("[FR-RUN-01] joins output from one stream and keeps the streams apart", () => {
    let view = INITIAL_VIEW;
    view = reduceView(view, { type: "output", runId, stream: "stdout", text: "a" }, "running");
    view = reduceView(view, { type: "output", runId, stream: "stdout", text: "b" }, "running");
    view = reduceView(view, { type: "output", runId, stream: "stderr", text: "c" }, "running");
    expect(view.output).toEqual([
      { stream: "stdout", text: "ab" },
      { stream: "stderr", text: "c" },
    ]);
  });

  it("[FR-RUN-02] counts restarts and clears progress for the new worker", () => {
    let view = reduceView(
      INITIAL_VIEW,
      { type: "progress", loadedBytes: 1, totalBytes: 2 },
      "loading",
    );
    view = reduceView(view, { type: "restarting", reason: "time_limit" }, "restarting");
    expect(view).toMatchObject({ status: "restarting", restarts: 1, progress: undefined });
  });

  it("[FR-RUN-01] a new run starts with no output and no result", () => {
    let view = reduceView(
      INITIAL_VIEW,
      { type: "output", runId, stream: "stdout", text: "old" },
      "running",
    );
    view = reduceView(
      view,
      {
        type: "run_done",
        result: { runId, outcome: { kind: "ok" }, truncated: false, durationMs: 1 },
      },
      "ready",
    );
    expect(startRun(view, "running")).toMatchObject({
      output: [],
      result: undefined,
      status: "running",
    });
  });

  it("[NFR-SEC-01] lists what the controller dropped", () => {
    expect(addReport(INITIAL_VIEW, { code: "worker_error" }).dropped).toEqual(["worker_error"]);
  });
});
