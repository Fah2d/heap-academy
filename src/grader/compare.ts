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
