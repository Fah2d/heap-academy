import { execFileSync } from "node:child_process";
import { beforeAll, describe, expect, it } from "vitest";
import { loadPyodide, type PyodideAPI } from "pyodide";
import {
  parseRunReport,
  PROGRAM_FILENAME,
  RUN_SUPPORT_DEFINITION,
  RUN_SUPPORT_SOURCE,
  SUMMARY_LIMIT,
} from "./run-support.ts";

// The run support is plain Python 3.9+, so it is exercised here in CPython.
// The same text runs in Pyodide in the browser tests (e2e/runtime.spec.ts).
// Each case is a list of programs run one after another in one interpreter,
// so isolation between runs is visible.

type Case = { stdout: string; stderr: string; report: ReturnType<typeof parseRunReport> };

/**
 * `withoutJsonAccelerator` blocks `_json` first, so `json` uses its
 * pure-Python escaper, which reads a table a program can change; the driver
 * puts the table back after each program so its own output stays readable.
 */
function runAll(programs: string[], { withoutJsonAccelerator = false } = {}): Case[] {
  const driver = String.raw`
import sys
if sys.argv[3] == "1":
    sys.modules["_json"] = None
import io, json, json.encoder
escape_table = dict(json.encoder.ESCAPE_DCT)
programs = json.loads(sys.argv[1])
# Held before any program runs: a program may replace json's functions.
encode = json.JSONEncoder().encode
real_stdout = sys.__stdout__
sys.stdin = io.StringIO("")
out, err = io.StringIO(), io.StringIO()
sys.stdout, sys.stderr = out, err
namespace = {}
exec(sys.argv[2], namespace)
run = namespace["_heap_make_runner"](False)
results = []
for program in programs:
    report = run(program)
    json.encoder.ESCAPE_DCT.clear()
    json.encoder.ESCAPE_DCT.update(escape_table)
    results.append({"stdout": out.getvalue(), "stderr": err.getvalue(), "report": report})
    out.seek(0); out.truncate(); err.seek(0); err.truncate()
real_stdout.write(encode(results))
`;
  const text = execFileSync(
    "python3",
    [
      "-I",
      "-c",
      driver,
      JSON.stringify(programs),
      RUN_SUPPORT_DEFINITION,
      withoutJsonAccelerator ? "1" : "0",
    ],
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
namespace["_heap_make_runner"](True)(sys.argv[1])
real_stdout.write(b"".join(recorder.chunks).decode())
`;
  return execFileSync("python3", ["-I", "-c", driver, program, RUN_SUPPORT_DEFINITION], {
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
    // In a cycle, the object is freed only by the garbage collector. If the
    // run support did not collect it, the next run's own collection would
    // run the __del__ in the middle of that run.
    const [, cyclic] = runAll([
      `${keeper("abs")}\nkept.me = kept`,
      "import gc\ngc.collect()\nprint(abs(-2))",
    ]);
    expect(cyclic?.stdout).toBe("2\n");
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

  it("[FR-RUN-01] escapes the error text, whatever it holds, so the report says what happened", () => {
    const text = 'x", "kind": "ok", "y": "\\ \n \u2028 \ud800 end';
    const [result] = runAll(
      [
        [
          "import json.encoder",
          // The pure-Python escaper reads this table; the report must not.
          "json.encoder.ESCAPE_DCT['\"'] = '\"'",
          `raise ValueError(${JSON.stringify(text)})`,
        ].join("\n"),
      ],
      { withoutJsonAccelerator: true },
    );
    expect(result?.report?.kind).toBe("runtime");
    expect(result?.report?.message).toBe(`ValueError: ${text}`);
  });

  it("[FR-RUN-01] reports the error's real class, not a __class__ the program defined", () => {
    const [result] = runAll([
      [
        "class Spoof(ValueError):",
        "    code = 0",
        "    @property",
        "    def __class__(self):",
        "        return SystemExit",
        'raise Spoof("real")',
      ].join("\n"),
    ]);
    expect(result?.report?.kind).toBe("runtime");
  });

  it("[FR-RUN-01] reports an error with a strange line, or whose attributes raise, as the program's error", () => {
    const [huge, raising] = runAll([
      'e = SyntaxError("odd")\ne.lineno = 10 ** 30\nraise e',
      [
        "class Bad(SyntaxError):",
        "    @property",
        "    def lineno(self):",
        '        raise RuntimeError("no")',
        'raise Bad("x")',
      ].join("\n"),
    ]);
    expect(huge?.report).toMatchObject({ kind: "syntax", line: undefined });
    expect(raising?.report?.kind).toBe("runtime");
    const property = (name: string, base: string) =>
      [
        `class Bad(${base}):`,
        "    @property",
        `    def ${name}(self):`,
        '        raise ValueError("no")',
        'raise Bad("x")',
      ].join("\n");
    const results = runAll([
      property("__traceback__", "ValueError"),
      property("code", "SystemExit"),
      'print("next")',
    ]);
    expect(results.map((result) => result.report?.kind)).toEqual(["runtime", "runtime", "ok"]);
    expect(results[2]?.stdout).toBe("next\n");
  });

  it("[FR-RUN-06] an error whose attributes raise keeps the kind its class names, so a memory error still replaces the worker", () => {
    const raising = (base: string, raised: string) =>
      [
        `class Bad(${base}):`,
        "    @property",
        "    def __traceback__(self):",
        `        raise ${raised}("no")`,
        'raise Bad("x")',
      ].join("\n");
    const results = runAll([
      raising("MemoryError", "ValueError"),
      raising("ValueError", "MemoryError"),
      raising("EOFError", "ValueError"),
    ]);
    expect(results.map((result) => result.report?.kind)).toEqual([
      "memory",
      "memory",
      "input_ended",
    ]);
  });

  it("[FR-RUN-01] cuts a long error summary to its limit", () => {
    const [result] = runAll(["raise ValueError('x' * 100000)"]);
    expect(result?.report?.message).toHaveLength(SUMMARY_LIMIT);
    expect(result?.report?.message).toMatch(/^ValueError: x+$/);
  });

  it("[FR-RUN-01] keeps a syntax error's line one past the program's end, and drops one further", () => {
    // Python 3.10 and later can point one past the last line ("if True:\n").
    const [onePast, twoPast] = runAll([
      'e = SyntaxError("x")\ne.lineno = 4\nraise e',
      'e = SyntaxError("x")\ne.lineno = 5\nraise e',
    ]);
    expect(onePast?.report).toMatchObject({ kind: "syntax", line: 4 });
    expect(twoPast?.report).toMatchObject({ kind: "syntax", line: undefined });
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

  it("[FR-RUN-01] refuses to make the runner when the streams cannot stream", () => {
    const driver = [
      "import io, sys",
      "sys.stdout = io.StringIO()",
      "namespace = {}",
      "exec(sys.argv[1], namespace)",
      "try:",
      '    namespace["_heap_make_runner"](True)',
      '    sys.__stdout__.write("made")',
      "except AttributeError:",
      '    sys.__stdout__.write("refused")',
    ].join("\n");
    const text = execFileSync("python3", ["-I", "-c", driver, RUN_SUPPORT_DEFINITION], {
      encoding: "utf8",
    });
    expect(text).toBe("refused");
    expect(
      RUN_SUPPORT_SOURCE.trimEnd().endsWith("_heap_make_runner(True, fresh_streams=True)"),
    ).toBe(true);
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
    const [zero, three, no] = runAll([
      "import sys\nsys.exit(0)",
      "import sys\nsys.exit(3)",
      "import sys\nsys.exit(False)",
    ]);
    expect(zero?.report?.kind).toBe("ok");
    expect(no?.report?.kind).toBe("ok");
    expect(three?.report).toEqual({ kind: "runtime", message: "SystemExit: 3", line: undefined });
  });
});

// The parts of the interpreter's state that only Python 3.11 and later have
// (sys.monitoring, the integer digit limit), and the rest of the state the
// harness restores between test cases, checked in Pyodide under Node: the
// same interpreter the worker loads (WP-3.3 "Not fixed": Run does not get the
// harness's restore).
type PyodideRun = (source: string) => {
  stdout: string;
  report: ReturnType<typeof parseRunReport>;
};

/**
 * A runner on a new Pyodide interpreter, with stdout an in-memory stream.
 * `setup` runs first, so the runner starts from the state it leaves.
 */
async function pyodideRunner(setup = ""): Promise<PyodideRun> {
  const pyodide: PyodideAPI = await loadPyodide();
  pyodide.setStdout({ batched: () => {} });
  pyodide.setStderr({ batched: () => {} });
  pyodide.runPython(setup);
  pyodide.runPython(RUN_SUPPORT_DEFINITION);
  const runner: unknown = pyodide.runPython(String.raw`
import io, sys
sys.stdin = io.StringIO("")
sys.stdout, sys.stderr = io.StringIO(), io.StringIO()
_heap_make_runner(False)
`);
  if (typeof runner !== "function") throw new Error("the run support did not make a runner");
  const take: unknown = pyodide.runPython(String.raw`
def _heap_take(stream):
    text = stream.getvalue()
    stream.seek(0)
    stream.truncate()
    return text
_heap_take
`);
  if (typeof take !== "function") throw new Error("the output reader did not evaluate");
  const stdout: unknown = pyodide.runPython("import sys\nsys.stdout");
  return (source) => {
    const report = Reflect.apply(runner, undefined, [source]) as unknown;
    const text = Reflect.apply(take, undefined, [stdout]) as unknown;
    return {
      stdout: typeof text === "string" ? text : "",
      report: typeof report === "string" ? parseRunReport(report) : undefined,
    };
  };
}

type WorkerRun = (
  source: string,
  stdin?: string[],
) => { stdout: string; stderr: string; report: ReturnType<typeof parseRunReport> };

/**
 * The runner as the worker makes it: RUN_SUPPORT_SOURCE over Pyodide's own
 * streams. Before each run it sets the stream handlers and the input lines,
 * as core.ts does, which reopens file descriptors 0, 1 and 2.
 */
async function workerRunner(): Promise<WorkerRun> {
  const pyodide: PyodideAPI = await loadPyodide();
  const decoder = new TextDecoder();
  const written = { stdout: "", stderr: "" };
  const runner: unknown = pyodide.runPython(RUN_SUPPORT_SOURCE);
  if (typeof runner !== "function") throw new Error("the run support did not make a runner");
  return (source, stdin = []) => {
    written.stdout = "";
    written.stderr = "";
    const lines = [...stdin];
    pyodide.setStdout({
      write: (bytes: Uint8Array) => {
        written.stdout += decoder.decode(bytes);
        return bytes.length;
      },
    });
    pyodide.setStderr({
      write: (bytes: Uint8Array) => {
        written.stderr += decoder.decode(bytes);
        return bytes.length;
      },
    });
    pyodide.setStdin({
      stdin: () => {
        const line = lines.shift();
        return line === undefined ? undefined : `${line}\n`;
      },
    });
    const report = Reflect.apply(runner, undefined, [source]) as unknown;
    return {
      stdout: written.stdout,
      stderr: written.stderr,
      report: typeof report === "string" ? parseRunReport(report) : undefined,
    };
  };
}

/** The error a run raised, or undefined. */
function raised(run: () => unknown): unknown {
  try {
    run();
  } catch (error) {
    return error;
  }
  return undefined;
}

describe("run support (Pyodide)", () => {
  let run: PyodideRun;

  beforeAll(async () => {
    run = await pyodideRunner();
  }, 60_000);

  const ok = { kind: "ok", message: "", line: undefined };

  it("[FR-RUN-04] a sys.monitoring callback set by one run does not reach the next, and its tool id is free again", () => {
    expect(
      run(
        [
          "import sys",
          "m = sys.monitoring",
          'm.use_tool_id(2, "ghost")',
          'm.register_callback(2, m.events.CALL, lambda *args: print("GHOST"))',
          "m.set_events(2, m.events.CALL)",
        ].join("\n"),
      ).report,
    ).toEqual(ok);
    expect(run('import sys\nlen("x")\nprint(sys.monitoring.get_tool(2), "after")')).toEqual({
      stdout: "None after\n",
      report: ok,
    });
  });

  it("[FR-RUN-04] a line-cache key left by one run does not run its __eq__ in the next", () => {
    // WP-3.3 security review 4, round 5: the key has the hash of the
    // program's file name, so writing that name into the cache compared them.
    run(
      [
        "import linecache",
        `H = hash("${PROGRAM_FILENAME}")`,
        "class Key:",
        "    def __hash__(self, H=H):",
        "        return H",
        "    def __eq__(self, other, say=print):",
        '        say("INJECTED")',
        "        return False",
        `linecache.cache.pop("${PROGRAM_FILENAME}")`,
        'linecache.cache[Key()] = (0, None, [], "key")',
      ].join("\n"),
    );
    expect(run('print("next")')).toEqual({ stdout: "next\n", report: ok });
  });

  const carriedOver: [string, string, string][] = [
    ["the trace hook", "sys.settrace(lambda *args: None)", "sys.gettrace()"],
    ["the profile hook", "sys.setprofile(lambda *args: None)", "sys.getprofile()"],
    ["the exception hook", "sys.excepthook = print", "sys.excepthook is print"],
    ["the display hook", "sys.displayhook = print", "sys.displayhook is print"],
    ["the breakpoint hook", "sys.breakpointhook = print", "sys.breakpointhook is print"],
    ["the unraisable hook", "sys.unraisablehook = print", "sys.unraisablehook is print"],
    ["the module search path", 'sys.path.append("/nowhere")', '"/nowhere" in sys.path'],
    ["the finders", "sys.meta_path.insert(0, object())", "type(sys.meta_path[0]) is object"],
    ["the path hooks", "sys.path_hooks.insert(0, print)", "sys.path_hooks[0] is print"],
    [
      "the importer cache",
      'sys.path_importer_cache["/nowhere"] = None',
      '"/nowhere" in sys.path_importer_cache',
    ],
    ["the integer digit limit", "sys.set_int_max_str_digits(5000)", "sys.get_int_max_str_digits()"],
    ["the recursion limit", "sys.setrecursionlimit(321)", "sys.getrecursionlimit()"],
    ["the traceback limit", "sys.tracebacklimit = 0", 'hasattr(sys, "tracebacklimit")'],
    ["the arguments list", 'sys.argv.append("x")', "sys.argv"],
    ["the arguments name", 'sys.argv = ["y"]', "sys.argv"],
    [
      "the async generator hooks",
      "sys.set_asyncgen_hooks(firstiter=print)",
      "sys.get_asyncgen_hooks()",
    ],
    ["the garbage collector's callbacks", "gc.callbacks.append(print)", "len(gc.callbacks)"],
    ["the garbage collector's thresholds", "gc.set_threshold(1, 1, 0)", "gc.get_threshold()"],
    ["the garbage collector's enabled state", "gc.disable()", "gc.isenabled()"],
    ["the garbage collector's debug flags", "gc.set_debug(gc.DEBUG_SAVEALL)", "gc.get_debug()"],
    ["the garbage collector's saved garbage", "gc.garbage.append(1)", "len(gc.garbage)"],
  ];
  it("[FR-RUN-04] the garbage collector is on in every run, as it was when the runner was made", () => {
    run("import gc\ngc.disable()");
    expect(run("import gc\nprint(gc.isenabled())")).toEqual({ stdout: "True\n", report: ok });
  });

  for (const [part, change, probe] of carriedOver) {
    it(`[FR-RUN-04] ${part} set by one run is back in the next`, () => {
      const show = `import gc, sys\nprint(${probe})`;
      const before = run(show);
      expect(before.report).toEqual(ok);
      expect(run(`import gc, sys\n${change}`).report).toEqual(ok);
      expect(run(show)).toEqual(before);
    });
  }

  it("[FR-RUN-04] a chain of __del__ methods that outlives the run's collections makes the run raise", async () => {
    // WP-3.1 security review 8, MAJOR 1: each __del__ makes a new cycle that
    // the collection running it does not free, so one collection left the
    // chain for the next run's own collection, in the middle of that program.
    const own = await pyodideRunner();
    const source = [
      "import builtins",
      "class Q:",
      "    def __init__(self):",
      "        self.me = self",
      "    def __del__(self, b=builtins):",
      "        b.print = lambda *a, **k: None",
      "        type(self)()",
      "class P:",
      "    def __init__(self):",
      "        self.me = self",
      "    def __del__(self, Q=Q):",
      "        Q()",
      "P()",
    ].join("\n");
    expect(raised(() => own(source))).toMatchObject({
      type: expect.stringContaining("NotRestored"),
    });
  }, 60_000);

  it("[FR-RUN-04] a __del__ that turns the collector on during the restore makes the run raise", async () => {
    const own = await pyodideRunner("import gc\ngc.disable()");
    const source = [
      "import builtins, gc",
      "class Ghost:",
      "    def __del__(self, gc=gc):",
      "        gc.enable()",
      "builtins.ghost = Ghost()",
    ].join("\n");
    expect(raised(() => own(source))).toMatchObject({
      type: expect.stringContaining("NotRestored"),
    });
  }, 60_000);

  it("[FR-RUN-04] [FR-RUN-01] a stream method a program replaced is gone in the next run, and the traceback still shows the program's line", async () => {
    // WP-3.1 security review 8, MAJOR 2: the stream objects stay for the
    // worker's life, and the runner wrote its traceback through stderr.write.
    const own = await workerRunner();
    expect(
      own(
        [
          "import sys",
          "real = sys.stdout.write",
          "sys.stdout.write = lambda s, real=real: real(s.upper())",
          "sys.stderr.write = lambda s: 0",
        ].join("\n"),
      ).report,
    ).toEqual(ok);
    expect(own('print("second run")')).toMatchObject({ stdout: "second run\n", report: ok });
    const failed = own("x = 1\ny = x / 0");
    expect(failed.report).toEqual({
      kind: "runtime",
      message: "ZeroDivisionError: division by zero",
      line: 2,
    });
    expect(failed.stderr).toContain(`File "${PROGRAM_FILENAME}", line 2`);
    expect(failed.stderr).toContain("y = x / 0");
  }, 60_000);

  it("[FR-RUN-01] an error whose text replaces stderr.write still has its traceback written", async () => {
    const own = await workerRunner();
    const failed = own(
      [
        "import sys",
        "class Sneaky(Exception):",
        "    def __str__(self, sys=sys):",
        "        sys.stderr.write = lambda s: 0",
        '        return "sneaky"',
        "raise Sneaky()",
      ].join("\n"),
    );
    expect(failed.report).toEqual({ kind: "runtime", message: "Sneaky: sneaky", line: 6 });
    expect(failed.stderr).toContain("raise Sneaky()");
  }, 60_000);

  // WP-3.1 security review 8, round 2, MAJOR 1 and MINOR 2 and 3: what a
  // program does to its streams, their buffers and their raw files, or input
  // it leaves unread, does not reach the next run, which gets new streams.
  const streamChanges: [string, string][] = [
    ["closes standard output", "import sys\nsys.stdout.close()"],
    ["closes standard input", "import sys\nsys.stdin.close()"],
    [
      "turns streaming off",
      "import sys\nsys.stdout.reconfigure(line_buffering=False, write_through=False)",
    ],
    ["changes the encoding", 'import sys\nsys.stdout.reconfigure(encoding="ascii")'],
    ["changes the line ending", 'import sys\nsys.stdout.reconfigure(newline="\\r\\n")'],
    [
      "replaces the buffer's write",
      [
        "import sys",
        "b = sys.stdout.buffer",
        'b.write = lambda d, w=type(b).write, b=b: w(b, d.replace(b"caf", b"HIJACKED"))',
      ].join("\n"),
    ],
    [
      "replaces the raw file's write",
      [
        "import sys",
        "r = sys.stdout.buffer.raw",
        'r.write = lambda d, w=type(r).write, r=r: w(r, b"HIJACKED")',
      ].join("\n"),
    ],
    [
      "calls the wrapper's __init__ again",
      [
        "import io, sys",
        "class Buf(io.BytesIO):",
        "    pass",
        'io.TextIOWrapper.__init__(sys.stdout, Buf(), encoding="utf-8", line_buffering=True, write_through=True)',
      ].join("\n"),
    ],
  ];
  for (const [change, source] of streamChanges) {
    it(`[FR-RUN-04] [FR-RUN-01] a program that ${change} does not change the next run's output`, async () => {
      const own = await workerRunner();
      own(source);
      // os.write goes straight to the file: a printed line is already there
      // (FR-RUN-01), a line without its newline still waits.
      expect(
        own('import os\nprint("café")\nos.write(1, b"|")\nprint("x", end="")\nos.write(1, b"|")'),
      ).toEqual({
        stdout: "café\n||x",
        stderr: "",
        report: ok,
      });
    }, 60_000);
  }

  it("[FR-RUN-04] input a program replaced or left unread does not reach the next run", async () => {
    const own = await workerRunner();
    expect(
      own(
        'import sys\nprint(sys.stdin.read(1))\nsys.stdin.buffer.read1 = lambda *a: b"forged\\n"',
        ["ab", "cd"],
      ),
    ).toMatchObject({ stdout: "a\n", report: ok });
    expect(own("print(input())", ["real"])).toMatchObject({ stdout: "real\n", report: ok });
  }, 60_000);

  it("[FR-RUN-04] a finite chain of __del__ methods ends inside its own run", async () => {
    // Round 2, MINOR 4: five links, the last replaces print; the run's
    // collections free every link, and the restore puts print back.
    const own = await pyodideRunner();
    const source = [
      "import builtins",
      "class Link:",
      "    def __init__(self, left):",
      "        self.left = left",
      "        self.me = self",
      "    def __del__(self, b=builtins):",
      "        if self.left > 0:",
      "            type(self)(self.left - 1)",
      "        else:",
      "            b.print = lambda *a, **k: None",
      "Link(5)",
      'print("made chain")',
    ].join("\n");
    expect(own(source)).toEqual({ stdout: "made chain\n", report: ok });
    expect(own('print("next run sees print")')).toEqual({
      stdout: "next run sees print\n",
      report: ok,
    });
  }, 60_000);

  it("[FR-RUN-04] a cycle that a __del__ makes when a restore frees its object is collected before the next run", async () => {
    // The harness's case (WP-3.3 security review 6, MAJOR 1): the restore
    // frees the object in sys.modules, whose __del__ makes a cycle. The
    // program ends with its own collection, so the runner's first collection
    // finds nothing; without the leading restore the cycle then reached the
    // next run (security review 8, round 3, MINOR 2, seen). The automatic
    // collector is off, so only the runner's collections and the next
    // program's own one run; the link's __del__ belongs in its own run.
    const own = await pyodideRunner("import gc\ngc.disable()");
    const source = [
      "import sys, json",
      "class Link:",
      "    def __init__(self):",
      "        self.me = self",
      "    def __del__(self, sys=sys):",
      '        sys.stdout.write("INJECTED\\n")',
      "class Y:",
      "    def __del__(self, Link=Link):",
      "        Link()",
      "class X:",
      "    def __del__(self, sys=sys, Y=Y):",
      '        sys.modules["zz_evil"] = Y()',
      "json._keep = (Link, Y, X, type(sys.stdout))",
      "x = X()",
      "import gc",
      "gc.collect()",
    ].join("\n");
    expect(own(source)).toEqual({ stdout: "INJECTED\n", report: ok });
    expect(own('import gc\ngc.collect()\nprint("next")')).toEqual({
      stdout: "next\n",
      report: ok,
    });
  }, 60_000);

  it("[FR-RUN-04] a sys.monitoring callback that takes a freed tool id while the tools are freed is freed too", async () => {
    // As the harness's test (WP-3.3 security review 4, MINOR 1).
    const own = await pyodideRunner();
    const source = [
      "import sys",
      "m = sys.monitoring",
      "moved = []",
      "def inject(code, offset):",
      '    if code.co_name == "area":',
      '        print("INJECTED")',
      "def hop(code, offset, called, arg0):",
      "    if called is m.set_events and not moved:",
      "        moved.append(1)",
      '        m.use_tool_id(0, "hop")',
      "        m.register_callback(0, m.events.PY_START, inject)",
      "        m.set_events(0, m.events.PY_START)",
      'm.use_tool_id(4, "probe")',
      "m.register_callback(4, m.events.CALL, hop)",
      "m.set_events(4, m.events.CALL)",
    ].join("\n");
    expect(own(source).report).toEqual(ok);
    expect(own("def area(w, h):\n    return w * h\nprint(area(3, 4))")).toEqual({
      stdout: "12\n",
      report: ok,
    });
    expect(own("import sys\nprint([sys.monitoring.get_tool(t) for t in range(6)])")).toEqual({
      stdout: "[None, None, None, None, None, None]\n",
      report: ok,
    });
  }, 60_000);

  it("[FR-RUN-04] puts back the garbage collector callbacks that were there when the runner was made", async () => {
    const own = await pyodideRunner("import gc\ngc.callbacks.append(lambda phase, info: None)");
    own("import gc\ngc.callbacks.clear()");
    expect(own("import gc\nprint(len(gc.callbacks))")).toEqual({ stdout: "1\n", report: ok });
  }, 60_000);

  it("[FR-RUN-04] a __del__ that changes the state after its restore makes the run raise, so the worker is replaced", async () => {
    // The object is freed while the restore clears the builtins, after the
    // trace hook was put back; the state is then not back, and run raises
    // NotRestored instead of reporting (core.ts gives up with runtime_crashed).
    const source = [
      "import builtins, sys",
      "class Ghost:",
      "    def __del__(self, sys=sys):",
      "        sys.settrace(lambda *args: None)",
      "builtins.ghost = Ghost()",
    ].join("\n");
    const own = await pyodideRunner();
    expect(raised(() => own(source))).toMatchObject({
      type: expect.stringContaining("NotRestored"),
    });
  }, 60_000);
});

// WP-3.1 security review 8, round 3: what a program leaves in the codec, in
// the device files behind file descriptors 0, 1 and 2, or on the original
// streams, does not reach the next run. Each case either leaves the next run
// clean or makes a run raise NotRestored, so the worker is replaced.
describe("run support (Pyodide): the streams' codec, devices and originals", () => {
  const ok = { kind: "ok", message: "", line: undefined };
  const notRestored = { type: expect.stringContaining("NotRestored") };

  it("[FR-RUN-04] a program that changes the cached codec's classes makes its own run raise (MAJOR 1)", async () => {
    const own = await workerRunner();
    const source = [
      "import codecs, sys",
      "info = codecs.lookup('utf-8')",
      "class Enc(codecs.IncrementalEncoder):",
      "    def __init__(self, errors='strict'):",
      "        codecs.IncrementalEncoder.__init__(self, errors)",
      "        sys.settrace(lambda *a: None)",
      "    def encode(self, text, final=False):",
      "        return text.upper().encode('utf-8')",
      "class Dec(codecs.IncrementalDecoder):",
      "    def decode(self, data, final=False):",
      "        return 'forged\\n'",
      "info.incrementalencoder = Enc",
      "info.incrementaldecoder = Dec",
    ].join("\n");
    expect(raised(() => own(source))).toMatchObject(notRestored);
  }, 60_000);

  it("[FR-RUN-04] a codec put in the encodings cache, with the interpreter's cache cleared, makes the next run raise (MAJOR 1)", async () => {
    const own = await workerRunner();
    const source = [
      "import codecs, encodings",
      "real = codecs.lookup('utf-8')",
      "class Upper(real.incrementalencoder):",
      "    def encode(self, text, final=False):",
      "        return text.upper().encode('utf-8')",
      "encodings._cache['utf_8'] = codecs.CodecInfo(real.encode, real.decode, name='utf-8',",
      "    incrementalencoder=Upper, incrementaldecoder=real.incrementaldecoder)",
      "def search(name):",
      "    return None",
      "codecs.register(search)",
      "codecs.unregister(search)",
    ].join("\n");
    expect(own(source).report).toEqual(ok);
    expect(raised(() => own('print("hello")\nprint(input())', ["real"]))).toMatchObject(
      notRestored,
    );
  }, 60_000);

  it("[FR-RUN-04] a program that patches the encoder class's __init__ makes its own run raise (MAJOR 1)", async () => {
    const own = await workerRunner();
    const source = [
      "import encodings.utf_8, sys",
      "def init(self, errors='strict'):",
      "    self.errors = errors",
      "    self.buffer = ''",
      "    sys.settrace(lambda *a: None)",
      "encodings.utf_8.IncrementalEncoder.__init__ = init",
    ].join("\n");
    expect(raised(() => own(source))).toMatchObject(notRestored);
  }, 60_000);

  it("[FR-RUN-04] a decoder method patched on its class makes its own run raise", async () => {
    // Older than this series (round 3, "Not caused by this series"): it
    // forged later runs' input() on 16711f5 too.
    const own = await workerRunner();
    const source = [
      "import encodings.utf_8",
      "encodings.utf_8.IncrementalDecoder._buffer_decode = staticmethod(",
      "    lambda data, errors, final: ('forged\\n', len(data)))",
    ].join("\n");
    expect(raised(() => own(source))).toMatchObject(notRestored);
  }, 60_000);

  it("[FR-RUN-04] a file put at /dev/stdin makes the next run raise instead of reading it (MAJOR 2)", async () => {
    const own = await workerRunner();
    const source = [
      "import os",
      "os.unlink('/dev/stdin')",
      "with open('/dev/stdin', 'w') as forged:",
      "    forged.write('forged\\n')",
    ].join("\n");
    expect(own(source).report).toEqual(ok);
    expect(raised(() => own("print(input())", ["real"]))).toMatchObject(notRestored);
  }, 60_000);

  it("[FR-RUN-04] a file put at /dev/stdout, with /dev/stderr linked to it, makes the next run raise (MAJOR 2)", async () => {
    const own = await workerRunner();
    const source = [
      "import os",
      "os.unlink('/dev/stdout')",
      "open('/dev/stdout', 'w').close()",
      "os.unlink('/dev/stderr')",
      "os.symlink('/dev/stdout', '/dev/stderr')",
    ].join("\n");
    expect(own(source).report).toEqual(ok);
    expect(raised(() => own("x = 1\ny = x / 0"))).toMatchObject(notRestored);
  }, 60_000);

  it("[FR-RUN-04] another character device put at /dev/stdin makes the next run raise (MAJOR 2)", async () => {
    const own = await workerRunner();
    const source = [
      "import os",
      "os.unlink('/dev/stdin')",
      "os.symlink('/dev/null', '/dev/stdin')",
    ].join("\n");
    expect(own(source).report).toEqual(ok);
    expect(raised(() => own("print(input())", ["real"]))).toMatchObject(notRestored);
  }, 60_000);

  it("[FR-RUN-04] an error the runner's collection reports goes to the run's own stderr, not to the originals (MINOR 3)", async () => {
    // The first run leaves text waiting in the original stderr's buffer,
    // found through the collector; the second run's cycle raises in its
    // __del__ while the runner collects. Written to the original, the
    // report would carry the first run's text with it.
    const own = await workerRunner();
    const first = [
      "import gc, io, sys",
      "for found in gc.get_objects():",
      "    if type(found) is io.TextIOWrapper and found is not sys.stderr and found.fileno() == 2:",
      "        found.buffer.write(b'FORGED|')",
    ].join("\n");
    expect(own(first).report).toEqual(ok);
    const second = [
      "class Cycle:",
      "    def __init__(self):",
      "        self.me = self",
      "    def __del__(self):",
      "        raise ValueError('from the cycle')",
      "Cycle()",
    ].join("\n");
    const result = own(second);
    expect(result.report).toEqual(ok);
    expect(result.stderr).toContain("ValueError: from the cycle");
    expect(result.stderr).not.toContain("FORGED");
  }, 60_000);

  it("[FR-RUN-04] what a program writes to sys.__stderr__ is its own output, and a later run's warning is not mixed with it (MINOR 3)", async () => {
    const own = await workerRunner();
    const first = own('import sys\nsys.__stderr__.buffer.write(b"FORGED by run 1 | ")');
    expect(first.report).toEqual(ok);
    expect(first.stderr).toBe("FORGED by run 1 | ");
    const second = own("async def f():\n    pass\nc = f()");
    expect(second.report).toEqual(ok);
    expect(second.stderr).toContain("RuntimeWarning: coroutine 'f' was never awaited");
    expect(second.stderr).not.toContain("FORGED");
  }, 60_000);

  it("[FR-RUN-04] a write method set on sys.__stderr__ does not hide a later run's warning (MINOR 3)", async () => {
    const own = await workerRunner();
    expect(own("import sys\nsys.__stderr__.write = lambda s: 0").report).toEqual(ok);
    const second = own("async def f():\n    pass\nc = f()");
    expect(second.stderr).toContain("RuntimeWarning: coroutine 'f' was never awaited");
  }, 60_000);

  it("[FR-RUN-04] a method a program sets on its stream is cleared in its run, so freeing the stream runs no learner code", async () => {
    const own = await workerRunner();
    const source = [
      "import sys, builtins",
      "sys.stdout.close = lambda b=builtins: b.__dict__.__setitem__('leak', 1)",
      "sys.stdout.buffer.close = lambda b=builtins: b.__dict__.__setitem__('leak', 2)",
    ].join("\n");
    expect(own(source).report).toEqual(ok);
    expect(own("print('leak' in dir(__builtins__))")).toMatchObject({
      stdout: "False\n",
      report: ok,
    });
  }, 60_000);

  it("[FR-RUN-04] a method a __del__ sets on the stream during the runner's collection makes the run raise", async () => {
    // Set after the stream's attributes were cleared, it would run when the
    // stream is freed, after the program's run.
    const own = await workerRunner();
    const source = [
      "import sys",
      "class Cycle:",
      "    def __init__(self):",
      "        self.me = self",
      "    def __del__(self, sys=sys):",
      "        sys.stdout.close = lambda: None",
      "Cycle()",
    ].join("\n");
    expect(raised(() => own(source))).toMatchObject(notRestored);
  }, 60_000);

  it("[FR-RUN-04] a search function that returns the held codec makes the next run raise before its code runs (round 4, MAJOR 1)", async () => {
    // With the encodings cache entry set to None and the interpreter's cache
    // cleared, the next run's lookup reaches the program's search function.
    const own = await workerRunner();
    const source = [
      "import codecs, encodings",
      "held = codecs.lookup('utf-8')",
      "def search(name, held=held):",
      "    print('FORGED')",
      "    return held",
      "codecs.register(search)",
      "encodings._cache['utf_8'] = None",
      "def drop(name):",
      "    return None",
      "codecs.register(drop)",
      "codecs.unregister(drop)",
    ].join("\n");
    expect(own(source).report).toEqual(ok);
    expect(raised(() => own('print("hello")'))).toMatchObject(notRestored);
  }, 60_000);

  it("[FR-RUN-04] an object a program stores on its stream's encoder is freed in its run, while the run's streams are bound (round 4, MINOR 3)", async () => {
    const own = await workerRunner();
    const source = [
      "import codecs, gc, sys",
      "class Late:",
      "    def __init__(self, run_id):",
      "        self.run_id = run_id",
      "    def __del__(self, sys=sys, print=print, id=id):",
      "        print('late', 'same' if id(sys.stdout) == self.run_id else 'other')",
      "for part in gc.get_referents(sys.stdout):",
      "    if isinstance(part, codecs.IncrementalEncoder):",
      "        part.keep = Late(id(sys.stdout))",
    ].join("\n");
    const result = own(source);
    expect(result.report).toEqual(ok);
    expect(result.stdout).toBe("late same\n");
    expect(own('print("next")')).toMatchObject({ stdout: "next\n", report: ok });
  }, 60_000);

  it("[FR-RUN-04] a cycle made when the state is restored after the streams are cleared is collected while the run's streams are bound (round 4, MINOR 4)", async () => {
    // The stream's object puts another into builtins as it is freed; the
    // restore that starts the collections frees that one, which makes a
    // cycle whose __del__ makes a second. Without that restore the first
    // collection finds nothing, the first cycle is collected only when the
    // run's streams are dropped, and the second's __del__ runs after the
    // originals are bound.
    const own = await workerRunner();
    const source = [
      "import builtins, gc, sys",
      "class Cycle:",
      "    def __init__(self, run_id, classes, depth):",
      "        self.me = self",
      "        self.run_id = run_id",
      "        self.classes = classes",
      "        self.depth = depth",
      "    def __del__(self, sys=sys, print=print, id=id):",
      "        if self.depth:",
      "            type(self)(self.run_id, self.classes, self.depth - 1)",
      "        else:",
      "            print('cycle', 'same' if id(sys.stdout) == self.run_id else 'other')",
      "class Placed:",
      "    def __init__(self, run_id, classes):",
      "        self.run_id = run_id",
      "        self.classes = classes",
      "    def __del__(self, Cycle=Cycle):",
      "        Cycle(self.run_id, self.classes, 1)",
      "class Kept:",
      "    def __init__(self, run_id, classes):",
      "        self.run_id = run_id",
      "        self.classes = classes",
      "    def __del__(self, builtins=builtins, Placed=Placed):",
      "        builtins.__dict__['placed'] = Placed(self.run_id, self.classes)",
      "sys.stdout.keep = Kept(id(sys.stdout), (Cycle, Placed, Kept))",
      "gc.collect()",
    ].join("\n");
    const result = own(source);
    expect(result.report).toEqual(ok);
    expect(result.stdout).toBe("cycle same\n");
  }, 60_000);

  it("[FR-RUN-04] the run's streams are bound as __stdin__, __stdout__ and __stderr__ too", async () => {
    const own = await workerRunner();
    expect(
      own(
        "import sys\nprint(sys.__stdout__ is sys.stdout, sys.__stderr__ is sys.stderr, sys.__stdin__ is sys.stdin)",
      ),
    ).toMatchObject({ stdout: "True True True\n", report: ok });
  }, 60_000);
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
