// @vitest-environment jsdom
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { TestCase, TestCaseId } from "@/grader/test-case";
import type { RuleState } from "@/grader/validation";
import { validation as words } from "@/messages/admin";
import type { ValidationContent } from "../client/validate-lesson";
import type { ValidationState } from "../validation-view";
import { ValidationPanel, type ValidationPanelProps } from "./validation-panel";

// The checklist of docs/spec/03-experience.md section 7.6 (FR-ADM-06,
// FR-ADM-07): a state per rule with the reason when it fails, Validate and
// Stop, and the states "Python loading", "validating" and "validation failed".

afterEach(cleanup);

const testCase = (id: string, name: string): TestCase => ({
  id: id as TestCaseId,
  name,
  stdin: "",
  afterCode: "",
  expected: "ok",
  match: "normalized",
  hint: "",
});

const checked: ValidationContent = {
  title: "Hello",
  slug: "hello",
  instructionsMd: "Print ok.",
  starterCode: "",
  solutionCode: "print('ok')",
  wrongAnswers: [],
  testCases: [testCase("t1", "Prints ok"), testCase("t2", "")],
};

const done = (rules: RuleState[], passed = false): ValidationState => ({
  kind: "done",
  rules,
  passed,
  hash: "a".repeat(64),
  solution: undefined,
  checked,
});

function renderPanel(props: Partial<ValidationPanelProps> = {}) {
  const handlers = { onValidate: vi.fn(), onStop: vi.fn(), onRetry: vi.fn() };
  render(
    <ValidationPanel
      state={{ kind: "idle" }}
      python="ready"
      outdated={false}
      {...handlers}
      {...props}
    />,
  );
  return handlers;
}

const items = () =>
  within(screen.getByRole("list", { name: words.checklistLabel })).getAllByRole("listitem");

describe("ValidationPanel [FR-ADM-07]", () => {
  it("lists the five rules in order, not checked before any validation", () => {
    renderPanel();
    const rows = items();
    expect(rows.map((row) => row.textContent)).toEqual([
      `${words.state.not_run}${words.rule.complete}`,
      `${words.state.not_run}${words.rule.solution_passes}`,
      `${words.state.not_run}${words.rule.starter_fails}`,
      `${words.state.not_run}${words.rule.wrong_answers_fail}`,
      `${words.state.not_run}${words.rule.no_time_limit}`,
    ]);
  });

  it("[FR-ADM-06] Validate asks for a validation", async () => {
    const { onValidate } = renderPanel();
    await userEvent.click(screen.getByRole("button", { name: words.validate }));
    expect(onValidate).toHaveBeenCalledTimes(1);
  });

  it("says Python is loading, and that Validate waits for it", () => {
    renderPanel({ python: "loading" });
    expect(screen.getByText(words.python.loading)).toBeTruthy();
    expect(screen.getByRole("button", { name: words.validate })).toBeTruthy();
  });

  it("says Python could not start, and Try again starts it", async () => {
    const { onRetry } = renderPanel({ python: "failed" });
    expect(screen.getByText(words.python.failed)).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: words.retry }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it("while validating: Validate is pending, Stop stops, and the live region says so", async () => {
    const { onStop, onValidate } = renderPanel({ state: { kind: "running", stopping: false } });
    expect(screen.getByRole("status").textContent).toBe(words.status.running);
    await userEvent.click(screen.getByRole("button", { name: words.validating }));
    expect(onValidate).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole("button", { name: words.stop }));
    expect(onStop).toHaveBeenCalledTimes(1);
  });

  it("says a stopped validation decided nothing", () => {
    renderPanel({ state: { kind: "stopped" } });
    expect(screen.getByRole("status").textContent).toBe(words.status.stopped);
    expect(items().every((row) => row.textContent.startsWith(words.state.not_run))).toBe(true);
  });

  it("says when Python could not run the programs", () => {
    renderPanel({ state: { kind: "unavailable" } });
    expect(screen.getByText(words.unavailable)).toBeTruthy();
  });

  it("[FR-GRD-05] gives each failed rule its reason, naming the test cases, wrong answers and programs", () => {
    renderPanel({
      state: done([
        { rule: "complete", state: "passed" },
        { rule: "solution_passes", state: "failed", testCaseIds: ["t1", "t2"] as TestCaseId[] },
        { rule: "starter_fails", state: "failed" },
        { rule: "wrong_answers_fail", state: "failed", wrongAnswers: [0, 2] },
        {
          rule: "no_time_limit",
          state: "failed",
          programs: [{ program: "solution" }, { program: "wrong_answer", index: 1 }],
        },
      ]),
    });
    expect(screen.getByRole("status").textContent).toBe(words.status.failed(4));
    const rows = items();
    expect(rows[0]?.textContent).toBe(`${words.state.passed}${words.rule.complete}`);
    expect(rows[1]?.textContent).toContain(
      words.solutionFailed([words.testCaseRef(1, "Prints ok"), words.testCaseRef(2, "")]),
    );
    expect(rows[2]?.textContent).toContain(words.starterPasses);
    expect(rows[3]?.textContent).toContain(words.wrongAnswersPass([1, 3]));
    expect(rows[4]?.textContent).toContain(
      words.timedOut([words.program.solution, words.program.wrongAnswer(2)]),
    );
  });

  it("names what an incomplete lesson is missing", () => {
    renderPanel({
      state: done([
        { rule: "complete", state: "failed", missing: ["instructions", "test_cases"] },
        { rule: "solution_passes", state: "not_run" },
        { rule: "starter_fails", state: "not_run" },
        { rule: "wrong_answers_fail", state: "not_run" },
        { rule: "no_time_limit", state: "not_run" },
      ]),
    });
    expect(items()[0]?.textContent).toContain(
      words.missing([words.part.instructions, words.part.test_cases]),
    );
  });

  it("says when every rule passed, and when the lesson changed after the validation", () => {
    const passed = done(
      [
        { rule: "complete", state: "passed" },
        { rule: "solution_passes", state: "passed" },
        { rule: "starter_fails", state: "passed" },
        { rule: "wrong_answers_fail", state: "passed" },
        { rule: "no_time_limit", state: "passed" },
      ],
      true,
    );
    renderPanel({ state: passed, outdated: true });
    expect(screen.getByRole("status").textContent).toBe(words.status.passed);
    expect(screen.getByText(words.outdated)).toBeTruthy();
  });
});
