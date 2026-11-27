import { beforeAll, describe, expect, it } from "vitest";
import { parseHarnessResult } from "@/grader/grade";
import { type HarnessHost, loadHarness } from "@/grader/node-runner/host";
import { learnerErrorSuggestion, pythonErrorExplanations } from "@/messages/workspace";
import { errorExplanation, errorFacts, pythonErrorType, testError } from "./workspace-view";

// FR-WSP-23: a common Python error comes with one sentence on what it means.
// The table is keyed by the name of the error's type; the last block runs
// real programs in Pyodide through the harness (never by mocking Python), so
// each name is checked against the message Python really writes.

describe("pythonErrorType [FR-WSP-23]", () => {
  it("reads the type's name before the first colon", () => {
    expect(pythonErrorType("ZeroDivisionError: division by zero")).toBe("ZeroDivisionError");
    expect(pythonErrorType("NameError: name 'x' is not defined. Did you mean: 'y'?")).toBe(
      "NameError",
    );
  });

  it("reads an error with no text of its own as its name alone", () => {
    expect(pythonErrorType("ValueError")).toBe("ValueError");
  });

  it("finds no name in an empty message or one that does not start with a name", () => {
    expect(pythonErrorType(undefined)).toBeUndefined();
    expect(pythonErrorType("")).toBeUndefined();
    expect(pythonErrorType("not a name: text")).toBeUndefined();
    expect(pythonErrorType("1Error: text")).toBeUndefined();
  });
});

describe("errorExplanation [FR-WSP-23]", () => {
  const runtime = (message: string) => ({ kind: "runtime" as const, message, line: 2 });

  it("explains a common runtime error in its own sentence", () => {
    expect(errorExplanation(runtime("ZeroDivisionError: division by zero"))).toBe(
      pythonErrorExplanations.ZeroDivisionError,
    );
  });

  it("explains nothing for an error type it does not list, so Python's message stands alone", () => {
    expect(errorExplanation(runtime("Exception: my own"))).toBeUndefined();
    expect(errorExplanation(runtime("LookupError: x"))).toBeUndefined();
  });

  it("does not take a name the table inherits, such as constructor", () => {
    expect(errorExplanation(runtime("constructor: x"))).toBeUndefined();
    expect(errorExplanation(runtime("toString"))).toBeUndefined();
  });

  it("explains the two indentation errors among syntax errors, and leaves the others their suggestion", () => {
    expect(
      errorExplanation({ kind: "syntax", message: "IndentationError: unexpected indent", line: 2 }),
    ).toBe(pythonErrorExplanations.IndentationError);
    expect(
      errorExplanation({ kind: "syntax", message: "TabError: inconsistent use of tabs", line: 2 }),
    ).toBe(pythonErrorExplanations.TabError);
    expect(
      errorExplanation({ kind: "syntax", message: "SyntaxError: invalid syntax", line: 2 }),
    ).toBeUndefined();
    expect(learnerErrorSuggestion("syntax", errorFacts(2), "interactive")).toBeDefined();
  });

  it("explains nothing for the errors that already say what happened", () => {
    for (const kind of [
      "input_ended",
      "time_limit",
      "output_limit",
      "memory",
      "stopped",
      "crashed",
    ] as const) {
      expect(errorExplanation({ kind, message: "ZeroDivisionError: x", line: 1 })).toBeUndefined();
    }
  });

  it("is one sentence each, with no exclamation mark (section 9)", () => {
    for (const [name, sentence] of Object.entries(pythonErrorExplanations)) {
      expect(sentence, name).toMatch(/^[A-Z][^!?]*\.$/);
      expect(sentence.slice(0, -1), name).not.toMatch(/[.!?]\s/);
    }
  });
});

describe("the names match what Python writes [FR-WSP-23]", () => {
  let host: HarnessHost;

  beforeAll(async () => {
    host = await loadHarness();
  }, 60_000);

  const PROGRAMS: Record<keyof typeof pythonErrorExplanations, string> = {
    NameError: "print(nmae)",
    UnboundLocalError: "count = 0\ndef add():\n    count += 1\nadd()",
    TypeError: 'print("age: " + 5)',
    ValueError: 'int("hello")',
    ZeroDivisionError: "print(10 / 0)",
    IndexError: "letters = ['a']\nprint(letters[3])",
    KeyError: "ages = {}\nprint(ages['Sara'])",
    AttributeError: "(5).append(1)",
    RecursionError: "def f():\n    return f()\nf()",
    ModuleNotFoundError: "import no_such_module_here",
    OverflowError: "print(2.0 ** 10000)",
    IndentationError: "if True:\nprint(1)",
    TabError: "if True:\n        print(1)\n\tprint(2)",
  };

  it.each(Object.entries(PROGRAMS))("%s", (name, source) => {
    const result = parseHarnessResult(host.check(source, "", ""));
    expect(result?.error, name).toBeDefined();
    const graded = result?.error;
    if (graded === undefined || !("message" in graded)) throw new Error(`${name}: no message`);
    const error = testError(graded);
    expect(pythonErrorType(error.message)).toBe(name);
    expect(errorExplanation(error)).toBe(pythonErrorExplanations[name as keyof typeof PROGRAMS]);
  });
});
