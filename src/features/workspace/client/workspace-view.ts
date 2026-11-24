import { consoleText, lineCount } from "@/domain/workspace/console-text";
import type { GradedError } from "@/grader/grade";
import { TEST_CASE_TIME_LIMIT_MS } from "@/grader/test-case";
import {
  type LearnerErrorFacts,
  type LearnerErrorKind,
  learnerErrorHeading,
  workspace as words,
} from "@/messages/workspace";
import type { RunOutcome, RunResult } from "@/runtime/controller";
import {
  OUTPUT_LIMIT,
  SOURCE_LIMIT,
  STDIN_LINE_LENGTH_LIMIT,
  STDIN_LINE_LIMIT,
} from "@/runtime/protocol";
import type { ConsoleStream, RuntimeView } from "./runtime-view";

// What the workspace shows of a run, worked out from the runtime view. Pure,
// so the words and the transcript are tested without a browser.

export const TIME_LIMIT_SECONDS = TEST_CASE_TIME_LIMIT_MS / 1000;

/** A learner error as the error component shows it (FR-WSP-09). */
export type LearnerError = {
  kind: LearnerErrorKind;
  /** Python's own message, when the error has one. */
  message: string | undefined;
  line: number | undefined;
};

export function errorFacts(line: number | undefined): LearnerErrorFacts {
  return { line, timeLimitSeconds: TIME_LIMIT_SECONDS, outputLimit: OUTPUT_LIMIT };
}

/** The error a run ended with, or undefined when it ended well. */
export function runError(outcome: RunOutcome): LearnerError | undefined {
  if (outcome.kind === "ok") return undefined;
  if ("message" in outcome) {
    return { kind: outcome.kind, message: consoleText(outcome.message), line: outcome.line };
  }
  return { kind: outcome.kind, message: undefined, line: undefined };
}

/** The error a test case's program or follow-up code ended with. */
export function testError(error: GradedError): LearnerError {
  return { kind: error.kind, message: consoleText(error.message), line: error.line };
}

export type Transcript = {
  chunks: { stream: ConsoleStream; text: string }[];
  /**
   * The program's prompt while it waits for an answer: the text it printed
   * after its last line break. The input line shows it as its label, so the
   * transcript leaves it out.
   */
  prompt: string | undefined;
  lines: number;
};

/** The console's transcript, with every chunk made safe to show (T-07). */
export function transcript(output: RuntimeView["output"], awaitingInput: boolean): Transcript {
  const chunks = output
    .map((chunk) => ({ stream: chunk.stream, text: consoleText(chunk.text) }))
    .filter((chunk) => chunk.text !== "");
  const lines = lineCount(chunks.map((chunk) => chunk.text).join(""));
  const last = chunks[chunks.length - 1];
  if (!awaitingInput || last === undefined || last.stream !== "stdout") {
    return { chunks, prompt: undefined, lines };
  }
  const cut = last.text.lastIndexOf("\n") + 1;
  const prompt = last.text.slice(cut);
  if (prompt === "") return { chunks, prompt: undefined, lines };
  const rest = last.text.slice(0, cut);
  const kept =
    rest === "" ? chunks.slice(0, -1) : [...chunks.slice(0, -1), { ...last, text: rest }];
  return { chunks: kept, prompt, lines };
}

/** What the polite live region says once a run ends (section 6.3). */
export function runAnnouncement(result: RunResult, lines: number): string {
  const error = runError(result.outcome);
  if (error === undefined) return words.runFinished(lines);
  return words.runEnded(learnerErrorHeading(error.kind, errorFacts(error.line)), lines);
}

/** What makes a program or its typed-in input too large for the worker to accept. */
export type TooLarge = "source" | "input_lines" | "input_line";

/**
 * Whether the worker would refuse this program or this batch input, by the
 * protocol's own limits, so the workspace can say why instead of doing
 * nothing. The limits count UTF-16 units, as the protocol's parser does.
 */
export function tooLarge(
  source: string,
  stdin: readonly string[] | undefined,
): TooLarge | undefined {
  if (source.length > SOURCE_LIMIT) return "source";
  if (stdin === undefined) return undefined;
  if (stdin.length > STDIN_LINE_LIMIT) return "input_lines";
  if (stdin.some((line) => line.length > STDIN_LINE_LENGTH_LIMIT)) return "input_line";
  return undefined;
}
