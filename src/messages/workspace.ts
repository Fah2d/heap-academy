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

/**
 * One sentence on what a common Python error means, by the name of its type
 * (FR-WSP-23; section 6.5). An error not listed here shows Python's message
 * alone.
 */
export const pythonErrorExplanations = {
  NameError:
    "Python does not know this name: it was not given a value before this line, or it is spelled differently.",
  UnboundLocalError: "A function used a name before giving it a value inside that function.",
  TypeError: "An operation got a kind of value it cannot use, such as adding a number to text.",
  ValueError: 'A function got the right kind of value but one it cannot use, such as int("hello").',
  ZeroDivisionError: "A number was divided by zero, which has no answer.",
  IndexError:
    "The program asked for a position past the end of a list or text, and positions start at 0.",
  KeyError: "The program asked a dictionary for a key it does not have.",
  AttributeError:
    "The name after the dot does not belong to this kind of value, so check its spelling.",
  RecursionError: "A function kept calling itself and never stopped.",
  ModuleNotFoundError: "Python cannot find a module with this name, so check its spelling.",
  OverflowError: "A number grew too large for this operation.",
  IndentationError: "The spaces at the start of this line do not match the lines around it.",
  TabError: "This line mixes tabs and spaces at its start, so use spaces only.",
} as const satisfies Record<string, string>;

/**
 * The symbol row above the phone's keyboard in the Code view (FR-WSP-21;
 * section 6.8), in the order the section lists. `shown` is the key's face;
 * `name` is what assistive technology reads.
 */
export const symbolRow = {
  label: "Symbols",
  keys: [
    { insert: "indent", shown: "Tab", name: "Tab" },
    { insert: ":", shown: ":", name: "Colon" },
    { insert: "(", shown: "(", name: "Opening bracket" },
    { insert: ")", shown: ")", name: "Closing bracket" },
    { insert: "[", shown: "[", name: "Opening square bracket" },
    { insert: "]", shown: "]", name: "Closing square bracket" },
    { insert: '"', shown: '"', name: "Double quote" },
    { insert: "'", shown: "'", name: "Single quote" },
    { insert: "=", shown: "=", name: "Equals sign" },
    { insert: "#", shown: "#", name: "Hash" },
    { insert: "_", shown: "_", name: "Underscore" },
  ],
} as const;

/** The button on an error's line, which moves the editor's cursor there. */
export const goToLine = (line: number) => `Go to line ${line}`;

/** Why a test case failed (the grader's `FailureReason`, docs/spec/04-content-system.md section 2.2). */
export type FailureReasonWord =
  | "mismatch"
  | "program_error"
  | "after_code_error"
  | "output_limit"
  | "time_limit"
  | "stopped"
  | "crashed";

/** How a failed comparison almost matched (the grader's `NearMiss`, FR-GRD-07). */
export type NearMissWord = "letter_case" | "spaces" | "punctuation" | "missing_last_line";

const megabytes = (bytes: number) =>
  (bytes / 1_000_000).toLocaleString(LOCALE, {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  });

const lines = (value: number) => (value === 1 ? "1 line" : `${count(value)} lines`);

/** Words of the lesson workspace's page, panes and controls (section 6). */
export const workspace = {
  /** The page title: the lesson, then its course. */
  metaTitle: (lesson: string, course: string) => `${lesson} · ${course}`,
  backToCourse: (course: string) => `Back to ${course}`,
  instructions: "Instructions",
  work: "Your code",
  output: "Output",
  /** The tab list of the three views below 768 px (section 6.8), and its tabs. */
  views: "View",
  viewLesson: "Lesson",
  viewCode: "Code",
  viewOutput: "Output",
  /** The last action of the Lesson view below 768 px. */
  toCode: "Write your code",
  lessons: "Lessons",
  previous: "Previous lesson",
  next: "Next lesson",
  /** A neighbour's title is read after the direction. */
  neighbour: (direction: string, title: string) => `${direction}: ${title}`,
  noPrevious: "This is the first lesson",
  noNext: "This is the last lesson",

  run: "Run",
  check: "Check",
  stop: "Stop",
  /** A Run or Check pressed while Python starts is kept (section 6.7). */
  runPending: "Runs when Python is ready",
  checkPending: "Checks when Python is ready",
  /** The shortcut shown on a button, as the keys read on this system. */
  shortcut: (apple: boolean, shift: boolean) =>
    `${apple ? "⌘" : "Ctrl"}${shift ? " Shift" : ""} Enter`,

  starting: "Starting Python",
  /** Bytes of Python downloaded, in megabytes: "2.7 of 5.5 MB". */
  progress: (loaded: number, total: number) => `${megabytes(loaded)} of ${megabytes(total)} MB`,
  restarting: "Restarting Python",
  failed: "Python could not start. Your code is safe here.",
  retry: "Retry",

  restored: "Your code from your last visit is back.",
  reset: "Reset code",
  resetTitle: "Reset to the starter code?",
  resetBody:
    "Your code will be replaced with the lesson's starter code. You can undo this straight after.",
  resetConfirm: "Reset code",
  cancel: "Cancel",
  resetDone: "Your code was reset to the starter code.",
  undo: "Undo",

  hints: "Hints",
  showHint: "Show a hint",
  showNextHint: "Show another hint",
  hintHeading: (index: number, total: number) => `Hint ${index} of ${total}`,

  console: "Console",
  tests: "Tests",
  consoleEmpty: "Press Run to see what your program prints.",
  consoleLabel: "Program output",
  errorOutput: "Error output",
  batchLabel: "Program input, one answer per line",
  batchHint:
    "This browser cannot pause a program to ask you, so type the answers before you press Run. Each input() takes the next line.",
  answerLabel: "Your answer",
  send: "Send",
  endInput: "End input",
  answerRefused: (limit: number) => `An answer can be up to ${count(limit)} characters.`,
  /** Run or Check refused because the program or its input is over a limit. */
  tooLarge: (kind: "source" | "input_lines" | "input_line", limit: number) =>
    kind === "source"
      ? `This program is too long to run. A program can be up to ${count(limit)} characters.`
      : kind === "input_lines"
        ? `There are too many lines of input. A run can take up to ${count(limit)} lines.`
        : `A line of input is too long. Each line can be up to ${count(limit)} characters.`,
  truncated: (limit: number) => `Output stopped after ${count(limit)} characters.`,
  truncatedShort: "Your output was cut at the limit, so only its start is shown.",

  /** Said once a run ends (section 6.3): its outcome and how many lines it printed. */
  runFinished: (printed: number) => `Run finished. ${lines(printed)} of output.`,
  runEnded: (heading: string, printed: number) => `${heading}. ${lines(printed)} of output.`,

  testsBefore: "Check runs these tests on your code.",
  noTests: "This lesson has no test case yet, so Check has nothing to run.",
  checking: "Checking your code",
  summary: (passed: number, total: number) => `${passed} of ${total} tests passed`,
  // The completion moment (section 6.6; FR-WSP-06). A lesson's XP counts once.
  completeFirst: (xp: number) => `Lesson complete. You earned ${xp} XP.`,
  completeAgain: "Lesson complete. Its XP counted the first time you passed it.",
  // The admin's preview (section 7.7; FR-ADM-08): it records nothing.
  previewKind: "Preview",
  previewBody:
    "This is the lesson's last saved version in the learners' workspace. Nothing here is recorded: not your code, and not a pass.",
  previewComplete: "Every test passed. Nothing was recorded.",
  // Storage refused (FR-PRG-01): what is kept lasts only while the tab is open.
  memoryTitle: "This browser is not saving your work.",
  memoryBody: "Your code and completed lessons are lost when you reload or leave this page.",
  // A pass the account does not have yet (FR-PRG-06).
  unsyncedTitle: "A completed lesson is not saved to your account yet.",
  unsyncedBody: "We will try again.",
  passed: "Passed",
  failedTest: "Failed",
  notRun: "Not run",
  input: "Input",
  noInput: "No input",
  expected: "Expected output",
  actual: "Your output",
  nothingPrinted: "Nothing was printed.",
  thenThisRuns: "Then this runs",
  hint: "Hint",
  /** Why a test failed, beyond the comparison (section 2.2). */
  failure: (reason: FailureReasonWord, timeLimitSeconds: number): string => {
    switch (reason) {
      case "mismatch":
        return "Your output is different from the expected output.";
      case "program_error":
        return "Your program stopped with an error.";
      case "after_code_error":
        return "The test's own code stopped with an error.";
      case "output_limit":
        return "Your program printed too much.";
      case "time_limit":
        return `Your program ran for more than ${timeLimitSeconds} seconds.`;
      case "stopped":
        return "You stopped the check.";
      case "crashed":
        return "Python stopped unexpectedly during this test.";
    }
  },
  /**
   * After "Your output is different", how it almost matched (FR-GRD-07):
   * the differences a beginner cannot see, named in words.
   */
  nearMiss: (kind: NearMissWord): string => {
    switch (kind) {
      case "letter_case":
        return "The only difference is capital and small letters.";
      case "spaces":
        return "The only difference is spaces.";
      case "punctuation":
        return "The only difference is punctuation, such as commas, full stops or quotes.";
      case "missing_last_line":
        return "Everything matches except the last line, which your output does not have.";
    }
  },
  /** Follow-up code that names something the program did not define (section 2.2). */
  needsName: (name: string) => `This test needs something named ${name}.`,

  errorKind: "Error",
  warningKind: "Warning",
  unsupportedTitle: "This browser cannot run Python.",
  unsupportedBody:
    "The lessons run Python inside the browser, and this one is missing what that needs. Open this page in a recent version of Chrome, Edge, Firefox or Safari.",
  information: "Information",
} as const;
