import { HARNESS_VERSION } from "../grader/harness.ts";
import { describe, expect, it } from "vitest";
import {
  createRunId,
  isAssetBase,
  MESSAGE_LIMIT,
  OUTPUT_LIMIT,
  parsePageMessage,
  parseWorkerMessage,
  SOURCE_LIMIT,
  STDIN_LINE_LIMIT,
} from "./protocol.ts";

const runId = createRunId(1);
const test = {
  id: "greets-sara",
  name: "Greets Sara by name",
  stdin: "Sara\n",
  afterCode: "",
  expected: "What is your name? Hello, Sara!",
  match: "normalized",
  hint: "",
};
const passed = {
  testCaseId: "greets-sara",
  status: "passed",
  actual: "What is your name? Hello, Sara!\n",
  truncated: false,
  harnessVersion: HARNESS_VERSION,
};
const summary = { total: 1, passed: 1, failed: 0, notRun: 0, allPassed: true, timeLimit: false };

describe("page messages", () => {
  it("[NFR-SEC-01] accepts each message the page sends", () => {
    for (const message of [
      { type: "init", assetBase: "/_runtime/pyodide/314.0.7/", harnessVersion: HARNESS_VERSION },
      { type: "run", runId, source: "print(1)", mode: "batch" },
      { type: "run", runId, source: "x = input()", mode: "batch", stdin: ["Ada"] },
      { type: "input", runId, line: "Ada" },
      { type: "input_end", runId },
      { type: "check", runId, source: "print(1)", tests: [test] },
    ]) {
      expect(parsePageMessage(message)).toEqual({ ok: true, value: message });
    }
  });

  it.each([
    [
      "an init without the harness version",
      { type: "init", assetBase: "/_runtime/pyodide/314.0.7/" },
      "missing_field",
    ],
    [
      "a check without test cases",
      { type: "check", runId, source: "", tests: [] },
      "invalid_field",
    ],
    [
      "a check whose test case is over a limit",
      { type: "check", runId, source: "", tests: [{ ...test, hint: "x".repeat(201) }] },
      "invalid_field",
    ],
    [
      "a check with a null test case",
      { type: "check", runId, source: "", tests: [null] },
      "invalid_field",
    ],
    [
      "a check with an extra field",
      { type: "check", runId, source: "", tests: [test], solution: "" },
      "unknown_field",
    ],
    [
      "a check over the program limit",
      { type: "check", runId, source: "x".repeat(SOURCE_LIMIT + 1), tests: [test] },
      "invalid_field",
    ],
  ])("[FR-GRD-01] refuses %s", (_name, message, error) => {
    expect(parsePageMessage(message)).toEqual({ ok: false, error });
  });

  it.each([
    ["a null", null, "not_an_object"],
    ["an array", [], "not_an_object"],
    ["a class instance", new Date(), "not_an_object"],
    ["an unknown type", { type: "eval", code: "1" }, "unknown_type"],
    ["an extra field", { type: "input_end", runId, extra: 1 }, "unknown_field"],
    ["a missing field", { type: "input", runId }, "missing_field"],
    ["an undefined field", { type: "input", runId, line: undefined }, "missing_field"],
    [
      "a null field, which reaches Python as JsNull",
      { type: "input", runId, line: null },
      "invalid_field",
    ],
    ["an unknown mode", { type: "run", runId, source: "", mode: "fast" }, "invalid_field"],
    ["a bad run ID", { type: "input_end", runId: "Run 1" }, "invalid_field"],
    [
      "a program over the limit",
      { type: "run", runId, source: "x".repeat(SOURCE_LIMIT + 1), mode: "batch" },
      "invalid_field",
    ],
    [
      "too many input lines",
      {
        type: "run",
        runId,
        source: "",
        mode: "batch",
        stdin: Array<string>(STDIN_LINE_LIMIT + 1).fill("a"),
      },
      "invalid_field",
    ],
    [
      "an input line with a newline",
      { type: "run", runId, source: "", mode: "batch", stdin: ["a\nb"] },
      "invalid_field",
    ],
    [
      "an asset base on another site over http",
      { type: "init", assetBase: "http://example.com/", harnessVersion: HARNESS_VERSION },
      "invalid_field",
    ],
  ])("[NFR-SEC-01] refuses %s", (_name, message, error) => {
    expect(parsePageMessage(message)).toEqual({ ok: false, error });
  });
});

describe("worker messages", () => {
  it("[NFR-SEC-01] accepts each message the worker sends", () => {
    for (const message of [
      { type: "progress", loadedBytes: 10, totalBytes: 100 },
      { type: "ready", runtimeVersion: "314.0.7", capabilities: { interactiveInput: false } },
      { type: "output", runId, stream: "stdout", text: "hi\n" },
      { type: "input_request", runId },
      { type: "run_done", runId, outcome: { kind: "ok" }, truncated: false, durationMs: 3 },
      {
        type: "run_done",
        runId,
        outcome: { kind: "runtime", message: "NameError", line: 2 },
        truncated: false,
        durationMs: 3,
      },
      { type: "fatal", reason: "lockdown_failed" },
      { type: "test_result", runId, result: passed },
      { type: "check_done", runId, summary },
    ]) {
      expect(parseWorkerMessage(message)).toEqual({ ok: true, value: message });
    }
  });

  it.each([
    [
      "a page-side outcome",
      { type: "run_done", runId, outcome: { kind: "time_limit" }, truncated: false, durationMs: 1 },
      "invalid_field",
    ],
    [
      "a message on an ok outcome",
      {
        type: "run_done",
        runId,
        outcome: { kind: "ok", message: "x" },
        truncated: false,
        durationMs: 1,
      },
      "unknown_field",
    ],
    [
      "line 0",
      {
        type: "run_done",
        runId,
        outcome: { kind: "runtime", message: "x", line: 0 },
        truncated: false,
        durationMs: 1,
      },
      "invalid_field",
    ],
    [
      "a negative byte count",
      { type: "progress", loadedBytes: -1, totalBytes: 1 },
      "invalid_field",
    ],
    [
      "a fractional duration",
      { type: "run_done", runId, outcome: { kind: "ok" }, truncated: false, durationMs: 1.5 },
      "invalid_field",
    ],
    [
      "output longer than the cap can be in UTF-16 units",
      { type: "output", runId, stream: "stdout", text: "x".repeat(OUTPUT_LIMIT * 2 + 1) },
      "invalid_field",
    ],
    [
      "an error summary over its limit",
      {
        type: "run_done",
        runId,
        outcome: { kind: "runtime", message: "x".repeat(MESSAGE_LIMIT * 2 + 1) },
        truncated: false,
        durationMs: 1,
      },
      "invalid_field",
    ],
    ["an unknown stream", { type: "output", runId, stream: "stdlog", text: "" }, "invalid_field"],
    ["an unknown fatal reason", { type: "fatal", reason: "because" }, "invalid_field"],
    [
      "an extra capability",
      { type: "ready", runtimeVersion: "1", capabilities: { interactiveInput: true, eval: true } },
      "unknown_field",
    ],
  ])("[NFR-SEC-01] refuses %s", (_name, message, error) => {
    expect(parseWorkerMessage(message)).toEqual({ ok: false, error });
  });
});

describe("check results from the worker", () => {
  it.each([
    ["a result that is not one", { type: "test_result", runId, result: { status: "passed" } }],
    [
      "a result marked passed and truncated",
      { type: "test_result", runId, result: { ...passed, truncated: true } },
    ],
    ["a null result", { type: "test_result", runId, result: null }],
    [
      "a summary whose counts do not add up",
      { type: "check_done", runId, summary: { ...summary, passed: 2 } },
    ],
    [
      "a summary that says all passed when one failed",
      { type: "check_done", runId, summary: { ...summary, passed: 0, failed: 1 } },
    ],
  ])("[FR-GRD-01] refuses %s", (_name, message) => {
    expect(parseWorkerMessage(message)).toEqual({ ok: false, error: "invalid_field" });
  });
});

describe("asset base", () => {
  it.each([
    ["/_runtime/pyodide/314.0.7/", true],
    ["https://runtime.example.com/pyodide/314.0.7/", true],
    ["/_runtime/pyodide/314.0.7", false],
    ["/_runtime/../secret/", false],
    ["//example.com/", false],
    ["javascript:alert(1)/", false],
  ])("[T-01] %s is %s", (value, expected) => {
    expect(isAssetBase(value)).toBe(expected);
  });
});

describe("limits in the worker's units", () => {
  it("[FR-RUN-03] accepts a chunk of 64,000 characters outside the basic plane", () => {
    const text = "😀".repeat(OUTPUT_LIMIT);
    expect(text.length).toBe(OUTPUT_LIMIT * 2);
    expect(parseWorkerMessage({ type: "output", runId, stream: "stdout", text }).ok).toBe(true);
  });

  it("[FR-RUN-01] accepts an error summary of the longest length the worker sends", () => {
    const message = "😀".repeat(MESSAGE_LIMIT);
    const done = {
      type: "run_done",
      runId,
      outcome: { kind: "runtime", message },
      truncated: false,
      durationMs: 1,
    };
    expect(parseWorkerMessage(done).ok).toBe(true);
  });
});
