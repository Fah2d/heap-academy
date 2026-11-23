"use client";

import { useEffect, useRef } from "react";
import { CHECK_TEST_LIMIT, MATCH_MODES, type MatchMode, type TestCase } from "@/grader/test-case";
import type { TestCaseId } from "@/grader/test-case";
import {
  addTestCase,
  duplicateTestCase,
  moveTestCase,
  removeTestCase,
  type TestCaseProblem,
} from "@/grader/test-case-list";
import { validation, testCaseList as words } from "@/messages/admin";
import { Button, Disclosure, SelectField, Status, TextArea, TextField } from "@/ui";
import type { MoveDirection } from "../types";
import type { SolutionVerdict, SolutionView } from "../validation-view";
import { focusMoved, MoveButtons } from "./structure-controls";

// The test case list of the lesson editor (docs/spec/03-experience.md
// section 7.5; FR-ADM-05). The list rules and limits are the grader's, so the
// editor, the save action and the database agree on them. Which test cases
// are open belongs to the editor, so a save that finds a problem can open the
// test case that has it before focus moves there.

type TextKey = "name" | "stdin" | "expected" | "hint" | "afterCode";

export type TestCaseListProps = {
  testCases: readonly TestCase[];
  onChange: (next: TestCase[]) => void;
  /** Problems found at the last save, by test case. */
  problems: ReadonlyMap<TestCaseId, readonly TestCaseProblem[]>;
  /** The solution's result at the last validation, for each test case it still describes. */
  solution?: ReadonlyMap<TestCaseId, SolutionView>;
  expanded: ReadonlySet<string>;
  onExpandedChange: (id: string, isExpanded: boolean) => void;
  /** A new test case ID. Comes from the caller so the list stays free of randomness. */
  newId: () => string;
};

type FocusTarget =
  | { kind: "name"; id: string }
  | { kind: "trigger"; id: string }
  | { kind: "expected"; id: string }
  | { kind: "move"; id: string; direction: MoveDirection }
  | { kind: "add" };

function problemText(problem: TestCaseProblem): string {
  if (problem.code === "missing") return words.problem.nameMissing;
  return words.problem.tooLong[problem.field](problem.limit);
}

const isMatchMode = (value: string): value is MatchMode =>
  MATCH_MODES.some((mode) => mode === value);

export function TestCaseList({
  testCases,
  onChange,
  problems,
  solution = new Map(),
  expanded,
  onExpandedChange,
  newId,
}: TestCaseListProps) {
  const root = useRef<HTMLDivElement>(null);
  // Where focus goes once the list renders again after a change, so it never
  // falls back to the page.
  const focusAfter = useRef<FocusTarget | null>(null);
  useEffect(() => {
    const target = focusAfter.current;
    if (target === null || root.current === null) return;
    focusAfter.current = null;
    if (target.kind === "move") {
      focusMoved(root.current, target.id, target.direction);
      return;
    }
    const selector =
      target.kind === "add"
        ? "[data-add-test-case] button"
        : target.kind === "name"
          ? `[data-test-case="${target.id}"] [role="group"] input`
          : target.kind === "expected"
            ? `[data-test-case="${target.id}"] [data-expected] textarea`
            : `[data-test-case="${target.id}"] button[slot="trigger"]`;
    root.current.querySelector<HTMLElement>(selector)?.focus();
  }, [testCases]);

  const full = testCases.length >= CHECK_TEST_LIMIT;

  function addAndOpen(change: ReturnType<typeof addTestCase>, id: string) {
    if (!change.ok) return;
    onExpandedChange(id, true);
    focusAfter.current = { kind: "name", id };
    onChange(change.value);
  }

  function edit(index: number, next: Partial<TestCase>) {
    onChange(testCases.map((testCase, at) => (at === index ? { ...testCase, ...next } : testCase)));
  }

  return (
    <div ref={root} className="flex flex-col gap-4">
      <p className="max-w-prose text-sm text-text-muted">{words.intro}</p>
      {testCases.length === 0 && <p className="text-sm text-text-muted">{words.empty}</p>}
      {testCases.length > 0 && (
        <ol className="flex flex-col gap-3">
          {testCases.map((testCase, index) => {
            const number = index + 1;
            const title = words.title(number, testCase.name);
            const label = testCase.name.trim() === "" ? words.group(number) : testCase.name;
            const found = problems.get(testCase.id) ?? [];
            const result = solution.get(testCase.id);
            const problemFor = (field: TextKey) => found.find((entry) => entry.field === field);
            const text = (field: TextKey) => {
              const problem = problemFor(field);
              return {
                isInvalid: problem !== undefined,
                ...(problem === undefined ? {} : { errorMessage: problemText(problem) }),
              };
            };
            return (
              <li
                key={testCase.id}
                data-test-case={testCase.id}
                className="rounded-panel border border-border px-4 py-2"
              >
                <Disclosure
                  title={title}
                  level={3}
                  isExpanded={expanded.has(testCase.id)}
                  onExpandedChange={(isOpen) => onExpandedChange(testCase.id, isOpen)}
                >
                  <div
                    role="group"
                    aria-label={words.group(number)}
                    className="flex flex-col gap-5 pbs-2"
                  >
                    <TextField
                      label={words.nameLabel}
                      description={words.nameHint}
                      value={testCase.name}
                      onChange={(name) => edit(index, { name })}
                      {...text("name")}
                    />
                    <div className="grid grid-cols-2 gap-6">
                      <TextArea
                        label={words.stdinLabel}
                        description={words.stdinHint}
                        mono
                        rows={4}
                        value={testCase.stdin}
                        onChange={(stdin) => edit(index, { stdin })}
                        {...text("stdin")}
                      />
                      <div data-expected className="flex flex-col gap-2">
                        <TextArea
                          label={words.expectedLabel}
                          description={words.expectedHint}
                          mono
                          rows={4}
                          value={testCase.expected}
                          onChange={(expected) => edit(index, { expected })}
                          {...text("expected")}
                        />
                        {result?.fillable === true && (
                          <div>
                            <Button
                              variant="secondary"
                              aria-label={validation.fillLabel(label)}
                              onPress={() => {
                                focusAfter.current = { kind: "expected", id: testCase.id };
                                edit(index, { expected: result.actual });
                              }}
                            >
                              {validation.fill}
                            </Button>
                          </div>
                        )}
                      </div>
                    </div>
                    {result !== undefined && <SolutionResult view={result} />}
                    <div className="max-w-prose">
                      <SelectField
                        label={words.matchLabel}
                        description={words.matchHint}
                        value={testCase.match}
                        options={MATCH_MODES.map((mode) => ({
                          value: mode,
                          label: words.match[mode],
                        }))}
                        onChange={(match) => {
                          if (isMatchMode(match)) edit(index, { match });
                        }}
                      />
                    </div>
                    <div className="max-w-prose">
                      <TextField
                        label={words.hintLabel}
                        description={words.hintHint}
                        value={testCase.hint}
                        onChange={(hint) => edit(index, { hint })}
                        {...text("hint")}
                      />
                    </div>
                    <TextArea
                      label={words.afterCodeLabel}
                      description={words.afterCodeHint}
                      mono
                      rows={4}
                      value={testCase.afterCode}
                      onChange={(afterCode) => edit(index, { afterCode })}
                      {...text("afterCode")}
                    />
                    <div className="flex flex-wrap gap-2">
                      {!full && (
                        <Button
                          variant="secondary"
                          aria-label={words.duplicate(label)}
                          onPress={() => {
                            const id = newId();
                            addAndOpen(duplicateTestCase(testCases, index, id), id);
                          }}
                        >
                          {words.duplicateShort}
                        </Button>
                      )}
                      <MoveButtons
                        name={label}
                        itemId={testCase.id}
                        isFirst={index === 0}
                        isLast={index === testCases.length - 1}
                        isPending={false}
                        onMove={(direction) => {
                          focusAfter.current = { kind: "move", id: testCase.id, direction };
                          onChange(moveTestCase(testCases, index, direction));
                        }}
                      />
                      <Button
                        variant="destructive"
                        aria-label={words.remove(label)}
                        onPress={() => {
                          const rest = removeTestCase(testCases, index);
                          const next = rest[index] ?? rest[index - 1];
                          focusAfter.current =
                            next === undefined ? { kind: "add" } : { kind: "trigger", id: next.id };
                          onChange(rest);
                        }}
                      >
                        {words.removeShort}
                      </Button>
                    </div>
                  </div>
                </Disclosure>
              </li>
            );
          })}
        </ol>
      )}
      {full ? (
        <p className="text-sm text-text-muted">{words.full}</p>
      ) : (
        <div data-add-test-case>
          <Button
            variant="secondary"
            onPress={() => {
              const id = newId();
              addAndOpen(addTestCase(testCases, id), id);
            }}
          >
            {words.add}
          </Button>
        </div>
      )}
    </div>
  );
}

const statusState = { pass: "pass", fail: "fail", not_run: "not-run" } as const;

function verdictDetail(verdict: SolutionVerdict): string[] {
  if (verdict.state !== "fail") return [];
  const { error } = verdict;
  return [
    validation.reason[verdict.reason],
    ...(error === undefined ? [] : [validation.error(error.message, error.line)]),
  ];
}

/** What the solution printed for one test case, and its verdict while that still applies. */
function SolutionResult({ view }: { view: SolutionView }) {
  return (
    <div data-solution className="flex flex-col gap-2 rounded-panel border border-border p-3">
      <div className="flex flex-wrap items-center gap-3">
        <h4 className="text-base font-medium text-text">{validation.solutionHeading}</h4>
        {view.verdict !== undefined && (
          <Status
            state={statusState[view.verdict.state]}
            label={validation.verdict[view.verdict.state]}
          />
        )}
      </div>
      {view.verdict === undefined ? (
        <p className="text-sm text-text-muted">{validation.verdictOutdated}</p>
      ) : (
        verdictDetail(view.verdict).map((line) => (
          <p key={line} className="text-sm text-text">
            {line}
          </p>
        ))
      )}
      {view.actual === "" ? (
        <p className="text-sm text-text-muted">{validation.noOutput}</p>
      ) : (
        <pre
          data-testid="solution-output"
          className="code-surface overflow-x-auto whitespace-pre-wrap"
          tabIndex={0}
        >
          {view.actual}
        </pre>
      )}
      {view.truncated && <p className="text-sm text-text-muted">{validation.truncated}</p>}
    </div>
  );
}
