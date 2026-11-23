"use client";

import type { TestCase } from "@/grader/test-case";
import type { RuleState, TimedOutProgram, ValidationRule } from "@/grader/validation";
import { validation as words } from "@/messages/admin";
import { Button, Notice, Status } from "@/ui";
import type { PythonState } from "../client/validation-runtime";
import type { ValidationState } from "../validation-view";

// The checklist of docs/spec/03-experience.md section 7.6 (FR-ADM-06,
// FR-ADM-07): a state per rule, with what to fix when one fails, and
// Validate and Stop. The editor owns the validation; this shows it.

export type ValidationPanelProps = {
  state: ValidationState;
  python: PythonState;
  /** The lesson changed after the last finished validation. */
  outdated: boolean;
  onValidate: () => void;
  onStop: () => void;
  onRetry: () => void;
};

const RULES: readonly ValidationRule[] = [
  "complete",
  "solution_passes",
  "starter_fails",
  "wrong_answers_fail",
  "no_time_limit",
];

type Row = { rule: ValidationRule; state: RuleState["state"]; why: string | undefined };

const statusState = { passed: "pass", failed: "fail", not_run: "not-run" } as const;

function programName(program: TimedOutProgram): string {
  if (program.program === "wrong_answer") return words.program.wrongAnswer(program.index + 1);
  return words.program[program.program];
}

/** What to fix, for a failed rule; the test cases are named as the checked lesson had them. */
function reason(rule: RuleState, testCases: readonly TestCase[]): string | undefined {
  if (rule.state !== "failed") return undefined;
  switch (rule.rule) {
    case "complete":
      return words.missing(rule.missing.map((part) => words.part[part]));
    case "solution_passes":
      return words.solutionFailed(
        rule.testCaseIds.map((id) => {
          const index = testCases.findIndex((testCase) => testCase.id === id);
          return words.testCaseRef(index + 1, testCases[index]?.name ?? "");
        }),
      );
    case "starter_fails":
      return words.starterPasses;
    case "wrong_answers_fail":
      return words.wrongAnswersPass(rule.wrongAnswers.map((index) => index + 1));
    case "no_time_limit":
      return words.timedOut(rule.programs.map(programName));
    default: {
      const unreachable: never = rule;
      return unreachable;
    }
  }
}

function liveText(state: ValidationState): string {
  switch (state.kind) {
    case "idle":
    case "unavailable":
      return "";
    case "running":
      return state.stopping ? words.status.stopping : words.status.running;
    case "stopped":
      return words.status.stopped;
    case "done": {
      const failed = state.rules.filter((rule) => rule.state === "failed").length;
      return failed === 0 ? words.status.passed : words.status.failed(failed);
    }
    default: {
      const unreachable: never = state;
      return unreachable;
    }
  }
}

export function ValidationPanel({
  state,
  python,
  outdated,
  onValidate,
  onStop,
  onRetry,
}: ValidationPanelProps) {
  // Before a finished validation every rule, rule 1 too, is not checked.
  const rows: Row[] =
    state.kind === "done"
      ? state.rules.map((rule) => ({
          rule: rule.rule,
          state: rule.state,
          why: reason(rule, state.checked.testCases),
        }))
      : RULES.map((rule) => ({ rule, state: "not_run", why: undefined }));
  const running = state.kind === "running";
  const live = liveText(state);

  return (
    <div className="flex max-w-prose flex-col gap-5">
      <p className="text-sm text-text-muted">{words.intro}</p>
      <div className="flex flex-wrap items-center gap-3">
        <p className="text-base text-text">
          <span className="text-text-muted">{words.pythonLabel}: </span>
          {words.python[python]}
        </p>
        {python === "failed" && (
          <Button variant="secondary" onPress={onRetry}>
            {words.retry}
          </Button>
        )}
      </div>
      <ol aria-label={words.checklistLabel} className="flex flex-col gap-3">
        {rows.map((row) => (
          <li key={row.rule} className="flex flex-col gap-1">
            <div className="flex flex-wrap items-baseline gap-3">
              <Status state={statusState[row.state]} label={words.state[row.state]} />
              <span className="text-base text-text">{words.rule[row.rule]}</span>
            </div>
            {row.why !== undefined && <p className="text-sm text-text">{row.why}</p>}
          </li>
        ))}
      </ol>
      {state.kind === "done" && outdated && (
        <Notice kind="information" kindLabel={words.outdatedLabel}>
          {words.outdated}
        </Notice>
      )}
      {state.kind === "unavailable" && (
        <Notice kind="error" kindLabel={words.unavailableLabel} announce="assertive">
          {words.unavailable}
        </Notice>
      )}
      <div className="flex flex-wrap gap-3">
        <Button variant="secondary" isPending={running} onPress={onValidate}>
          {running ? words.validating : words.validate}
        </Button>
        {running && (
          <Button variant="secondary" isPending={state.stopping} onPress={onStop}>
            {words.stop}
          </Button>
        )}
      </div>
      {/* Kept in the page for the live region, and out of the layout while empty. */}
      <p role="status" className={live === "" ? "sr-only" : "text-sm text-text-muted"}>
        {live}
      </p>
    </div>
  );
}
