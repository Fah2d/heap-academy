"use client";

import { type ReactNode, useEffect, useRef } from "react";
import { nearMiss } from "@/grader/compare";
import type { CheckSummary, TestResult } from "@/grader/grade";
import type { TestCase } from "@/grader/test-case";
import { workspace as words } from "@/messages/workspace";
import { Disclosure, Status, type StatusState } from "@/ui";
import { CheckmarkFilled } from "@/ui/icons";
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
 * actual output are shown as text (T-07); when they almost match, the one
 * difference is named in words (FR-GRD-07).
 */
export function TestsPanel({
  tests,
  results,
  summary,
  completion,
  invitation,
  checking,
  checkEnded,
  strategy,
  onGoToLine,
}: {
  tests: readonly TestCase[];
  results: readonly TestResult[];
  summary: CheckSummary | undefined;
  /** The completion line once a check passed and the pass is kept (section 6.6). */
  completion?: string | undefined;
  /** The invitation to save progress, below the completion line (FR-AUTH-07). */
  invitation?: ReactNode;
  checking: boolean;
  /** The last thing that ended was a check, so its summary is new. */
  checkEnded: boolean;
  strategy: "interactive" | "batch";
  onGoToLine: (line: number) => void;
}) {
  const summaryRef = useRef<HTMLHeadingElement>(null);
  const byId = new Map(results.map((result) => [result.testCaseId, result]));
  const firstFailure = results.find((result) => result.status === "failed")?.testCaseId;

  // Focus moves to the summary when a check ends while the panel is shown,
  // not each time the panel mounts: React Aria mounts only the selected tab,
  // and arrow keys in the tab list would otherwise lose their place.
  const shownSummary = useRef(summary);
  useEffect(() => {
    if (summary !== undefined && summary !== shownSummary.current && checkEnded) {
      summaryRef.current?.focus();
    }
    shownSummary.current = summary;
  }, [summary, checkEnded]);

  return (
    <div className="flex flex-col gap-3">
      {summary === undefined ? (
        <p className="text-base text-text-muted">
          {checking ? words.checking : tests.length === 0 ? words.noTests : words.testsBefore}
        </p>
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
      {completion !== undefined && (
        // DESIGN.md section 7: the pass icon and the words with the XP, at --text-2xl.
        <p data-completion className="flex items-center gap-2 text-2xl font-semibold text-text">
          <span className="text-pass">
            <CheckmarkFilled size={20} aria-hidden="true" />
          </span>
          {completion}
        </p>
      )}
      {completion !== undefined && invitation != null && (
        // Focus lands here when the learner hides the invitation, and goes on
        // to the summary, which is seen and read out.
        <div
          tabIndex={-1}
          data-invitation-host
          className="outline-none"
          onFocus={(event) => {
            if (event.target === event.currentTarget) summaryRef.current?.focus();
          }}
        >
          {invitation}
        </div>
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
  // Only a plain mismatch: an error or a cut output is the reason itself.
  const almost =
    failed && result.reason === "mismatch" && !result.truncated
      ? nearMiss(result.actual, test.expected, test.match)
      : undefined;
  return (
    <div className="flex flex-col gap-3 text-sm">
      {failed && (
        <p className="text-base text-text">
          {words.failure(result.reason, TIME_LIMIT_SECONDS)}
          {result.error?.missingName !== undefined && (
            <> {words.needsName(consoleText(result.error.missingName))}</>
          )}
          {almost !== undefined && <> {words.nearMiss(almost)}</>}
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
