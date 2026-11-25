import { beforeAll, describe, expect, it } from "vitest";
import { type HarnessResult, parseHarnessResult } from "./grade.ts";
import {
  HARNESS_DEFINITION,
  HARNESS_NAME_LIMIT,
  HARNESS_OUTPUT_LIMIT,
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

  it("[FR-GRD-04] the harness version changes with the harness: this hash is updated together with HARNESS_VERSION", () => {
    // A stale cached worker is refused only if the version moves with the Python.
    // FNV-1a over the UTF-16 code units: the grader's tests stay free of I/O modules.
    let hash = 0x811c9dc5;
    for (let index = 0; index < HARNESS_DEFINITION.length; index += 1) {
      hash = Math.imul(hash ^ HARNESS_DEFINITION.charCodeAt(index), 0x01000193) >>> 0;
    }
    expect({ version: HARNESS_VERSION, hash }).toEqual({ version: "1", hash: 74732271 });
  });
});
