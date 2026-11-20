// The messages between the page and the Python worker, protocol version 1
// (docs/spec/02-architecture.md section 5.2). Every message, in both
// directions, is parsed here before use; anything else is dropped and
// reported.
//
// This module imports nothing. The worker is compiled by the TypeScript
// compiler alone, not bundled (ADR-0033), so it cannot use a schema library
// from node_modules; the page parses with these same functions, so both sides
// share one definition. `null` is never valid: it reaches Python as JsNull,
// not None (section 14, pitfall 2).
//
// Not yet here: `check`, `test_result` and `check_done`, which arrive with the
// harness in WP-3.3, and `init.harnessVersion` with them.

export const PROTOCOL_VERSION = 1;

/**
 * FR-RUN-03: output per run is capped at this many characters, counted as a
 * reader counts them. A character outside the basic plane is two UTF-16
 * units, so a chunk may be up to twice as long in `string.length`.
 */
export const OUTPUT_LIMIT = 64_000;
/** The longest error summary the worker reports, in characters. */
export const MESSAGE_LIMIT = 1_000;
/** UTF-16 units per character, at most: the parser's limits are in units. */
const UNITS_PER_CHARACTER = 2;
/** The longest program a run accepts, in characters. */
export const SOURCE_LIMIT = 100_000;
/** The most lines a batch run may carry, and the longest line. */
export const STDIN_LINE_LIMIT = 1_000;
export const STDIN_LINE_LENGTH_LIMIT = 10_000;

export type RunId = string & { readonly __brand: "RunId" };
const RUN_ID = /^[a-z0-9][a-z0-9-]{0,63}$/;

export type InputMode = "interactive" | "batch";
export type OutputStream = "stdout" | "stderr";

/** The errors a learner's program can end with inside the worker. */
export const WORKER_ERROR_KINDS = [
  "syntax",
  "runtime",
  "input_ended",
  "output_limit",
  "memory",
] as const;
export type WorkerErrorKind = (typeof WORKER_ERROR_KINDS)[number];

export type WorkerOutcome =
  { kind: "ok" } | { kind: WorkerErrorKind; message: string; line?: number };

/** Why the worker cannot continue. The page answers every one by starting a new worker. */
export const FATAL_REASONS = [
  "load_failed",
  "version_mismatch",
  "lockdown_failed",
  "malformed_message",
  "unexpected_message",
  "runtime_crashed",
] as const;
export type FatalReason = (typeof FATAL_REASONS)[number];

export type PageMessage =
  | { type: "init"; assetBase: string }
  | { type: "run"; runId: RunId; source: string; mode: InputMode; stdin?: string[] }
  | { type: "input"; runId: RunId; line: string }
  | { type: "input_end"; runId: RunId };

export type WorkerMessage =
  | { type: "progress"; loadedBytes: number; totalBytes: number }
  | { type: "ready"; runtimeVersion: string; capabilities: { interactiveInput: boolean } }
  | { type: "output"; runId: RunId; stream: OutputStream; text: string }
  | { type: "input_request"; runId: RunId }
  | {
      type: "run_done";
      runId: RunId;
      outcome: WorkerOutcome;
      truncated: boolean;
      durationMs: number;
    }
  | { type: "fatal"; reason: FatalReason };

/** Why a message was refused. A code only: the refused value is never echoed. */
export type ParseError =
  "not_an_object" | "unknown_type" | "unknown_field" | "missing_field" | "invalid_field";

export type ParseResult<T> = { ok: true; value: T } | { ok: false; error: ParseError };

class Refused extends Error {
  constructor(readonly code: ParseError) {
    super(code);
  }
}

type Fields = Record<string, unknown>;

function record(value: unknown): Fields {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Refused("not_an_object");
  }
  const prototype: unknown = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) throw new Refused("not_an_object");
  return value as Fields;
}

/** Refuses a field that is not listed, so a message carries exactly its own fields. */
function only(fields: Fields, allowed: readonly string[]): void {
  for (const key of Object.keys(fields)) {
    if (!allowed.includes(key)) throw new Refused("unknown_field");
  }
}

function present(fields: Fields, key: string): unknown {
  if (!Object.hasOwn(fields, key)) throw new Refused("missing_field");
  const value = fields[key];
  if (value === undefined) throw new Refused("missing_field");
  return value;
}

function text(fields: Fields, key: string, maxLength: number): string {
  const value = present(fields, key);
  if (typeof value !== "string" || value.length > maxLength) throw new Refused("invalid_field");
  return value;
}

function count(fields: Fields, key: string): number {
  const value = present(fields, key);
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0) {
    throw new Refused("invalid_field");
  }
  return value;
}

function flag(fields: Fields, key: string): boolean {
  const value = present(fields, key);
  if (typeof value !== "boolean") throw new Refused("invalid_field");
  return value;
}

function oneOf<T extends string>(fields: Fields, key: string, options: readonly T[]): T {
  const value = present(fields, key);
  const match = options.find((option) => option === value);
  if (match === undefined) throw new Refused("invalid_field");
  return match;
}

function runId(fields: Fields): RunId {
  const value = text(fields, "runId", 64);
  if (!RUN_ID.test(value)) throw new Refused("invalid_field");
  return value as RunId;
}

/** An asset base is a same-origin path or an https URL, and ends in a slash. */
const ASSET_BASE = /^(?:\/|https:\/\/[a-z0-9.-]+(?::\d+)?\/)(?:[A-Za-z0-9._~-]+\/)*$/;

export function isAssetBase(value: string): boolean {
  return value.length <= 512 && ASSET_BASE.test(value) && !value.split("/").includes("..");
}

function stdinLines(fields: Fields): string[] | undefined {
  if (!Object.hasOwn(fields, "stdin")) return undefined;
  const value = fields["stdin"];
  if (!Array.isArray(value) || value.length > STDIN_LINE_LIMIT) throw new Refused("invalid_field");
  return value.map((line: unknown) => {
    if (typeof line !== "string" || line.length > STDIN_LINE_LENGTH_LIMIT || line.includes("\n")) {
      throw new Refused("invalid_field");
    }
    return line;
  });
}

function outcome(value: unknown): WorkerOutcome {
  const fields = record(value);
  const kind = oneOf(fields, "kind", ["ok", ...WORKER_ERROR_KINDS] as const);
  if (kind === "ok") {
    only(fields, ["kind"]);
    return { kind };
  }
  only(fields, ["kind", "message", "line"]);
  const message = text(fields, "message", MESSAGE_LIMIT * UNITS_PER_CHARACTER);
  if (!Object.hasOwn(fields, "line")) return { kind, message };
  const line = count(fields, "line");
  if (line < 1) throw new Refused("invalid_field");
  return { kind, message, line };
}

function parseWith<T>(data: unknown, parse: (fields: Fields) => T): ParseResult<T> {
  try {
    return { ok: true, value: parse(record(data)) };
  } catch (error) {
    if (error instanceof Refused) return { ok: false, error: error.code };
    throw error;
  }
}

/** Parses a message the worker received from the page. */
export function parsePageMessage(data: unknown): ParseResult<PageMessage> {
  return parseWith(data, (fields): PageMessage => {
    const type = present(fields, "type");
    switch (type) {
      case "init": {
        only(fields, ["type", "assetBase"]);
        const assetBase = text(fields, "assetBase", 512);
        if (!isAssetBase(assetBase)) throw new Refused("invalid_field");
        return { type, assetBase };
      }
      case "run": {
        only(fields, ["type", "runId", "source", "mode", "stdin"]);
        const message = {
          type,
          runId: runId(fields),
          source: text(fields, "source", SOURCE_LIMIT),
          mode: oneOf(fields, "mode", ["interactive", "batch"] as const),
        };
        const stdin = stdinLines(fields);
        return stdin === undefined ? message : { ...message, stdin };
      }
      case "input": {
        only(fields, ["type", "runId", "line"]);
        const line = text(fields, "line", STDIN_LINE_LENGTH_LIMIT);
        // One answer is one line, as in batch input.
        if (line.includes("\n")) throw new Refused("invalid_field");
        return { type, runId: runId(fields), line };
      }
      case "input_end": {
        only(fields, ["type", "runId"]);
        return { type, runId: runId(fields) };
      }
      default:
        throw new Refused("unknown_type");
    }
  });
}

/** Parses a message the page received from the worker. */
export function parseWorkerMessage(data: unknown): ParseResult<WorkerMessage> {
  return parseWith(data, (fields): WorkerMessage => {
    const type = present(fields, "type");
    switch (type) {
      case "progress": {
        only(fields, ["type", "loadedBytes", "totalBytes"]);
        return {
          type,
          loadedBytes: count(fields, "loadedBytes"),
          totalBytes: count(fields, "totalBytes"),
        };
      }
      case "ready": {
        only(fields, ["type", "runtimeVersion", "capabilities"]);
        const capabilities = record(present(fields, "capabilities"));
        only(capabilities, ["interactiveInput"]);
        return {
          type,
          runtimeVersion: text(fields, "runtimeVersion", 64),
          capabilities: { interactiveInput: flag(capabilities, "interactiveInput") },
        };
      }
      case "output": {
        only(fields, ["type", "runId", "stream", "text"]);
        return {
          type,
          runId: runId(fields),
          stream: oneOf(fields, "stream", ["stdout", "stderr"] as const),
          text: text(fields, "text", OUTPUT_LIMIT * UNITS_PER_CHARACTER),
        };
      }
      case "input_request": {
        only(fields, ["type", "runId"]);
        return { type, runId: runId(fields) };
      }
      case "run_done": {
        only(fields, ["type", "runId", "outcome", "truncated", "durationMs"]);
        return {
          type,
          runId: runId(fields),
          outcome: outcome(present(fields, "outcome")),
          truncated: flag(fields, "truncated"),
          durationMs: count(fields, "durationMs"),
        };
      }
      case "fatal": {
        only(fields, ["type", "reason"]);
        return { type, reason: oneOf(fields, "reason", FATAL_REASONS) };
      }
      default:
        throw new Refused("unknown_type");
    }
  });
}

/** A run ID for the page to give each run: unique within a page's lifetime. */
export function createRunId(sequence: number): RunId {
  return `run-${sequence}` as RunId;
}
