import { describe, expect, it } from "vitest";
import type { RunId } from "@/runtime/protocol";
import type { RunResult } from "@/runtime/controller";
import {
  runAnnouncement,
  runError,
  testError,
  TIME_LIMIT_SECONDS,
  transcript,
} from "./workspace-view";

// What the workspace shows of a run: the error in learner language
// (FR-WSP-09), the transcript made safe (T-07) with the prompt on the input
// line (FR-WSP-08), and the words said when a run ends (NFR-A11Y-04).

const result = (outcome: RunResult["outcome"]): RunResult => ({
  runId: 1 as unknown as RunId,
  outcome,
  truncated: false,
  durationMs: 12,
});

describe("runError [FR-WSP-09]", () => {
  it("is nothing for a run that ended well", () => {
    expect(runError({ kind: "ok" })).toBeUndefined();
  });

  it("keeps Python's message and line, without escape sequences", () => {
    expect(
      runError({
        kind: "runtime",
        message: "ZeroDivisionError: division by zero\u001b[0m",
        line: 7,
      }),
    ).toEqual({ kind: "runtime", message: "ZeroDivisionError: division by zero", line: 7 });
    expect(runError({ kind: "syntax", message: "invalid syntax" })).toEqual({
      kind: "syntax",
      message: "invalid syntax",
      line: undefined,
    });
  });

  it("has no message for the outcomes the page decides", () => {
    for (const kind of ["time_limit", "stopped", "crashed"] as const) {
      expect(runError({ kind })).toEqual({ kind, message: undefined, line: undefined });
    }
  });

  it("reads a test case's error the same way", () => {
    expect(
      testError({ kind: "runtime", message: "NameError: name 'x' is not defined", line: 2 }),
    ).toEqual({
      kind: "runtime",
      message: "NameError: name 'x' is not defined",
      line: 2,
    });
  });
});

describe("transcript [T-07] [FR-WSP-08]", () => {
  it("drops control characters and empty chunks, and counts lines", () => {
    const shown = transcript(
      [
        { stream: "stdout", text: "a\u0007\n" },
        { stream: "stderr", text: "\u001b[31m" },
        { stream: "stderr", text: "oops\n" },
      ],
      false,
    );
    expect(shown.chunks).toEqual([
      { stream: "stdout", text: "a\n" },
      { stream: "stderr", text: "oops\n" },
    ]);
    expect(shown.lines).toBe(2);
    expect(shown.prompt).toBeUndefined();
  });

  it("moves the prompt to the input line while the program waits", () => {
    const shown = transcript([{ stream: "stdout", text: "Hi\nWhat is your name? " }], true);
    expect(shown.prompt).toBe("What is your name? ");
    expect(shown.chunks).toEqual([{ stream: "stdout", text: "Hi\n" }]);
  });

  it("drops the whole chunk when it is only the prompt", () => {
    const shown = transcript(
      [
        { stream: "input", text: "Ada\n" },
        { stream: "stdout", text: "Age? " },
      ],
      true,
    );
    expect(shown.prompt).toBe("Age? ");
    expect(shown.chunks).toEqual([{ stream: "input", text: "Ada\n" }]);
  });

  it("has no prompt when the program printed none, or is not waiting", () => {
    expect(transcript([{ stream: "stdout", text: "line\n" }], true).prompt).toBeUndefined();
    expect(transcript([{ stream: "stderr", text: "warn" }], true).prompt).toBeUndefined();
    expect(transcript([], true).prompt).toBeUndefined();
    expect(transcript([{ stream: "stdout", text: "Age? " }], false).prompt).toBeUndefined();
  });
});

describe("runAnnouncement [NFR-A11Y-04]", () => {
  it("says the run finished and how many lines it printed", () => {
    expect(runAnnouncement(result({ kind: "ok" }), 3)).toBe("Run finished. 3 lines of output.");
    expect(runAnnouncement(result({ kind: "ok" }), 1)).toBe("Run finished. 1 line of output.");
  });

  it("names the error in learner language", () => {
    expect(runAnnouncement(result({ kind: "time_limit" }), 0)).toBe(
      `The program ran for more than ${TIME_LIMIT_SECONDS} seconds. 0 lines of output.`,
    );
    expect(runAnnouncement(result({ kind: "syntax", message: "invalid syntax", line: 3 }), 0)).toBe(
      "Python could not read line 3. 0 lines of output.",
    );
  });
});
