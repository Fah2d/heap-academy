import { describe, expect, it } from "vitest";
import { forAll, type Generator, textFrom, tuple } from "../../scripts/testing/property.ts";
import { matches, normalize } from "./compare.ts";

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
