import { describe, expect, it } from "vitest";
import { forAll, type Generator, textFrom, tuple } from "../../scripts/testing/property.ts";
import { matches, nearMiss, normalize } from "./compare.ts";

// Characters that matter to the rules: line endings, the whitespace each kind
// of trim sees, letters in both cases, punctuation, and a character outside
// the basic plane.
const ALPHABET = ["a", "B", "z", "Q", "1", " ", "\t", "\n", "\r", "\r\n", " ", ".", "!", "😀", "é"];
const anyText = textFrom(ALPHABET);
/** Text whose first line starts with a visible character and which has one at all. */
const visibleText: Generator<string> = (random) =>
  random.pick(["a", "B", "1", "!"]) + anyText(random);
const trailing: Generator<string> = textFrom([" ", "\t", "\n", "\r\n", " "], 8);

describe("normalize", () => {
  it("[FR-GRD-03] is idempotent", () => {
    forAll(anyText, (text) => normalize(normalize(text)) === normalize(text));
  });

  it("[FR-GRD-03] leaves no carriage return, no trailing whitespace on a line, and no trailing blank line", () => {
    forAll(anyText, (text) => {
      const result = normalize(text);
      return (
        !result.includes("\r") &&
        result.split("\n").every((line) => line === line.trimEnd()) &&
        !result.endsWith("\n")
      );
    });
  });

  it("[FR-GRD-03] unifies line endings", () => {
    forAll(
      anyText,
      (text) =>
        normalize(text.replace(/\r\n?/g, "\n")) === normalize(text.replace(/\r?\n/g, "\r\n")),
    );
  });

  it("[FR-GRD-03] keeps leading whitespace and letter case", () => {
    expect(normalize("  Hello\r\n\tWorld  \n\n\n")).toBe("  Hello\n\tWorld");
  });
});

describe("matches", () => {
  it("[FR-GRD-03] normalized: trailing whitespace, trailing blank lines and line endings never change the verdict", () => {
    forAll(tuple(anyText, trailing), ([text, extra]) => {
      const withCrlf = text.replace(/\r?\n/g, "\r\n");
      return (
        matches(withCrlf + extra, text, "normalized") &&
        matches(text, withCrlf + extra, "normalized")
      );
    });
  });

  it("[FR-GRD-03] normalized: leading whitespace changes the verdict", () => {
    forAll(visibleText, (text) => !matches(` ${text}`, text, "normalized"));
  });

  it("[FR-GRD-03] normalized: letter case changes the verdict", () => {
    forAll(anyText, (text) => {
      if (text.toUpperCase() === text) return true;
      return !matches(text.toUpperCase(), text, "normalized");
    });
  });

  it("[FR-GRD-03] exact: matches only the same text", () => {
    forAll(
      tuple(anyText, anyText),
      ([first, second]) => matches(first, second, "exact") === (first === second),
    );
    expect(matches("Hello\n", "Hello", "exact")).toBe(false);
    expect(matches("Hello\r\n", "Hello\n", "exact")).toBe(false);
  });

  it("[FR-GRD-03] contains: any normalized part of the output matches", () => {
    forAll(tuple(tuple(anyText, visibleText), anyText), ([[before, part], after]) =>
      matches(`${before}\n${part}\n${after}`, part, "contains"),
    );
  });

  it("[FR-GRD-03] contains: whatever matches under normalized also matches under contains", () => {
    forAll(
      tuple(anyText, anyText),
      ([actual, expected]) =>
        !matches(actual, expected, "normalized") || matches(actual, expected, "contains"),
    );
  });

  it("[FR-GRD-03] contains: text missing from the output does not match", () => {
    expect(matches("Hello, Sara!", "Omar", "contains")).toBe(false);
    expect(matches("hello", "Hello", "contains")).toBe(false);
  });

  it("[FR-GRD-03] the prompt is part of the output, with no line break after it", () => {
    expect(
      matches("What is your name? Hello, Sara!\n", "What is your name? Hello, Sara!", "normalized"),
    ).toBe(true);
    expect(
      matches(
        "What is your name? \nHello, Sara!\n",
        "What is your name? Hello, Sara!",
        "normalized",
      ),
    ).toBe(false);
  });
});

describe("nearMiss", () => {
  it("[FR-GRD-07] names a difference only in letter case", () => {
    expect(nearMiss("hello, sara!\n", "Hello, Sara!", "normalized")).toBe("letter_case");
    expect(nearMiss("HELLO", "Hello", "exact")).toBe("letter_case");
  });

  it("[FR-GRD-07] names a difference only in spaces, inside a line or at its start", () => {
    expect(nearMiss("Hello,Sara!", "Hello, Sara!", "normalized")).toBe("spaces");
    expect(nearMiss("  total: 3", "total: 3", "normalized")).toBe("spaces");
    expect(nearMiss("a  b\nc", "a b\nc", "normalized")).toBe("spaces");
    // Exact compares every character, so a trailing space is a near miss there.
    expect(nearMiss("Hello ", "Hello", "exact")).toBe("spaces");
  });

  it("[FR-GRD-07] names a difference only in punctuation", () => {
    expect(nearMiss("Hello Sara", "Hello, Sara!", "normalized")).toBe("punctuation");
    expect(nearMiss('It is "done"', "It is 'done'", "normalized")).toBe("punctuation");
    expect(nearMiss("Total. 3", "Total: 3", "normalized")).toBe("punctuation");
  });

  it("[FR-GRD-07] names a missing last line", () => {
    expect(nearMiss("3\n2\n1\n", "3\n2\n1\nLift off", "normalized")).toBe("missing_last_line");
    expect(nearMiss("a", "a\nb", "exact")).toBe("missing_last_line");
    // As print writes it in exact mode: every line, the last included, ends with a line break.
    expect(nearMiss("3\n2\n1\n", "3\n2\n1\nLift off\n", "exact")).toBe("missing_last_line");
  });

  it("[FR-GRD-07] does not call a wrong number a punctuation slip", () => {
    expect(nearMiss("35", "3.5", "normalized")).toBeUndefined();
    expect(nearMiss("5", "-5", "normalized")).toBeUndefined();
    expect(nearMiss("Total 1000", "Total 1,000", "normalized")).toBeUndefined();
    // Punctuation away from digits still counts.
    expect(nearMiss("Total 3", "Total: 3", "normalized")).toBe("punctuation");
  });

  it("[FR-GRD-07] names nothing when the output matches", () => {
    expect(nearMiss("Hello  \n\n", "Hello", "normalized")).toBeUndefined();
    forAll(anyText, (text) => nearMiss(text, text, "normalized") === undefined);
    forAll(anyText, (text) => nearMiss(text, text, "exact") === undefined);
  });

  it("[FR-GRD-07] names nothing when the output differs in more than one way, or in words", () => {
    expect(nearMiss("hello sara", "Hello, Sara!", "normalized")).toBeUndefined();
    expect(nearMiss("Goodbye", "Hello", "normalized")).toBeUndefined();
    expect(nearMiss("3\n2\n", "3\n2\n1\nLift off", "normalized")).toBeUndefined();
    expect(nearMiss("2\n1", "3\n2\n1", "normalized")).toBeUndefined();
  });

  it("[FR-GRD-07] does not call no output at all a missing last line", () => {
    expect(nearMiss("", "Hello", "normalized")).toBeUndefined();
  });

  it("[FR-GRD-07] does not call a missing line break at the end a missing line", () => {
    expect(nearMiss("Hello", "Hello\n", "exact")).toBeUndefined();
  });

  it("[FR-GRD-07] names nothing in contains mode, where other output is allowed", () => {
    expect(nearMiss("HELLO", "Hello", "contains")).toBeUndefined();
  });

  it("[FR-GRD-07] a named difference is the only one: removing it makes the texts equal", () => {
    forAll(tuple(anyText, anyText), ([actual, expected]) => {
      const kind = nearMiss(actual, expected, "normalized");
      const a = normalize(actual);
      const e = normalize(expected);
      switch (kind) {
        case undefined:
          return true;
        case "letter_case":
          return a.toLowerCase() === e.toLowerCase();
        case "spaces":
          return a.replace(/[^\S\n]/gu, "") === e.replace(/[^\S\n]/gu, "");
        case "punctuation":
          return a.replace(/(?<!\d)\p{P}(?!\d)/gu, "") === e.replace(/(?<!\d)\p{P}(?!\d)/gu, "");
        case "missing_last_line": {
          // Normalized text never ends with a line break, so a and e are whole lines.
          return e.startsWith(`${a}\n`) && !e.slice(a.length + 1).includes("\n");
        }
      }
    });
  });
});
