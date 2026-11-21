"use client";

import { useCallback, useState } from "react";
import { EXAMPLE_LESSON } from "@/grader/example-lesson";
import { runtimeDev as m } from "@/messages/runtime-dev";
import { STDIN_LINE_LENGTH_LIMIT } from "@/runtime/protocol";
import { canStart, canStop, isRemembered } from "@/runtime/workspace-chart";
import { type Program, useRuntime } from "../client/use-runtime";

/**
 * The development and preview page that drives the Python worker through
 * the workspace statechart (WP-3.1, WP-3.4): a program with input, a check,
 * and a runaway loop, for the browser tests and the owner's phone check. It
 * is plain on purpose: the workspace's real interface is WP-5.2's. The data
 * attributes are for the browser tests.
 */
export function RuntimeConsole() {
  const [source, setSource] = useState<string>(m.sample);
  const [stdin, setStdin] = useState("");
  const [answer, setAnswer] = useState("");
  const [refused, setRefused] = useState(false);
  const program = useCallback(
    (interactive: boolean): Program => {
      const lines = stdin === "" ? [] : stdin.split("\n");
      return {
        source,
        stdin: interactive && stdin === "" ? undefined : lines,
        tests: EXAMPLE_LESSON.testCases,
      };
    },
    [source, stdin],
  );
  const { view, chart, dispatch, sendInput, endInput } = useRuntime(program);
  const runtime = chart.runtime;
  // A press while Python starts is kept and fires when it is ready (FR-WSP-17).
  const canPress = (type: "RUN" | "CHECK") => canStart(chart) || isRemembered(runtime.name, type);
  const waiting = runtime.name === "awaitingInput";
  const result = view.result;
  const output = view.output.map((chunk) => chunk.text).join("");

  return (
    <section aria-labelledby="runtime-title">
      <h1 id="runtime-title">{m.title}</h1>
      <p>{m.intro}</p>

      <h2>{m.samples}</h2>
      <p>
        <button type="button" onClick={() => setSource(m.sample)}>
          {m.sampleInput}
        </button>{" "}
        <button type="button" onClick={() => setSource(EXAMPLE_LESSON.solution)}>
          {m.sampleSolution}
        </button>{" "}
        <button type="button" onClick={() => setSource(m.loop)}>
          {m.sampleLoop}
        </button>
      </p>

      <label htmlFor="runtime-program">{m.program}</label>
      <textarea
        id="runtime-program"
        value={source}
        rows={8}
        spellCheck={false}
        onChange={(event) => {
          setSource(event.target.value);
        }}
      />

      {/* Answers given here make a batch run, the only kind where the runtime cannot pause (section 5.3). */}
      <label htmlFor="runtime-input">{m.input}</label>
      <textarea
        id="runtime-input"
        value={stdin}
        rows={3}
        spellCheck={false}
        aria-describedby={view.interactiveInput ? "runtime-input-hint" : undefined}
        onChange={(event) => {
          setStdin(event.target.value);
        }}
      />
      {view.interactiveInput && <p id="runtime-input-hint">{m.inputHint}</p>}

      <button type="button" disabled={!canPress("RUN")} onClick={() => dispatch({ type: "RUN" })}>
        {m.run}
      </button>
      <button
        type="button"
        disabled={!canPress("CHECK")}
        onClick={() => dispatch({ type: "CHECK" })}
      >
        {m.check}
      </button>
      <button type="button" disabled={!canStop(chart)} onClick={() => dispatch({ type: "STOP" })}>
        {m.stop}
      </button>
      {runtime.name === "failed" && (
        <button type="button" onClick={() => dispatch({ type: "RETRY" })}>
          {m.retry}
        </button>
      )}

      <h2>{m.chart}</h2>
      <p data-chart-state={runtime.name} data-lesson={chart.lesson}>
        {m.chartState[runtime.name]}
        {"pending" in runtime && runtime.pending !== null && <>, {m.pending[runtime.pending]}</>}
        {runtime.name === "restarting" && <> {m.restartReason[runtime.reason]}</>}. {m.lesson}:{" "}
        {m.lessonState[chart.lesson]}.
      </p>

      <p role="status" data-status={view.status}>
        {m.status[view.status]}
        {view.progress !== undefined && view.status !== "ready" && (
          <> {m.progress(view.progress.loadedBytes, view.progress.totalBytes)}</>
        )}
      </p>

      <h2>{m.output}</h2>
      <pre data-testid="runtime-output">{output}</pre>

      {waiting && (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            // A refused answer stays in the field, with the reason.
            const sent = sendInput(answer);
            setRefused(!sent.ok);
            if (sent.ok) setAnswer("");
          }}
        >
          <label htmlFor="runtime-answer">{m.answer}</label>
          <input
            id="runtime-answer"
            value={answer}
            maxLength={STDIN_LINE_LENGTH_LIMIT}
            aria-invalid={refused}
            aria-describedby={refused ? "runtime-answer-refused" : undefined}
            autoComplete="off"
            spellCheck={false}
            autoFocus
            onChange={(event) => {
              setAnswer(event.target.value);
            }}
          />
          {refused && <p id="runtime-answer-refused">{m.answerRefused(STDIN_LINE_LENGTH_LIMIT)}</p>}
          <button type="submit">{m.send}</button>
          <button type="button" onClick={endInput}>
            {m.endInput}
          </button>
        </form>
      )}

      {result !== undefined && (
        <p data-outcome={result.outcome.kind} data-truncated={String(result.truncated)}>
          {m.outcome[result.outcome.kind]}
          {"line" in result.outcome && result.outcome.line !== undefined && (
            <>, {m.line(result.outcome.line)}</>
          )}
          , {m.duration(result.durationMs)}
        </p>
      )}

      <h2>{m.tests}</h2>
      <p>{m.testsIntro}</p>
      <ol data-testid="runtime-tests">
        {view.tests.map((test) => (
          <li key={test.testCaseId} data-test-status={test.status}>
            {test.testCaseId}: {m.testStatus[test.status]}
          </li>
        ))}
      </ol>

      <dl>
        <dt>{m.refused}</dt>
        <dd data-testid="runtime-refused">{view.refused}</dd>
        <dt>{m.restarts}</dt>
        <dd data-testid="runtime-restarts">{view.restarts}</dd>
        <dt>{m.dropped}</dt>
        <dd data-testid="runtime-dropped">{view.dropped.length}</dd>
      </dl>
    </section>
  );
}
