"use client";

import { useEffect, useRef } from "react";
import type { CheckSummary, TestResult } from "@/grader/grade";
import type { TestCase } from "@/grader/test-case";
import { workspace as words } from "@/messages/workspace";
import { Disclosure, Status, type StatusState } from "@/ui";
import { consoleText } from "@/domain/workspace/console-text";
import { testError, TIME_LIMIT_SECONDS } from "../client/workspace-view";
import { LearnerErrorView } from "./learner-error-view";

const STATE: Record<TestResult["status"], StatusState> = {
  passed: "pass",
  failed: "fail",
  not_run: "not-run",
};

const LABEL: Record<TestResult["status"], string> = {
  passed: words.passed,
  failed: words.failedTest,
  not_run: words.notRun,
};

/**
 * The tests panel (docs/spec/03-experience.md section 6.4; FR-WSP-05). Before
 * the first Check it lists what will be checked, each "Not run". After a
 * Check its summary is focused, and announced by the workspace's live region;
 * each test case is a disclosure, and the first failure is open. Expected and
 * actual output are shown as text (T-07).
 */
export function TestsPanel({
  tests,
  results,
  summary,
  checking,
  strategy,
  onGoToLine,
}: {
  tests: readonly TestCase[];
  results: readonly TestResult[];
  summary: CheckSummary | undefined;
  checking: boolean;
  strategy: "interactive" | "batch";
  onGoToLine: (line: number) => void;
}) {
  const summaryRef = useRef<HTMLHeadingElement>(null);
  const byId = new Map(results.map((result) => [result.testCaseId, result]));
  const firstFailure = results.find((result) => result.status === "failed")?.testCaseId;

  useEffect(() => {
    if (summary !== undefined) summaryRef.current?.focus();
  }, [summary]);

  return (
    <div className="flex flex-col gap-3">
      {summary === undefined ? (
        <p className="text-base text-text-muted">{checking ? words.checking : words.testsBefore}</p>
      ) : (
        <h3
          ref={summaryRef}
          tabIndex={-1}
          data-summary={summary.allPassed ? "passed" : "failed"}
          className="text-lg font-semibold text-text outline-none focus-visible:outline-2"
        >
          {words.summary(summary.passed, summary.total)}
        </h3>
      )}
      <ol className="flex flex-col gap-1">
        {tests.map((test) => {
          const result = byId.get(test.id);
          const status = result?.status ?? "not_run";
          const title = (
            <span className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1">
              <Status state={STATE[status]} label={LABEL[status]} />
              <span className="font-mono text-sm text-text">{test.name}</span>
            </span>
          );
          return (
            <li key={test.id} data-test-status={status}>
              {result === undefined || result.status === "not_run" ? (
                <div className="flex min-h-target items-center ps-6">{title}</div>
              ) : (
                <Disclosure
                  key={`${test.id}-${summary === undefined ? "running" : "done"}`}
                  title={title}
                  level={4}
                  defaultExpanded={summary !== undefined && test.id === firstFailure}
                >
                  <TestDetails
                    test={test}
                    result={result}
                    strategy={strategy}
                    onGoToLine={onGoToLine}
                  />
                </Disclosure>
              )}
            </li>
          );
        })}
      </ol>
    </div>
  );
}

function Block({ label, text, empty }: { label: string; text: string; empty: string }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-sm font-medium text-text-muted">{label}</span>
      {text === "" ? (
        <p className="text-sm text-text-muted">{empty}</p>
      ) : (
        <pre className="overflow-x-auto rounded-control bg-surface-editor p-2 font-mono text-code whitespace-pre-wrap text-text">
          {text}
        </pre>
      )}
    </div>
  );
}

function TestDetails({
  test,
  result,
  strategy,
  onGoToLine,
}: {
  test: TestCase;
  result: Exclude<TestResult, { status: "not_run" }>;
  strategy: "interactive" | "batch";
  onGoToLine: (line: number) => void;
}) {
  const failed = result.status === "failed";
  return (
    <div className="flex flex-col gap-3 text-sm">
      {failed && (
        <p className="text-base text-text">
          {words.failure(result.reason, TIME_LIMIT_SECONDS)}
          {result.error?.missingName !== undefined && (
            <> {words.needsName(result.error.missingName)}</>
          )}
        </p>
      )}
      <Block label={words.input} text={test.stdin} empty={words.noInput} />
      {test.afterCode !== "" && <Block label={words.thenThisRuns} text={test.afterCode} empty="" />}
      <Block label={words.expected} text={test.expected} empty={words.nothingPrinted} />
      <Block label={words.actual} text={consoleText(result.actual)} empty={words.nothingPrinted} />
      {failed && result.truncated && (
        <p className="text-sm text-text-muted">{words.truncatedShort}</p>
      )}
      {failed && result.error !== undefined && result.error.missingName === undefined && (
        <LearnerErrorView
          error={testError(result.error)}
          strategy={strategy}
          onGoToLine={onGoToLine}
          headingLevel={5}
        />
      )}
      {failed && test.hint !== "" && (
        <div className="flex flex-col gap-1">
          <span className="text-sm font-medium text-text-muted">{words.hint}</span>
          <p className="text-base text-text">{test.hint}</p>
        </div>
      )}
    </div>
  );
}
