import { beforeAll, describe, expect, it } from "vitest";
import { type HarnessResult, parseHarnessResult } from "./grade.ts";
import {
  HARNESS_DEFINITION,
  HARNESS_NAME_LIMIT,
  HARNESS_OUTPUT_LIMIT,
  HARNESS_PROGRAM_FILENAME,
  HARNESS_TEST_FILENAME,
  HARNESS_VERSION,
} from "./harness.ts";
import { type HarnessHost, loadHarness } from "./node-runner/host.ts";

// The harness runs in Pyodide under Node, the same text the browser worker
// evaluates (.claude/rules/testing.md: never by mocking Python). Each test
// runs its cases one after another on one interpreter, so isolation between
// test cases is visible.

let host: HarnessHost;

beforeAll(async () => {
  host = await loadHarness();
}, 60_000);

function run(source: string, { stdin = "", afterCode = "" } = {}): HarnessResult {
  const result = parseHarnessResult(host.check(source, stdin, afterCode));
  if (result === undefined) throw new Error("the harness returned something that is not a result");
  return result;
}

describe("the harness", () => {
  it("[FR-GRD-01] runs the program with the test case's input, and returns its output and version", () => {
    expect(
      run('name = input("What is your name? ")\nprint("Hello, " + name + "!")', {
        stdin: "Sara\n",
      }),
    ).toEqual({
      version: HARNESS_VERSION,
      stage: "program",
      output: "What is your name? Hello, Sara!\n",
      truncated: false,
      error: undefined,
    });
    expect(host.harnessVersion).toBe(HARNESS_VERSION);
    expect(host.runtimeVersion).toBe("314.0.7");
  });

  it("[FR-GRD-01] runs the follow-up code in the program's namespace, and its output counts", () => {
    expect(
      run('print("start")\ndef area(w, h):\n    return w * h', { afterCode: "print(area(3, 4))" }),
    ).toMatchObject({
      stage: "after_code",
      output: "start\n12\n",
      error: undefined,
    });
  });

  it("[FR-GRD-01] reports a learner error with its line, and does not run the follow-up code", () => {
    expect(run('print("a")\nx = 1 / 0', { afterCode: 'print("never")' })).toEqual({
      version: HARNESS_VERSION,
      stage: "program",
      output: "a\n",
      truncated: false,
      error: { kind: "runtime", message: "ZeroDivisionError: division by zero", line: 2 },
    });
  });

  it("[FR-GRD-01] reports a syntax error with its line", () => {
    expect(run("x = 1\ndef f(:\n    pass").error).toEqual({
      kind: "syntax",
      message: "SyntaxError: invalid syntax",
      line: 2,
    });
  });

  it("[FR-GRD-01] names what the follow-up code needed and the program did not define", () => {
    expect(run("x = 3", { afterCode: "print(area(3, 4))" })).toMatchObject({
      stage: "after_code",
      error: {
        kind: "runtime",
        message: "NameError: name 'area' is not defined",
        missingName: "area",
      },
    });
  });

  it("[FR-GRD-01] reports a follow-up code error raised inside the learner's function at the program's line", () => {
    expect(
      run("def area(w, h):\n    return w / 0", { afterCode: "print(area(3, 4))" }).error,
    ).toEqual({
      kind: "runtime",
      message: "ZeroDivisionError: division by zero",
      line: 2,
    });
  });

  it("[FR-GRD-01] a syntax error in the follow-up code has no program line", () => {
    expect(run("x = 3", { afterCode: "print(x" })).toMatchObject({
      stage: "after_code",
      error: { kind: "syntax" },
    });
    expect(run("x = 3", { afterCode: "print(x" }).error).not.toHaveProperty("line");
  });

  it("[FR-GRD-01] reading past the input gives input_ended", () => {
    expect(run("a = input()\nb = input()", { stdin: "one\n" }).error).toMatchObject({
      kind: "input_ended",
      line: 2,
    });
  });

  it("[FR-GRD-01] exit(0) ends the program cleanly and the follow-up code still runs; exit(1) is an error", () => {
    expect(run('print("a")\nexit(0)\nprint("b")', { afterCode: 'print("c")' })).toMatchObject({
      output: "a\nc\n",
      error: undefined,
    });
    expect(run("import sys\nsys.exit(False)").error).toBeUndefined();
    expect(run("exit(1)").error).toMatchObject({ kind: "runtime", message: "SystemExit: 1" });
  });

  it("[FR-GRD-01] standard error is not part of the output", () => {
    expect(run('import sys\nprint("err", file=sys.stderr)\nprint("out")').output).toBe("out\n");
  });

  it("[FR-RUN-03] stops a flood at the output limit, keeping exactly the limit", () => {
    const result = run('while True:\n    print("flood")');
    expect(result.error).toEqual({ kind: "output_limit" });
    expect(result.truncated).toBe(true);
    expect([...result.output].length).toBe(HARNESS_OUTPUT_LIMIT);
  });

  it("[FR-RUN-03] the limit holds against a program that catches Exception", () => {
    const result = run(
      'while True:\n    try:\n        print("x" * 1000)\n    except Exception:\n        pass',
    );
    expect(result.error).toEqual({ kind: "output_limit" });
  });

  it("[FR-RUN-06] reports a memory error as memory, and the next test case runs", () => {
    expect(run("x = [bytearray(1 << 28) for _ in range(20)]").error).toMatchObject({
      kind: "memory",
    });
    expect(run('print("next")').output).toBe("next\n");
  });

  it("[FR-RUN-04] a test case that deletes or replaces builtins does not affect the next", () => {
    run(
      "import builtins\ndel builtins.print\ndel builtins.len\nbuiltins.abs = None\ndel builtins.BaseException",
    );
    expect(run('print(len("abc"), abs(-2))')).toMatchObject({ output: "3 2\n", error: undefined });
  });

  it("[FR-RUN-04] the follow-up code shares the program's namespace and builtins, and the next test case gets them back", () => {
    expect(
      run("import builtins\ndel builtins.print", { afterCode: 'print("after")' }),
    ).toMatchObject({
      output: "",
      error: { kind: "runtime", message: "NameError: name 'print' is not defined" },
    });
    expect(run('print("restored")').output).toBe("restored\n");
  });

  it("[FR-RUN-04] each test case gets a fresh namespace, its own streams, and the module set back", () => {
    run("import fractions, sys\nleft_over = 1\nsys.stdout = None\nsys.stdin = None");
    expect(
      run('import sys\nprint("left_over" in globals(), "fractions" in sys.modules, __name__)'),
    ).toMatchObject({
      output: "False False __main__\n",
      error: undefined,
    });
  });

  it("[FR-RUN-04] learner code that runs after the program, in __del__ or __str__, cannot break the next test case", () => {
    const tamper =
      "import builtins\n" +
      "class Sneaky:\n" +
      "    def __del__(self):\n" +
      "        builtins.len = None\n" +
      "class Loud(Exception):\n" +
      "    def __str__(self):\n" +
      "        del builtins.print\n" +
      '        return "loud"\n' +
      "keep = Sneaky()\n" +
      "raise Loud()";
    expect(run(tamper).error).toMatchObject({ kind: "runtime", message: "Loud: loud" });
    expect(run('print(len("ab"))').output).toBe("2\n");
  });

  it("[FR-GRD-01] an error whose __str__ raises is still the program's error", () => {
    const source =
      "class Bad(Exception):\n    def __str__(self):\n        raise RuntimeError()\nraise Bad()";
    expect(run(source).error).toMatchObject({ kind: "runtime" });
  });

  it("[FR-GRD-01] the result stays valid JSON when the program breaks the json module", () => {
    const source =
      'import json\njson.dumps = None\njson.encoder.ESCAPE_DCT.clear()\nprint("\\"quoted\\"\\u0001 \\ud83d")';
    expect(run(source)).toMatchObject({ output: '"quoted"\u0001 \ud83d\n', error: undefined });
  });

  it("[FR-GRD-01] a write of something that is not text is the program's error, not the harness's", () => {
    expect(run("import sys\nsys.stdout.write(3)").error).toMatchObject({ kind: "runtime" });
  });

  it("[FR-GRD-01] never raises: an exit whose code raises is the program's error, and the next test case runs", () => {
    const source =
      "class Odd(SystemExit):\n    @property\n    def code(self):\n        raise ValueError('boom')\nraise Odd()";
    expect(run(source).error).toMatchObject({ kind: "runtime" });
    expect(run('print("next")')).toMatchObject({ output: "next\n", error: undefined });
  });

  it("[FR-GRD-01] an exit whose code raises is described from the exit itself, with its message and line", () => {
    const source =
      "class Odd(SystemExit):\n    @property\n    def code(self):\n        raise ValueError('boom')\nraise Odd()";
    // The fallback would give an empty message and no line.
    expect(run(source).error).toEqual({ kind: "runtime", message: "Odd", line: 5 });
  });

  it("[FR-GRD-01] never raises: a hook that raises only in the harness's own steps gives a runtime error, and the next test case runs", () => {
    const source = [
      "import sys",
      "def hook(frame, event, arg):",
      `    if frame.f_code.co_filename not in ("${HARNESS_PROGRAM_FILENAME}", "${HARNESS_TEST_FILENAME}"):`,
      "        raise ValueError('hook')",
      "    return hook",
      "sys.settrace(hook)",
    ].join("\n");
    expect(run(source)).toMatchObject({
      stage: "program",
      output: "",
      error: { kind: "runtime", message: "" },
    });
    expect(run('print("next")')).toMatchObject({ output: "next\n", error: undefined });
  });

  it("[FR-GRD-01] never raises: a profile hook that puts back a raising trace hook gives a result, and the next test case runs", () => {
    const source = [
      "import sys",
      "def tracer(frame, event, arg):",
      "    raise ValueError('t')",
      "def prof(frame, event, arg):",
      "    sys.settrace(tracer)",
      "sys.setprofile(prof)",
    ].join("\n");
    expect(run(source)).toMatchObject({ stage: "program", error: { kind: "runtime" } });
    expect(run('print("next")')).toMatchObject({ output: "next\n", error: undefined });
  });

  it("[FR-GRD-01] never raises: a raising trace hook that puts back the profile hook gives a result, and the next test case runs", () => {
    // Pins both calls in the fallback and their order: profile hook, then trace hook.
    const source = [
      "import sys",
      "def tracer(frame, event, arg):",
      "    sys.setprofile(prof)",
      "    raise ValueError('t')",
      "def prof(frame, event, arg):",
      "    sys.settrace(tracer)",
      "sys.setprofile(prof)",
    ].join("\n");
    expect(run(source)).toMatchObject({ stage: "program", error: { kind: "runtime" } });
    expect(run('print("next")')).toMatchObject({ output: "next\n", error: undefined });
  });

  it("[FR-GRD-01] two hooks that put each other back and never raise leave a clean program's result as it is", () => {
    // restore() clears the profile hook first; the other order lets it put the tracer back.
    const source = [
      "import sys",
      "def tracer(frame, event, arg):",
      "    sys.setprofile(prof)",
      "def prof(frame, event, arg):",
      "    sys.settrace(tracer)",
      "sys.setprofile(prof)",
      "print('mine')",
    ].join("\n");
    expect(run(source)).toMatchObject({ stage: "program", output: "mine\n", error: undefined });
    expect(run('print("next")')).toMatchObject({ output: "next\n", error: undefined });
  });

  it("[FR-GRD-01] a profile hook that sets a raising trace hook on the harness's frames makes the harness raise, and the next test case runs", () => {
    // The documented limit of the fallback (harness.ts, check): the worker
    // replaces itself with runtime_crashed, and the Node runner reports crashed.
    const source = [
      "import sys",
      "def T(frame, event, arg):",
      "    raise ValueError('T')",
      "def P(frame, event, arg):",
      `    if frame.f_code.co_filename != "${HARNESS_PROGRAM_FILENAME}":`,
      "        sys.settrace(T)",
      "        frame.f_trace = T",
      "        frame.f_trace_lines = True",
      "sys.setprofile(P)",
    ].join("\n");
    expect(() => host.check(source, "", "")).toThrow();
    expect(run('print("next")')).toMatchObject({ output: "next\n", error: undefined });
  });

  it("[FR-RUN-04] a profile hook that never raises is removed before the next test case", () => {
    run("import sys\nsys.setprofile(lambda *args: None)");
    expect(run("import sys\nprint(sys.getprofile())")).toMatchObject({
      output: "None\n",
      error: undefined,
    });
  });

  it("[FR-GRD-01] never raises: a profile hook that runs inside the harness gives a result, and is removed", () => {
    // run() throws if the harness raised or returned something that is not a result.
    expect(run("import sys\nsys.setprofile(lambda *args: print('P'))").stage).toBe("program");
    expect(run("import sys\nsys.setprofile(lambda *args: 1 / 0)").stage).toBe("program");
    expect(run('print("next")')).toMatchObject({ output: "next\n", error: undefined });
  });

  it("[FR-GRD-01] a misspelled name inside the learner's function is the learner's error, not a name the test needs", () => {
    expect(
      run("def area(w, h):\n    return wdth * h", { afterCode: "print(area(3, 4))" }).error,
    ).toEqual({
      kind: "runtime",
      message: "NameError: name 'wdth' is not defined",
      line: 2,
    });
  });

  it("[FR-GRD-01] a missing name that is empty or too long is left out, and the result stays valid", () => {
    const longest = "n".repeat(HARNESS_NAME_LIMIT);
    expect(run("x = 1", { afterCode: `print(${longest})` }).error).toMatchObject({
      missingName: longest,
    });
    const long = "n".repeat(HARNESS_NAME_LIMIT + 1);
    expect(run("x = 1", { afterCode: `print(${long})` }).error).not.toHaveProperty("missingName");
    expect(
      run("x = 1", { afterCode: "raise NameError('gone', name='')" }).error,
    ).not.toHaveProperty("missingName");
  });

  it("[FR-RUN-03] the output limit holds for text subclasses and for a program that edits the stream", () => {
    const subclass = run(
      "import sys\nclass S(str):\n    pass\nwhile True:\n    sys.stdout.write(S('x' * 1000))",
    );
    expect(subclass).toMatchObject({ error: { kind: "output_limit" }, truncated: true });
    expect([...subclass.output].length).toBe(HARNESS_OUTPUT_LIMIT);
    const direct = run(
      "import io, sys\nfor _ in range(100):\n    io.StringIO.write(sys.stdout, 'x' * 1000)",
    );
    expect(direct.truncated).toBe(true);
    expect(direct.error).toBeUndefined();
    expect([...direct.output].length).toBe(HARNESS_OUTPUT_LIMIT);
  });

  it("[FR-RUN-04] a builtin added in one test case is gone in the next", () => {
    run("import builtins\nbuiltins.leftover = 7");
    expect(run("print(leftover)").error).toMatchObject({
      message: "NameError: name 'leftover' is not defined",
    });
  });

  it("[FR-RUN-04] the recursion limit, trace hook and profile hook come back for the next test case", () => {
    run("import sys\nsys.setrecursionlimit(40)\nsys.settrace(lambda *args: None)");
    const deep =
      "def depth(n):\n    return 0 if n == 0 else 1 + depth(n - 1)\nimport sys\nprint(depth(100), sys.gettrace())";
    expect(run(deep)).toMatchObject({ output: "100 None\n", error: undefined });
  });

  it("[FR-RUN-04] a sys.monitoring callback set by one test case does not reach the next, and its tool id is free again", () => {
    // WP-3.3 security review 2, MINOR 5: before, the next case's output had "MON f".
    const monitor = [
      "import sys",
      "m = sys.monitoring",
      'm.use_tool_id(2, "probe")',
      'm.register_callback(2, m.events.PY_START, lambda code, offset: print("MON", code.co_name))',
      "m.set_events(2, m.events.PY_START)",
    ].join("\n");
    expect(run(monitor).stage).toBe("program");
    const next = run(
      'import sys\ndef f():\n    pass\nf()\nprint(sys.monitoring.get_tool(2), "after")',
    );
    expect(next).toMatchObject({ output: "None after\n", error: undefined });
    expect(run(monitor)).toMatchObject({ stage: "program", error: undefined });
  });

  it("[FR-GRD-01] never raises: a sys.monitoring callback that raises when a harness step starts gives a result, and is removed", () => {
    const source = [
      "import sys",
      "m = sys.monitoring",
      'm.use_tool_id(3, "probe")',
      "def raising(code, offset):",
      '    if code.co_name == "restore":',
      "        raise RuntimeError('in the harness')",
      "m.register_callback(3, m.events.PY_START, raising)",
      "m.set_events(3, m.events.PY_START)",
    ].join("\n");
    expect(run(source)).toEqual({
      version: HARNESS_VERSION,
      stage: "program",
      output: "",
      truncated: false,
      error: { kind: "runtime", message: "" },
    });
    expect(run('print(len("next"))')).toMatchObject({ output: "4\n", error: undefined });
  });

  it("[FR-GRD-01] a sys.monitoring callback that raises on every call makes the harness raise", async () => {
    // No call can run to free the tool, so the harness raises and its caller
    // replaces the runtime (the worker's runtime_crashed, the Node runner's
    // crashed). Its own interpreter: this one cannot run another test case.
    const own = await loadHarness();
    const source = [
      "import sys",
      "m = sys.monitoring",
      'm.use_tool_id(3, "probe")',
      "def raising(*args):",
      "    raise RuntimeError('in the harness')",
      "m.register_callback(3, m.events.CALL, raising)",
      "m.set_events(3, m.events.CALL)",
    ].join("\n");
    expect(() => own.check(source, "", "")).toThrow();
  }, 60_000);

  it("[FR-RUN-04] the exception, unraisable, display and breakpoint hooks come back for the next test case", () => {
    // Pyodide sets its own exception hook, so the hooks are compared with
    // what a test case saw before, not with sys.__excepthook__.
    const hooks =
      "import sys\nprint(sys.excepthook, sys.unraisablehook, sys.displayhook, sys.breakpointhook)";
    const before = run(hooks);
    expect(before.error).toBeUndefined();
    expect(before.output).not.toContain("built-in function print");
    run(
      [
        "import sys",
        "sys.excepthook = print",
        "sys.unraisablehook = print",
        "sys.displayhook = print",
        "sys.breakpointhook = print",
      ].join("\n"),
    );
    expect(run(hooks)).toEqual(before);
  });

  it("[FR-RUN-04] a sys.monitoring callback that takes a freed tool id while the tools are freed is freed too", () => {
    // WP-3.3 security review 4, MINOR 1: with one pass, the next case's output began with "INJECTED".
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
    expect(run(source)).toMatchObject({ stage: "program", error: undefined });
    expect(
      run("def area(w, h):\n    return w * h", { afterCode: "print(area(3, 4))" }),
    ).toMatchObject({ output: "12\n", error: undefined });
    expect(run("import sys\nprint([sys.monitoring.get_tool(t) for t in range(6)])")).toMatchObject({
      output: "[None, None, None, None, None, None]\n",
    });
  });

  it("[FR-GRD-01] a sys.monitoring callback that keeps moving between tool ids makes the harness raise", async () => {
    // Eight passes cannot free it, so the harness raises ToolsInUse (it fails
    // closed) and its caller replaces the runtime. Its own interpreter, as in
    // the test above.
    const own = await loadHarness();
    const source = [
      "import sys",
      "m = sys.monitoring",
      // m is bound now: the harness clears the namespace before its last restore.
      "def hop(code, offset, called, arg0, m=m):",
      "    if called is m.set_events and arg0 in (0, 1) and m.get_tool(1 - arg0) is None:",
      "        other = 1 - arg0",
      '        m.use_tool_id(other, "hop")',
      "        m.register_callback(other, m.events.CALL, hop)",
      "        m.set_events(other, m.events.CALL)",
      'm.use_tool_id(0, "hop")',
      "m.register_callback(0, m.events.CALL, hop)",
      "m.set_events(0, m.events.CALL)",
    ].join("\n");
    let thrown: unknown;
    try {
      own.check(source, "", "");
    } catch (error) {
      thrown = error;
    }
    expect(thrown).toMatchObject({ type: expect.stringContaining("ToolsInUse") });
  }, 60_000);

  it("[FR-RUN-04] the import system's lists come back for the next test case, also when changed in place", () => {
    run(
      [
        "import sys",
        "class Finder:",
        "    def find_spec(self, name, path=None, target=None):",
        '        print("FINDER", name)',
        "        return None",
        "sys.meta_path.insert(0, Finder())",
        'sys.path.append("/nowhere")',
        "sys.path_hooks.append(lambda entry: None)",
        'sys.path_importer_cache["/nowhere"] = None',
      ].join("\n"),
    );
    const check = [
      "import sys",
      "import decimal",
      'print("/nowhere" in sys.path, "/nowhere" in sys.path_importer_cache,',
      '      [type(f).__name__ for f in sys.meta_path].count("Finder"), len(sys.path_hooks))',
    ].join("\n");
    const after = run(check);
    expect(after.error).toBeUndefined();
    expect(after.output).toMatch(/^False False 0 \d+\n$/);
    expect(run(check)).toEqual(after);
  });

  it("[FR-RUN-04] the integer digit limit and the async generator hooks come back for the next test case", () => {
    const settings = "import sys\nprint(sys.get_int_max_str_digits(), sys.get_asyncgen_hooks())";
    const before = run(settings);
    expect(before.error).toBeUndefined();
    run("import sys\nsys.set_int_max_str_digits(640)\nsys.set_asyncgen_hooks(firstiter=print)");
    expect(run(settings)).toEqual(before);
    expect(run("print(len(str(10 ** 1000)))")).toMatchObject({
      output: "1001\n",
      error: undefined,
    });
  });

  it("[FR-RUN-04] a garbage collector callback set by one test case is gone in the next, and does not write into it", () => {
    run('import gc\ngc.callbacks.append(lambda phase, info: print("GC", phase))');
    expect(run("import gc\ngc.collect()\nprint(len(gc.callbacks))")).toMatchObject({
      output: "0\n",
      error: undefined,
    });
  });

  it("[FR-GRD-04] the harness version changes with the harness: this hash is updated together with HARNESS_VERSION", () => {
    // A stale cached worker is refused only if the version moves with the Python.
    // FNV-1a over the UTF-16 code units: the grader's tests stay free of I/O modules.
    let hash = 0x811c9dc5;
    for (let index = 0; index < HARNESS_DEFINITION.length; index += 1) {
      hash = Math.imul(hash ^ HARNESS_DEFINITION.charCodeAt(index), 0x01000193) >>> 0;
    }
    expect({ version: HARNESS_VERSION, hash }).toEqual({ version: "3", hash: 863582379 });
  });
});
