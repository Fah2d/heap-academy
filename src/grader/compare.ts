// The comparison modes of docs/spec/04-content-system.md section 2.3
// (FR-GRD-03). The same functions decide every verdict, in the worker and in
// the Node runner, so the two cannot disagree on a comparison (FR-GRD-04).

import type { MatchMode } from "./test-case.ts";

/**
 * `normalized`: line endings unified, trailing whitespace removed from each
 * line, trailing blank lines removed. Leading whitespace and letter case stay.
 * "Whitespace" is what `String.prototype.trimEnd` removes, which includes the
 * Unicode spaces a copied example can carry.
 */
export function normalize(text: string): string {
  const lines = text
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map((line) => line.trimEnd());
  while (lines.length > 0 && lines[lines.length - 1] === "") lines.pop();
  return lines.join("\n");
}

/** Whether the program's output matches the expected output under `mode`. */
export function matches(actual: string, expected: string, mode: MatchMode): boolean {
  switch (mode) {
    case "normalized":
      return normalize(actual) === normalize(expected);
    case "exact":
      return actual === expected;
    case "contains":
      return normalize(actual).includes(normalize(expected));
    default: {
      const unreachable: never = mode;
      return unreachable;
    }
  }
}

/**
 * How a failed comparison almost matched (FR-GRD-07; docs/spec/04-content-system.md
 * section 2.3), so the learner is told a difference they cannot see.
 */
export type NearMiss = "letter_case" | "spaces" | "punctuation" | "missing_last_line";

const HORIZONTAL_SPACE = /[^\S\n]/gu;
// Punctuation inside a number stays: the point in 3.5, the comma in 1,000, or
// a sign or point that starts one, as in -5 or .5. "35" for "3.5" is a wrong
// answer, not a slip in commas. A full stop after a number is still punctuation.
const PUNCTUATION = /\p{P}/gu;
const DIGIT = /^\d$/u;
const LETTER_OR_DIGIT = /^[\p{L}\p{N}]$/u;

function inNumber(mark: string, before: string, after: string): boolean {
  if (!DIGIT.test(after)) return false;
  if (DIGIT.test(before)) return true;
  return (mark === "-" || mark === ".") && !LETTER_OR_DIGIT.test(before);
}

/** The text without its punctuation, except punctuation inside a number. */
export function withoutPunctuation(text: string): string {
  return text.replace(PUNCTUATION, (mark: string, offset: number) =>
    inNumber(mark, text.charAt(offset - 1), text.charAt(offset + 1)) ? mark : "",
  );
}

/**
 * The one way `actual` almost matches `expected` under `mode`, or undefined
 * when it matches, differs in more than one way, or the mode is `contains`,
 * where the output may hold anything around the expected text. The texts are
 * compared as the mode compares them: normalized, or exactly.
 */
export function nearMiss(actual: string, expected: string, mode: MatchMode): NearMiss | undefined {
  if (mode === "contains" || matches(actual, expected, mode)) return undefined;
  const a = mode === "normalized" ? normalize(actual) : actual;
  const e = mode === "normalized" ? normalize(expected) : expected;
  if (a.toLowerCase() === e.toLowerCase()) return "letter_case";
  if (a.replace(HORIZONTAL_SPACE, "") === e.replace(HORIZONTAL_SPACE, "")) return "spaces";
  if (withoutPunctuation(a) === withoutPunctuation(e)) return "punctuation";
  // In exact mode both texts usually end with print's line break; it ends
  // the last line and is not a line of its own.
  const bothEnd = a.endsWith("\n") && e.endsWith("\n");
  const actualLines = (bothEnd ? a.slice(0, -1) : a).split("\n");
  const expectedLines = (bothEnd ? e.slice(0, -1) : e).split("\n");
  const last = expectedLines.at(-1) ?? "";
  if (
    a !== "" &&
    last.trim() !== "" &&
    expectedLines.length === actualLines.length + 1 &&
    actualLines.every((line, index) => line === expectedLines[index])
  ) {
    return "missing_last_line";
  }
  return undefined;
}
