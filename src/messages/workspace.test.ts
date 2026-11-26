import { describe, expect, it } from "vitest";
import { type LearnerErrorKind, learnerErrorHeading, learnerErrorSuggestion } from "./workspace";

// Every kind of learner error has its own words (FR-WSP-09,
// docs/spec/03-experience.md sections 6.5 and 9).

const KINDS: LearnerErrorKind[] = [
  "syntax",
  "runtime",
  "input_ended",
  "time_limit",
  "output_limit",
  "memory",
  "stopped",
  "crashed",
];
const facts = { line: 3, timeLimitSeconds: 5, outputLimit: 64_000 };

describe("learner error words [FR-WSP-09]", () => {
  it("gives each kind its own heading", () => {
    const headings = KINDS.map((kind) => learnerErrorHeading(kind, facts));
    expect(new Set(headings).size).toBe(KINDS.length);
  });

  it("names the line when Python knows it, and reads well when it does not", () => {
    expect(learnerErrorHeading("syntax", facts)).toBe("Python could not read line 3");
    expect(learnerErrorHeading("runtime", { ...facts, line: 7 })).toBe(
      "The program stopped on line 7",
    );
    expect(learnerErrorHeading("syntax", { ...facts, line: undefined })).toBe(
      "Python could not read the program",
    );
  });

  it("states the limits from the numbers it is given", () => {
    expect(learnerErrorHeading("time_limit", facts)).toBe(
      "The program ran for more than 5 seconds",
    );
    expect(learnerErrorSuggestion("output_limit", facts, "interactive")).toContain("64,000");
  });

  it("explains the Input field only where the batch field is there", () => {
    expect(learnerErrorSuggestion("input_ended", facts, "batch")).toContain("Program input");
    expect(learnerErrorSuggestion("input_ended", facts, "interactive")).not.toContain(
      "Program input",
    );
  });

  it("never blames, shouts or uses an em dash", () => {
    const words = KINDS.flatMap((kind) => [
      learnerErrorHeading(kind, facts),
      learnerErrorSuggestion(kind, facts, "batch") ?? "",
      learnerErrorSuggestion(kind, facts, "interactive") ?? "",
    ]).join("\n");
    expect(words).not.toMatch(/[!—]|you made|your mistake|wrong/i);
  });
});
