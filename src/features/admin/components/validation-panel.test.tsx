// @vitest-environment jsdom
import type { ReactElement } from "react";
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { TestCase, TestCaseId } from "@/grader/test-case";
import type { RuleState } from "@/grader/validation";
import { validation as words } from "@/messages/admin";
import { TIME_LIMIT_MS } from "@/runtime/controller";
import type { ValidationContent } from "../client/validate-lesson";
import type { ValidationState } from "../validation-view";
import { ValidationPanel, type ValidationPanelProps } from "./validation-panel";

// The checklist of docs/spec/03-experience.md section 7.6 (FR-ADM-06,
// FR-ADM-07): a state per rule with the reason when it fails, Validate and
// Stop, and the states "Python loading", "validating" and "validation failed".

afterEach(cleanup);

/**
 * An announced notice's region is in the page first and its words follow a
 * frame later (`LiveRegion`), so a test waits for the words in the region.
 */
async function expectAlert(text: string) {
  await waitFor(() => {
    expect(screen.getByRole("alert").textContent).toBe(text);
  });
}

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

type Handlers = Pick<ValidationPanelProps, "onValidate" | "onStop" | "onRetry" | "onOpenTestCase">;

function panel(props: Partial<ValidationPanelProps>, handlers: Handlers) {
  return (
    <ValidationPanel
      state={{ kind: "idle" }}
      python="ready"
      outdated={false}
      testCases={checked.testCases}
      {...handlers}
      {...props}
    />
  );
}

let rerender: ((ui: ReactElement) => void) | undefined;

function renderPanel(props: Partial<ValidationPanelProps> = {}) {
  const handlers = {
    onValidate: vi.fn(),
    onStop: vi.fn(),
    onRetry: vi.fn(),
    onOpenTestCase: vi.fn(),
  };
  rerender = render(panel(props, handlers)).rerender;
  return handlers;
}

/** The same panel with new props, as the editor gives it after a state change. */
function rerenderPanel(props: Partial<ValidationPanelProps>, handlers: Handlers) {
  if (rerender === undefined) throw new Error("renderPanel first");
  rerender(panel(props, handlers));
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

  it("says Python could not start as an error, and Try again starts it", async () => {
    const { onRetry } = renderPanel({ python: "failed" });
    await expectAlert(`${words.unavailableLabel}: ${words.python.failed}`);
    expect(screen.queryByText(`${words.pythonLabel}:`, { exact: false })).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: words.retry }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it("after Validate with a Python that could not start, points to Try again, in one error", async () => {
    renderPanel({ python: "failed", state: { kind: "unavailable" } });
    expect(screen.getAllByRole("alert")).toHaveLength(1);
    await expectAlert(`${words.unavailableLabel}: ${words.unavailableStart}`);
  });

  it("while Python loads, a pressed Validate says it runs when Python is ready", () => {
    renderPanel({ python: "loading", state: { kind: "running", stopping: false } });
    expect(screen.getByRole("button", { name: words.validatesWhenReady })).toBeTruthy();
  });

  it("while validating: Validate is pending, Stop stops, and the live region says so", async () => {
    const { onStop, onValidate } = renderPanel({ state: { kind: "running", stopping: false } });
    expect(screen.getByRole("status").textContent).toBe(words.status.running);
    await userEvent.click(screen.getByRole("button", { name: words.validating }));
    expect(onValidate).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole("button", { name: words.stop }));
    expect(onStop).toHaveBeenCalledTimes(1);
  });

  it("after Stop, focus goes back to Validate, and Stop is never pending", async () => {
    const handlers = renderPanel({ state: { kind: "running", stopping: false } });
    const stop = screen.getByRole("button", { name: words.stop });
    await userEvent.click(stop);
    expect(handlers.onStop).toHaveBeenCalledTimes(1);
    rerenderPanel({ state: { kind: "running", stopping: true } }, handlers);
    expect(screen.getByRole("status").textContent).toBe(words.status.stopping);
    expect(screen.getByRole("button", { name: words.stop }).getAttribute("data-pending")).toBe(
      null,
    );
    rerenderPanel({ state: { kind: "stopped" } }, handlers);
    expect(screen.queryByRole("button", { name: words.stop })).toBeNull();
    expect(document.activeElement).toBe(screen.getByRole("button", { name: words.validate }));
  });

  it("after Stop, focus the owner moved elsewhere stays there", async () => {
    const handlers = renderPanel({ state: { kind: "running", stopping: false } });
    await userEvent.click(screen.getByRole("button", { name: words.stop }));
    const elsewhere = document.createElement("button");
    document.body.append(elsewhere);
    elsewhere.focus();
    rerenderPanel({ state: { kind: "stopped" } }, handlers);
    expect(document.activeElement).toBe(elsewhere);
    elsewhere.remove();
  });

  it("after a run ends on its own, focus stays where it was", () => {
    const handlers = renderPanel({ state: { kind: "running", stopping: false } });
    rerenderPanel({ state: { kind: "stopped" } }, handlers);
    expect(document.activeElement).toBe(document.body);
  });

  it("says a stopped validation decided nothing", () => {
    renderPanel({ state: { kind: "stopped" } });
    expect(screen.getByRole("status").textContent).toBe(words.status.stopped);
    expect(items().every((row) => row.textContent.startsWith(words.state.not_run))).toBe(true);
  });

  it("says when Python could not run the programs", async () => {
    renderPanel({ state: { kind: "unavailable" } });
    expect(await screen.findByText(words.unavailable)).toBeTruthy();
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
      words.timedOut(TIME_LIMIT_MS / 1000, [words.program.solution, words.program.wrongAnswer(2)]),
    );
    expect(rows[4]?.textContent).toContain(`${String(TIME_LIMIT_MS / 1000)} second`);
  });

  it("[FR-GRD-05] opens each test case the solution failed from the checklist, while it is still in the lesson", async () => {
    const { onOpenTestCase } = renderPanel({
      testCases: [testCase("t2", "")],
      state: done([
        { rule: "complete", state: "passed" },
        { rule: "solution_passes", state: "failed", testCaseIds: ["t1", "t2"] as TestCaseId[] },
        { rule: "starter_fails", state: "passed" },
        { rule: "wrong_answers_fail", state: "passed" },
        { rule: "no_time_limit", state: "passed" },
      ]),
    });
    const row = within(items()[1] as HTMLElement);
    expect(row.getAllByRole("button")).toHaveLength(1);
    await userEvent.click(
      row.getByRole("button", { name: words.openTestCase(words.testCaseRef(1, "")) }),
    );
    expect(onOpenTestCase).toHaveBeenCalledWith("t2");
  });

  it("[FR-GRD-05] names each Open button by the test case's place and name in the list now, after a move or a rename", () => {
    renderPanel({
      testCases: [testCase("t2", ""), testCase("t1", "Prints OK")],
      state: done([
        { rule: "complete", state: "passed" },
        { rule: "solution_passes", state: "failed", testCaseIds: ["t1"] as TestCaseId[] },
        { rule: "starter_fails", state: "passed" },
        { rule: "wrong_answers_fail", state: "passed" },
        { rule: "no_time_limit", state: "passed" },
      ]),
    });
    const row = within(items()[1] as HTMLElement);
    expect(
      row.getByRole("button", { name: words.openTestCase(words.testCaseRef(2, "Prints OK")) }),
    ).toBeDefined();
    expect(row.getAllByRole("button")).toHaveLength(1);
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
