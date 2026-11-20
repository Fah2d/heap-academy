"use client";

import { useState } from "react";
import { runtimeDev as m } from "@/messages/runtime-dev";
import { useRuntime } from "../client/use-runtime";

/**
 * The development-only page that drives the Python worker (WP-3.1). It is
 * plain on purpose: the workspace's real interface is WP-5.2's. The data
 * attributes are for the browser tests.
 */
export function RuntimeConsole() {
  const { view, run, sendInput, endInput, stop } = useRuntime();
  const [source, setSource] = useState<string>(m.sample);
  const [stdin, setStdin] = useState("");
  const [answer, setAnswer] = useState("");
  const waiting = view.status === "awaitingInput";
  const result = view.result;
  const output = view.output.map((chunk) => chunk.text).join("");

  return (
    <section aria-labelledby="runtime-title">
      <h1 id="runtime-title">{m.title}</h1>
      <p>{m.intro}</p>

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

      <button
        type="button"
        disabled={view.status !== "ready"}
        onClick={() => {
          const lines = stdin === "" ? [] : stdin.split("\n");
          run(source, view.interactiveInput && stdin === "" ? undefined : lines);
        }}
      >
        {m.run}
      </button>
      <button type="button" disabled={view.status !== "running" && !waiting} onClick={stop}>
        {m.stop}
      </button>

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
            sendInput(answer);
            setAnswer("");
          }}
        >
          <label htmlFor="runtime-answer">{m.answer}</label>
          <input
            id="runtime-answer"
            value={answer}
            autoComplete="off"
            spellCheck={false}
            autoFocus
            onChange={(event) => {
              setAnswer(event.target.value);
            }}
          />
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

      <dl>
        <dt>{m.restarts}</dt>
        <dd data-testid="runtime-restarts">{view.restarts}</dd>
        <dt>{m.dropped}</dt>
        <dd data-testid="runtime-dropped">{view.dropped.length}</dd>
      </dl>
    </section>
  );
}
