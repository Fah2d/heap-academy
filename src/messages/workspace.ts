// Words of the lesson workspace (docs/spec/03-experience.md section 6). The
// voice of section 9: a patient person beside the learner, short sentences,
// no blame, no exclamation marks in errors.

import { LOCALE } from "./locale";

/** Every kind of learner error the workspace shows (section 6.5; FR-WSP-09). */
export type LearnerErrorKind =
  | "syntax"
  | "runtime"
  | "input_ended"
  | "time_limit"
  | "output_limit"
  | "memory"
  | "stopped"
  | "crashed";

/** What the error words may name: the line, and the limits as numbers. */
export type LearnerErrorFacts = {
  line: number | undefined;
  /** Seconds a program may run. */
  timeLimitSeconds: number;
  /** Characters a program may print. */
  outputLimit: number;
};

const count = (value: number) => value.toLocaleString(LOCALE);

/** One heading in plain words for each kind of error (section 6.5). */
export function learnerErrorHeading(kind: LearnerErrorKind, facts: LearnerErrorFacts): string {
  switch (kind) {
    case "syntax":
      return facts.line === undefined
        ? "Python could not read the program"
        : `Python could not read line ${facts.line}`;
    case "runtime":
      return facts.line === undefined
        ? "The program stopped with an error"
        : `The program stopped on line ${facts.line}`;
    case "input_ended":
      return "The program asked for more input than it got";
    case "time_limit":
      return `The program ran for more than ${facts.timeLimitSeconds} seconds`;
    case "output_limit":
      return "The program printed too much";
    case "memory":
      return "The program used too much memory";
    case "stopped":
      return "You stopped the program";
    case "crashed":
      return "Python stopped unexpectedly";
  }
}

/** One suggestion for each kind of error, or none (section 6.5). */
export function learnerErrorSuggestion(
  kind: LearnerErrorKind,
  facts: LearnerErrorFacts,
  strategy: "interactive" | "batch",
): string | undefined {
  switch (kind) {
    case "syntax":
      return "Look at that line and the one before it for a missing bracket, quote or colon.";
    case "runtime":
      return undefined;
    case "input_ended":
      return strategy === "batch"
        ? "Each input() takes one line from the Program input field. Add a line for each answer."
        : "The program called input() again after the input ended.";
    case "time_limit":
      return "A loop that never ends is the usual cause. Python is starting again by itself.";
    case "output_limit":
      return `A program may print up to ${count(facts.outputLimit)} characters. Look for a loop that prints more than you meant.`;
    case "memory":
      return "A list or text that keeps growing is the usual cause. Python is starting again by itself.";
    case "stopped":
      return "Python is starting again by itself.";
    case "crashed":
      return "Python is starting again by itself. Your code is still here.";
  }
}

/** The button on an error's line, which moves the editor's cursor there. */
export const goToLine = (line: number) => `Go to line ${line}`;
