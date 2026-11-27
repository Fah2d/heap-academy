// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";
import type { TestResult } from "@/grader/grade";
import type { TestCase, TestCaseId } from "@/grader/test-case";
import {
  learnerErrorSuggestion,
  pythonErrorExplanations,
  workspace as words,
} from "@/messages/workspace";
import type { RunId } from "@/runtime/protocol";
import { INITIAL_VIEW, type RuntimeView } from "../client/runtime-view";
import { errorFacts } from "../client/workspace-view";
import { ConsolePanel } from "./console-panel";
import { Hints } from "./hints";
import { LearnerErrorView } from "./learner-error-view";
import { TestsPanel } from "./tests-panel";

// T-07: everything a program, a test case or a hint carries is shown as text.
// Markup stays characters, and terminal control sequences are removed.

const MARKUP = `<img src=x onerror="document.title='owned'"><script>document.title='owned'</script>`;
const TITLE_SEQUENCE = "\u001b]0;renamed\u0007";
const CLEAR_SEQUENCE = "\u001b[2J";
const PAYLOAD = `${MARKUP}${TITLE_SEQUENCE}${CLEAR_SEQUENCE}`;

afterEach(() => {
  cleanup();
  document.title = "";
});

function expectInert(container: HTMLElement) {
  expect(container.querySelectorAll("img, script")).toHaveLength(0);
  expect(container.textContent).not.toContain("\u001b");
  expect(container.textContent).not.toContain("\u0007");
  expect(document.title).not.toBe("owned");
}

const ignore = () => undefined;
const consoleProps = {
  awaitingInput: false,
  batchInput: "",
  onBatchInput: ignore,
  sendInput: () => ({ ok: true }) as const,
  endInput: ignore,
  onGoToLine: ignore,
  workspaceRef: { current: null },
  answered: () => false,
  setAnswered: () => undefined,
};

describe("[T-07] the console", () => {
  it("shows standard output and standard error as text, without control sequences", () => {
    const view: RuntimeView = {
      ...INITIAL_VIEW,
      status: "ready",
      output: [
        { stream: "stdout", text: `${PAYLOAD}\n` },
        { stream: "stderr", text: `${PAYLOAD}\n` },
      ],
    };
    const { container } = render(<ConsolePanel {...consoleProps} view={view} />);
    expect(screen.getByTestId("console-output").textContent).toContain(MARKUP);
    expectInert(container);
  });

  it("shows a prompt and Python's error message as text", () => {
    const view: RuntimeView = {
      ...INITIAL_VIEW,
      status: "ready",
      output: [{ stream: "stdout", text: PAYLOAD }],
      result: {
        runId: "run-1" as RunId,
        outcome: { kind: "runtime", message: `ValueError: ${PAYLOAD}`, line: 2 },
        truncated: false,
        durationMs: 5,
      },
    };
    const { container } = render(<ConsolePanel {...consoleProps} view={view} awaitingInput />);
    expect(container.textContent).toContain(`ValueError: ${MARKUP}`);
    expect(screen.getByText(MARKUP, { selector: "label" })).toBeTruthy();
    expectInert(container);
  });
});

const hostileTest: TestCase = {
  id: "hostile" as TestCaseId,
  name: MARKUP,
  stdin: `${MARKUP}\n`,
  afterCode: `print(${JSON.stringify(MARKUP)})`,
  expected: MARKUP,
  match: "exact",
  hint: MARKUP,
};

const failed = (error?: Extract<TestResult, { status: "failed" }>["error"]): TestResult => ({
  testCaseId: hostileTest.id,
  status: "failed",
  reason: error === undefined ? "mismatch" : "after_code_error",
  actual: PAYLOAD,
  truncated: false,
  ...(error !== undefined && { error }),
  harnessVersion: "7",
});

const summary = { total: 1, passed: 0, failed: 1, notRun: 0, allPassed: false, timeLimit: false };

describe("[T-07] the tests panel", () => {
  it("shows a test case's name, input, follow-up code, expected output, actual output and hint as text", () => {
    const { container } = render(
      <TestsPanel
        tests={[hostileTest]}
        results={[failed()]}
        summary={summary}
        checking={false}
        checkEnded
        strategy="interactive"
        onGoToLine={ignore}
      />,
    );
    expect(screen.getAllByText(MARKUP).length).toBeGreaterThanOrEqual(4);
    expect(screen.getByText(words.hint)).toBeTruthy();
    expectInert(container);
  });

  it("shows the name follow-up code missed, and an error message, as text", () => {
    const { container, unmount } = render(
      <TestsPanel
        tests={[hostileTest]}
        results={[failed({ kind: "runtime", message: "NameError", missingName: PAYLOAD })]}
        summary={summary}
        checking={false}
        checkEnded
        strategy="interactive"
        onGoToLine={ignore}
      />,
    );
    expect(container.textContent).toContain(MARKUP);
    expectInert(container);
    unmount();

    const second = render(
      <TestsPanel
        tests={[hostileTest]}
        results={[failed({ kind: "runtime", message: `TypeError: ${PAYLOAD}`, line: 1 })]}
        summary={summary}
        checking={false}
        checkEnded
        strategy="interactive"
        onGoToLine={ignore}
      />,
    );
    expect(second.container.textContent).toContain(`TypeError: ${MARKUP}`);
    expectInert(second.container);
  });
});

describe("[T-07] the error view and hints", () => {
  it("shows an error message as text", () => {
    const { container } = render(
      <LearnerErrorView
        error={{ kind: "syntax", message: MARKUP, line: 3 }}
        strategy="batch"
        onGoToLine={ignore}
      />,
    );
    expect(container.textContent).toContain(MARKUP);
    expectInert(container);
  });

  it("shows a hint as text", async () => {
    const { container } = render(<Hints hints={[MARKUP]} />);
    await userEvent.click(screen.getByRole("button"));
    expect(screen.getByText(MARKUP)).toBeTruthy();
    expectInert(container);
  });
});

describe("[FR-WSP-23] the error view explains a common Python error", () => {
  it("puts one sentence on what the error means under Python's message", () => {
    render(
      <LearnerErrorView
        error={{ kind: "runtime", message: "ZeroDivisionError: division by zero", line: 7 }}
        strategy="interactive"
        onGoToLine={ignore}
      />,
    );
    expect(screen.getByText("ZeroDivisionError: division by zero")).toBeTruthy();
    expect(screen.getByText(pythonErrorExplanations.ZeroDivisionError)).toBeTruthy();
  });

  it("shows the syntax suggestion, not an explanation, for a syntax error that is not about indentation", () => {
    render(
      <LearnerErrorView
        error={{ kind: "syntax", message: "SyntaxError: invalid syntax", line: 3 }}
        strategy="interactive"
        onGoToLine={ignore}
      />,
    );
    expect(
      screen.getByText(learnerErrorSuggestion("syntax", errorFacts(3), "interactive") ?? ""),
    ).toBeTruthy();
  });
});
