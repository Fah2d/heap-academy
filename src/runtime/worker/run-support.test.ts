import { execFileSync } from "node:child_process";
import { describe, expect, it } from "vitest";
import {
  parseRunReport,
  PROGRAM_FILENAME,
  RUN_SUPPORT_SOURCE,
  SUMMARY_LIMIT,
} from "./run-support.ts";

// The run support is plain Python 3.9+, so it is exercised here in CPython.
// The same text runs in Pyodide in the browser tests (e2e/runtime.spec.ts).
// Each case is a list of programs run one after another in one interpreter,
// so isolation between runs is visible.

type Case = { stdout: string; stderr: string; report: ReturnType<typeof parseRunReport> };

function runAll(programs: string[]): Case[] {
  const driver = String.raw`
import io, json, sys
programs = json.loads(sys.argv[1])
# Held before any program runs: a program may replace json's functions.
encode = json.JSONEncoder().encode
real_stdout = sys.__stdout__
sys.stdin = io.StringIO("")
out, err = io.StringIO(), io.StringIO()
sys.stdout, sys.stderr = out, err
namespace = {}
exec(sys.argv[2], namespace)
run = namespace["_heap_make_runner"]()
results = []
for program in programs:
    report = run(program)
    results.append({"stdout": out.getvalue(), "stderr": err.getvalue(), "report": report})
    out.seek(0); out.truncate(); err.seek(0); err.truncate()
real_stdout.write(encode(results))
`;
  const text = execFileSync(
    "python3",
    ["-I", "-c", driver, JSON.stringify(programs), RUN_SUPPORT_SOURCE],
    { encoding: "utf8" },
  );
  const parsed = JSON.parse(text) as { stdout: string; stderr: string; report: string }[];
  return parsed.map(({ stdout, stderr, report }) => ({
    stdout,
    stderr,
    report: parseRunReport(report),
  }));
}

/**
 * Runs one program with stdout a real text stream over a recording raw
 * stream, as in the worker, and returns what the program saw arrive.
 */
function runStreaming(program: string): string {
  const driver = String.raw`
import io, sys
class Recorder(io.RawIOBase):
    def __init__(self):
        self.chunks = []
    def writable(self):
        return True
    def write(self, data):
        self.chunks.append(bytes(data))
        return len(data)
recorder = Recorder()
real_stdout = sys.__stdout__
sys.stdout = io.TextIOWrapper(io.BufferedWriter(recorder), encoding="utf-8")
sys.stdin = io.StringIO("")
sys._heap_recorded = recorder.chunks
namespace = {}
exec(sys.argv[2], namespace)
namespace["_heap_make_runner"]()(sys.argv[1])
real_stdout.write(b"".join(recorder.chunks).decode())
`;
  return execFileSync("python3", ["-I", "-c", driver, program, RUN_SUPPORT_SOURCE], {
    encoding: "utf8",
  });
}

describe("run support (CPython)", () => {
  it("[FR-RUN-01] runs a program as __main__ and reports ok", () => {
    const [result] = runAll(['print("hi", __name__)']);
    expect(result).toEqual({
      stdout: "hi __main__\n",
      stderr: "",
      report: { kind: "ok", message: "", line: undefined },
    });
  });

  it("[FR-RUN-01] reports a syntax error with its line", () => {
    const [result] = runAll(["x = 1\nif x\n    print(x)\n"]);
    expect(result?.report?.kind).toBe("syntax");
    expect(result?.report?.line).toBe(2);
    expect(result?.report?.message).toMatch(/^SyntaxError/);
  });

  it("[FR-RUN-01] reports a runtime error with the learner's line and its text", () => {
    const [result] = runAll(["a = 1\nb = 2\nprint(c)\n"]);
    expect(result?.report).toEqual({
      kind: "runtime",
      message: "NameError: name 'c' is not defined",
      line: 3,
    });
    expect(result?.stderr).toContain(`File "${PROGRAM_FILENAME}", line 3`);
    expect(result?.stderr).toContain("print(c)");
    // Only the learner's frames: nothing of the run support.
    expect(result?.stderr).not.toContain("_heap");
  });

  it("[FR-RUN-04] gives each run a fresh namespace", () => {
    const [, second] = runAll(["x = 1", "print(x)"]);
    expect(second?.report?.kind).toBe("runtime");
    expect(second?.report?.message).toContain("NameError");
  });

  it("[FR-RUN-04] restores builtins the program deleted or replaced", () => {
    const [first, second] = runAll([
      "import builtins\ndel builtins.print\nbuiltins.len = None\ndel builtins.dict",
      'print(len("ab"), dict(a=1))',
    ]);
    expect(first?.report?.kind).toBe("ok");
    expect(second).toEqual({
      stdout: "2 {'a': 1}\n",
      stderr: "",
      report: { kind: "ok", message: "", line: undefined },
    });
  });

  it("[FR-RUN-04] restores the streams and the module table", () => {
    const results = runAll([
      'import sys, io\nsys.stdout = io.StringIO()\nimport fractions\ndel sys.modules["json"]',
      'import sys\nprint("fractions" in sys.modules, "json" in sys.modules)',
    ]);
    expect(results[1]?.stdout).toBe("False True\n");
  });

  it("[FR-RUN-04] a __del__ that runs after the program cannot break the next run", () => {
    const keeper = (target: string) =>
      [
        "import builtins",
        "class Keeper:",
        "    def __init__(self):",
        "        self.b = builtins",
        "    def __del__(self):",
        `        self.b.${target} = None`,
        "kept = Keeper()",
      ].join("\n");
    const [, abs] = runAll([keeper("abs"), "print(abs(-2))"]);
    expect(abs?.stdout).toBe("2\n");
    const [, len] = runAll([keeper("len"), 'print(len("abc"))']);
    expect(len?.stdout).toBe("3\n");
  });

  it("[FR-RUN-04] an error whose text breaks builtins cannot break the next run", () => {
    const [first, second] = runAll([
      [
        "import builtins",
        "class Sneaky(Exception):",
        "    def __str__(self):",
        "        builtins.print = None",
        '        return "sneaky"',
        "raise Sneaky()",
      ].join("\n"),
      'print("fine")',
    ]);
    expect(first?.report).toEqual({ kind: "runtime", message: "Sneaky: sneaky", line: 6 });
    expect(second?.stdout).toBe("fine\n");
  });

  it("[FR-RUN-04] reports the program's error after it deleted BaseException", () => {
    const [result] = runAll(['import builtins\ndel builtins.BaseException\nraise ValueError("x")']);
    expect(result?.report).toEqual({ kind: "runtime", message: "ValueError: x", line: 3 });
  });

  it("[FR-RUN-04] a program cannot forge the next run's report through json", () => {
    const [, second] = runAll([
      [
        "import json",
        "class Forger(json.JSONEncoder):",
        "    def encode(self, value):",
        '        return \'{"kind": "ok", "message": "", "line": null}\'',
        "json._default_encoder = Forger()",
        'json.dumps = lambda *a, **k: \'{"kind": "ok", "message": "", "line": null}\'',
      ].join("\n"),
      'raise ValueError("second")',
    ]);
    expect(second?.report).toEqual({ kind: "runtime", message: "ValueError: second", line: 1 });
  });

  it("[FR-RUN-01] cuts a long error summary to its limit", () => {
    const [result] = runAll(["raise ValueError('x' * 100000)"]);
    expect(result?.report?.message).toHaveLength(SUMMARY_LIMIT);
    expect(result?.report?.message).toMatch(/^ValueError: x+$/);
  });

  it("[FR-RUN-01] reports no line when a program raises a syntax error with a strange one", () => {
    const [result] = runAll(['e = SyntaxError("odd")\ne.lineno = "two"\nraise e']);
    expect(result?.report?.kind).toBe("syntax");
    expect(result?.report?.line).toBeUndefined();
  });

  it("[FR-RUN-01] passes each printed line on at once, not when a buffer fills", () => {
    const program = [
      'print("first")',
      "import sys",
      "arrived = len(sys._heap_recorded) > 0",
      "print(arrived)",
    ].join("\n");
    expect(runStreaming(program)).toBe("first\nTrue\n");
  });

  it("[FR-RUN-01] reports reading past the end of input as input_ended", () => {
    const [result] = runAll(['name = input()\nprint("hello", name)']);
    expect(result?.report?.kind).toBe("input_ended");
    expect(result?.report?.line).toBe(1);
  });

  it("[FR-RUN-06] reports a memory error as memory, and the next run works", () => {
    const [bomb, next] = runAll(["data = bytearray(1 << 62)", 'print("still here")']);
    expect(bomb?.report?.kind).toBe("memory");
    expect(next?.stdout).toBe("still here\n");
  });

  it("[FR-RUN-01] treats exit(0) as ok and exit(3) as a runtime error", () => {
    const [zero, three] = runAll(["import sys\nsys.exit(0)", "import sys\nsys.exit(3)"]);
    expect(zero?.report?.kind).toBe("ok");
    expect(three?.report).toEqual({ kind: "runtime", message: "SystemExit: 3", line: undefined });
  });
});

describe("parseRunReport", () => {
  it("[NFR-SEC-01] accepts only the shape run returns", () => {
    expect(parseRunReport('{"kind":"ok","message":"","line":null}')).toEqual({
      kind: "ok",
      message: "",
      line: undefined,
    });
    expect(parseRunReport('{"kind":"time_limit","message":"","line":null}')).toBeUndefined();
    expect(parseRunReport('{"kind":"runtime","message":"x","line":0}')).toBeUndefined();
    expect(parseRunReport("not json")).toBeUndefined();
    expect(parseRunReport("[]")).toBeUndefined();
  });
});
