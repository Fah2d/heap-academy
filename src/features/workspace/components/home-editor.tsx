"use client";

import {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { homeEditor as homeWords } from "@/messages/catalog";
import { workspace as words } from "@/messages/workspace";
import { STDIN_LINE_LENGTH_LIMIT, STDIN_LINE_LIMIT, SOURCE_LIMIT } from "@/runtime/protocol";
import { canStart, canStop, isRemembered } from "@/runtime/workspace-chart";
import { Button, Notice, Play } from "@/ui";
import { StopFilledAlt } from "@/ui/icons";
import { supportsPython } from "../client/browser-support";
import { type Program, useRuntime } from "../client/use-runtime";
import { runAnnouncement, type TooLarge, tooLarge, transcript } from "../client/workspace-view";
import { ConsolePanel } from "./console-panel";
import { inputLines } from "./input-lines";
import { PythonStatus } from "./python-status";

// CodeMirror is about 160 kB compressed. The home page must stay fast
// (NFR-PERF-01), so the editor's code is fetched only after the page has
// loaded; until then its box shows the same program as plain text.
const CodeEditor = lazy(() =>
  import("./code-editor").then((module) => ({ default: module.CodeEditor })),
);

const subscribeToNothing = () => () => undefined;
let support: boolean | undefined;
const isSupported = () => (support ??= supportsPython(window));

/** Calls `ready` once the page's load event has fired. */
function afterLoad(ready: () => void): () => void {
  if (document.readyState === "complete") {
    ready();
    return () => undefined;
  }
  window.addEventListener("load", ready, { once: true });
  return () => {
    window.removeEventListener("load", ready);
  };
}

/**
 * The home page's live editor (FR-LND-01; docs/spec/03-experience.md section
 * 5.1): a short program in the real editor, run by the real Python worker.
 * Python is not fetched when the page opens: its 5.5 MB start on the first
 * Run or the first edit, and a Run pressed while it starts is kept until it
 * is ready (FR-WSP-17). Nothing is saved and there is no Check.
 */
export function HomeEditor({ nonce }: { nonce: string }) {
  const root = useRef<HTMLDivElement>(null);
  const labelId = useId();
  const supported = useSyncExternalStore(subscribeToNothing, isSupported, () => undefined);
  const [code, setCode] = useState<string>(homeWords.program);
  const [batchInput, setBatchInput] = useState("");
  const [refusal, setRefusal] = useState<TooLarge | undefined>(undefined);
  const [editorWanted, setEditorWanted] = useState(false);
  const [started, setStarted] = useState(false);
  // A Run pressed before Python was asked for. It is sent once, when Python
  // starts; the flag then stays set and does nothing more.
  const [runQueued, setRunQueued] = useState(false);
  const queuedRunSent = useRef(false);
  const [goToLine, setGoToLine] = useState<{ line: number; request: number } | undefined>();
  const answered = useRef(false);
  const wasAnswered = useCallback(() => answered.current, []);
  const setAnswered = useCallback((sent: boolean) => {
    answered.current = sent;
  }, []);

  useEffect(
    () =>
      afterLoad(() => {
        setEditorWanted(true);
      }),
    [],
  );

  const program = useCallback(
    (interactive: boolean): Program => ({
      source: code,
      stdin: interactive ? undefined : inputLines(batchInput),
      tests: [],
    }),
    [code, batchInput],
  );
  const { view, chart, dispatch, sendInput, endInput } = useRuntime(program, {
    enabled: started && supported === true,
  });
  const runtime = chart.runtime;

  // Once Python is starting, the statechart keeps the queued Run until it is
  // ready (FR-WSP-17).
  useEffect(() => {
    if (!runQueued || queuedRunSent.current || runtime.name !== "loading") return;
    queuedRunSent.current = true;
    dispatch({ type: "RUN" });
  }, [runQueued, runtime.name, dispatch]);

  const edit = (next: string) => {
    if (next === code) return;
    setRefusal(undefined);
    setCode(next);
    setStarted(true);
    dispatch({ type: "CODE_EDITED" });
  };

  const run = () => {
    const over = tooLarge(code, view.interactiveInput ? undefined : inputLines(batchInput));
    setRefusal(over);
    if (over !== undefined) return;
    if (runtime.name === "idle") {
      setStarted(true);
      setRunQueued(true);
      return;
    }
    if (canStart(chart) || isRemembered(runtime.name, "RUN")) dispatch({ type: "RUN" });
  };

  const pending = "pending" in runtime ? runtime.pending : null;
  const runPending = pending === "run" || (runQueued && runtime.name === "idle");
  // Before the first Run Python is idle, and Run is what starts it.
  const runBlocked =
    runtime.name !== "idle" && !canStart(chart) && !isRemembered(runtime.name, "RUN");
  const announcement =
    view.ended === "run" && view.result !== undefined
      ? runAnnouncement(view.result, transcript(view.output, false).lines)
      : "";

  if (supported === false) {
    return (
      <section aria-labelledby={labelId} className="flex flex-col gap-3">
        <h2 id={labelId} className="text-lg font-semibold text-text">
          {homeWords.heading}
        </h2>
        <Notice kind="warning" kindLabel={words.warningKind}>
          <strong className="font-semibold">{words.unsupportedTitle}</strong>{" "}
          {words.unsupportedBody}
        </Notice>
      </section>
    );
  }

  const fallback = (
    <div
      data-home-program
      className="code-surface h-full overflow-auto rounded-panel border border-border-control"
    >
      <pre className="px-3 py-3 font-mono text-code text-text">{code}</pre>
    </div>
  );

  return (
    <section
      ref={root}
      aria-labelledby={labelId}
      data-home-editor
      className="flex min-w-0 flex-col gap-3"
    >
      <div className="flex flex-col gap-1">
        <h2 id={labelId} className="text-lg font-semibold text-text">
          {homeWords.heading}
        </h2>
        <p className="text-base text-text-muted">{homeWords.intro}</p>
      </div>
      <div className="h-(--home-editor-size)">
        {editorWanted ? (
          <Suspense fallback={fallback}>
            <CodeEditor
              labelledBy={labelId}
              value={code}
              onChange={edit}
              nonce={nonce}
              fill
              goToLine={goToLine}
            />
          </Suspense>
        ) : (
          fallback
        )}
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <Button variant="secondary" icon={<Play size={16} />} isPending={runBlocked} onPress={run}>
          {runPending ? words.runPending : words.run}
        </Button>
        <Button
          variant="secondary"
          icon={<StopFilledAlt size={16} />}
          isPending={!canStop(chart)}
          onPress={() => {
            dispatch({ type: "STOP" });
          }}
        >
          {words.stop}
        </Button>
        {started && (
          <PythonStatus
            runtime={runtime}
            progress={view.progress}
            onRetry={() => {
              dispatch({ type: "RETRY" });
            }}
          />
        )}
      </div>
      {refusal !== undefined && (
        <Notice kind="error" kindLabel={words.errorKind} announce="assertive">
          {words.tooLarge(
            refusal,
            refusal === "source"
              ? SOURCE_LIMIT
              : refusal === "input_lines"
                ? STDIN_LINE_LIMIT
                : STDIN_LINE_LENGTH_LIMIT,
          )}
        </Notice>
      )}
      <ConsolePanel
        view={view}
        awaitingInput={runtime.name === "awaitingInput"}
        batchInput={batchInput}
        onBatchInput={(value) => {
          setRefusal(undefined);
          setBatchInput(value);
        }}
        sendInput={sendInput}
        endInput={endInput}
        onGoToLine={(line) => {
          setEditorWanted(true);
          setGoToLine((previous) => ({ line, request: (previous?.request ?? 0) + 1 }));
        }}
        workspaceRef={root}
        answered={wasAnswered}
        setAnswered={setAnswered}
      />
      <div role="status" className="sr-only">
        {announcement}
      </div>
    </section>
  );
}
