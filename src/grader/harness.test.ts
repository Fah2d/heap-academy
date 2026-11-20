import { beforeAll, describe, expect, it } from "vitest";
import { type HarnessResult, parseHarnessResult } from "./grade.ts";
import { HARNESS_OUTPUT_LIMIT, HARNESS_VERSION } from "./harness.ts";
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

  it("[FR-RUN-04] the follow-up code gets the builtins back even when the program deleted them", () => {
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
});
