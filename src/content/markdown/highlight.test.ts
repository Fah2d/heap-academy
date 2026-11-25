import { describe, expect, it } from "vitest";
import { highlightCode, isPython, MAX_HIGHLIGHT } from "./highlight";

// Fenced Python is highlighted with the palette of DESIGN.md section 4.4
// (docs/spec/04-content-system.md section 5). The runs are text only.

const kinds = (code: string) =>
  highlightCode(code, "python")
    .filter((run) => run.kind !== undefined)
    .map((run) => `${run.kind}:${run.text}`);

describe("highlightCode", () => {
  it("gives back the code exactly, whatever it holds", () => {
    for (const code of [
      'name = input()\nprint("Hello,", name)\n',
      "<script>alert(1)</script>",
      "def f(:\n  ''' unclosed",
      "",
    ]) {
      expect(
        highlightCode(code, "python")
          .map((run) => run.text)
          .join(""),
      ).toBe(code);
    }
  });

  it("marks keywords, strings, numbers, functions, built-ins and comments", () => {
    expect(
      kinds('def greet(name):\n    # say it\n    return len("hi") + 2 if True else None\n'),
    ).toEqual([
      "keyword:def",
      "function:greet",
      "comment:# say it",
      "keyword:return",
      "builtin:len",
      'string:"hi"',
      "number:2",
      "keyword:if",
      "number:True",
      "keyword:else",
      "number:None",
    ]);
  });

  it("marks a call of print as a built-in", () => {
    expect(kinds('print("x")')).toContain("builtin:print");
  });

  it("leaves other languages, no language, and very long code plain", () => {
    expect(highlightCode("SELECT 1", "sql")).toEqual([{ text: "SELECT 1" }]);
    expect(highlightCode("x = 1", undefined)).toEqual([{ text: "x = 1" }]);
    const long = "x = 1\n".repeat(MAX_HIGHLIGHT);
    expect(highlightCode(long, "python")).toEqual([{ text: long }]);
    expect(isPython("Python")).toBe(true);
    expect(isPython("py")).toBe(true);
  });
});
