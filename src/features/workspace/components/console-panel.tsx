"use client";

import { type RefObject, useEffect, useId, useRef, useState } from "react";
import { workspace as words } from "@/messages/workspace";
import type { InputRequest } from "@/runtime/controller";
import { OUTPUT_LIMIT, STDIN_LINE_LENGTH_LIMIT } from "@/runtime/protocol";
import { Button, TextArea } from "@/ui";
import { cx } from "@/ui/class-names";
import type { RuntimeView } from "../client/runtime-view";
import { runError, transcript } from "../client/workspace-view";
import { LearnerErrorView } from "./learner-error-view";

/**
 * The console (docs/spec/03-experience.md section 6.3): output as it is
 * produced, standard error set apart by a label and a border, the input line
 * when the program asks, the batch field where the browser cannot pause a
 * program, the error of the last run, and the line that says output was cut.
 * Streaming text is not announced; the end of a run is, by the workspace.
 */
export function ConsolePanel({
  view,
  awaitingInput,
  batchInput,
  onBatchInput,
  sendInput,
  endInput,
  onGoToLine,
  workspaceRef,
}: {
  view: RuntimeView;
  awaitingInput: boolean;
  batchInput: string;
  onBatchInput: (value: string) => void;
  sendInput: (line: string) => InputRequest;
  endInput: () => void;
  onGoToLine: (line: number) => void;
  /** The workspace's root: focus moves to the input line only from inside it. */
  workspaceRef: RefObject<HTMLElement | null>;
}) {
  const shown = transcript(view.output, awaitingInput);
  const result = view.result;
  const error = result === undefined ? undefined : runError(result.outcome);
  const strategy = view.interactiveInput ? "interactive" : "batch";
  const showBatch = view.status !== "idle" && view.status !== "loading" && !view.interactiveInput;
  const empty = shown.chunks.length === 0 && !awaitingInput && result === undefined;

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      {showBatch && (
        <TextArea
          label={words.batchLabel}
          description={words.batchHint}
          value={batchInput}
          onChange={onBatchInput}
          rows={3}
          mono
        />
      )}
      <div
        tabIndex={0}
        role="region"
        aria-label={words.consoleLabel}
        className="min-h-0 flex-1 overflow-auto rounded-panel border border-border bg-surface p-3 focus-visible:-outline-offset-2"
      >
        {empty ? (
          <p className="text-base text-text-muted">{words.consoleEmpty}</p>
        ) : (
          <pre
            data-testid="console-output"
            className="font-mono text-code whitespace-pre-wrap break-words text-text"
          >
            {shown.chunks.map((chunk, index) =>
              chunk.stream === "stderr" ? (
                <span
                  key={index}
                  data-stream="stderr"
                  className="block border-s-2 border-fail ps-2 text-fail"
                >
                  <span className="text-text-muted">{words.errorOutput}: </span>
                  {chunk.text}
                </span>
              ) : (
                <span
                  key={index}
                  data-stream={chunk.stream}
                  className={cx(chunk.stream === "input" && "font-semibold")}
                >
                  {chunk.text}
                </span>
              ),
            )}
          </pre>
        )}
        {awaitingInput && (
          <InputLine
            prompt={shown.prompt}
            sendInput={sendInput}
            endInput={endInput}
            workspaceRef={workspaceRef}
          />
        )}
        {result?.truncated === true && (
          <p className="mbs-2 text-base text-text-muted">{words.truncated(OUTPUT_LIMIT)}</p>
        )}
      </div>
      {error !== undefined && (
        <LearnerErrorView error={error} strategy={strategy} onGoToLine={onGoToLine} />
      )}
    </div>
  );
}

function InputLine({
  prompt,
  sendInput,
  endInput,
  workspaceRef,
}: {
  prompt: string | undefined;
  sendInput: (line: string) => InputRequest;
  endInput: () => void;
  workspaceRef: RefObject<HTMLElement | null>;
}) {
  const [answer, setAnswer] = useState("");
  const [refused, setRefused] = useState(false);
  const field = useRef<HTMLInputElement>(null);
  const id = useId();

  useEffect(() => {
    // Only when focus is already in the workspace (section 6.3): a learner
    // reading elsewhere on the page is not pulled away.
    const root = workspaceRef.current;
    if (root !== null && root.contains(document.activeElement)) field.current?.focus();
  }, [workspaceRef]);

  return (
    <form
      className="flex flex-wrap items-center gap-2 mbs-1"
      onSubmit={(event) => {
        event.preventDefault();
        const sent = sendInput(answer);
        // A refused answer stays in the field, with the reason.
        setRefused(!sent.ok);
        if (sent.ok) setAnswer("");
      }}
    >
      <label htmlFor={id} className="font-mono text-code whitespace-pre-wrap text-text">
        {prompt ?? <span className="font-sans text-base text-text-muted">{words.answerLabel}</span>}
      </label>
      <input
        ref={field}
        id={id}
        value={answer}
        maxLength={STDIN_LINE_LENGTH_LIMIT}
        aria-invalid={refused}
        aria-describedby={refused ? `${id}-refused` : undefined}
        autoComplete="off"
        autoCapitalize="off"
        spellCheck={false}
        className="min-h-target min-w-0 flex-1 rounded-control border border-border-control bg-bg px-3 font-mono text-code text-text aria-invalid:border-fail"
        onChange={(event) => {
          setAnswer(event.target.value);
        }}
      />
      <Button variant="secondary" type="submit">
        {words.send}
      </Button>
      <Button variant="secondary" onPress={endInput}>
        {words.endInput}
      </Button>
      {refused && (
        <p id={`${id}-refused`} className="w-full text-base text-fail">
          {words.answerRefused(STDIN_LINE_LENGTH_LIMIT)}
        </p>
      )}
    </form>
  );
}
