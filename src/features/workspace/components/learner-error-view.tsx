"use client";

import {
  goToLine,
  learnerErrorHeading,
  learnerErrorSuggestion,
  workspace as words,
} from "@/messages/workspace";
import { Button } from "@/ui";
import { ErrorFilled } from "@/ui/icons";
import { errorFacts, type LearnerError } from "../client/workspace-view";

/**
 * The one component for every learner error (docs/spec/03-experience.md
 * section 6.5; FR-WSP-09): a heading in plain words, Python's message, the
 * line as a button that moves the editor's cursor there, and one suggestion.
 * Every text is rendered by React as text (T-07).
 */
export function LearnerErrorView({
  error,
  strategy,
  onGoToLine,
  headingLevel = 3,
}: {
  error: LearnerError;
  strategy: "interactive" | "batch";
  onGoToLine: (line: number) => void;
  headingLevel?: 3 | 5;
}) {
  const facts = errorFacts(error.line);
  const suggestion = learnerErrorSuggestion(error.kind, facts, strategy);
  const Heading = headingLevel === 3 ? "h3" : "h5";
  return (
    <div
      data-learner-error={error.kind}
      className="flex flex-col gap-2 rounded-panel border border-border-control bg-surface p-4"
    >
      <Heading className="flex items-center gap-2 text-base font-semibold text-text">
        <span aria-hidden="true" className="inline-flex text-fail">
          <ErrorFilled size={16} />
        </span>
        <span className="sr-only">{words.errorKind}: </span>
        {learnerErrorHeading(error.kind, facts)}
      </Heading>
      {error.message !== undefined && error.message !== "" && (
        <pre className="overflow-x-auto whitespace-pre-wrap font-mono text-code text-text">
          {error.message}
        </pre>
      )}
      {error.line !== undefined && (
        <div>
          <Button
            variant="secondary"
            onPress={() => {
              if (error.line !== undefined) onGoToLine(error.line);
            }}
          >
            {goToLine(error.line)}
          </Button>
        </div>
      )}
      {suggestion !== undefined && <p className="text-base text-text-muted">{suggestion}</p>}
    </div>
  );
}
