"use client";

import {
  type ReactNode,
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import type { Neighbours } from "@/domain/workspace/neighbours";
import { ariaKeyShortcuts, workspaceShortcut } from "@/domain/workspace/shortcuts";
import type { TestCase } from "@/grader/test-case";
import { workspace as words } from "@/messages/workspace";
import { SOURCE_LIMIT, STDIN_LINE_LENGTH_LIMIT, STDIN_LINE_LIMIT } from "@/runtime/protocol";
import { canStart, canStop, isRemembered } from "@/runtime/workspace-chart";
import { Button, Link, Notice, Play, Tabs } from "@/ui";
import { Checkmark, StopFilledAlt } from "@/ui/icons";
import { supportsPython } from "../client/browser-support";
import { createCodeStore, type CodeStore, savedCodeKey } from "../client/saved-code";
import { type Program, useRuntime } from "../client/use-runtime";
import { runAnnouncement, type TooLarge, tooLarge, transcript } from "../client/workspace-view";
import { courseBackPath } from "../paths";
import { CodeEditor } from "./code-editor";
import { ConsolePanel } from "./console-panel";
import { Hints } from "./hints";
import { LessonNav } from "./lesson-nav";
import { PythonStatus } from "./python-status";
import { ResetCode } from "./reset-code";
import { TestsPanel } from "./tests-panel";

export type WorkspaceLesson = {
  course: { slug: string; title: string };
  slug: string;
  title: string;
  starterCode: string;
  hints: readonly string[];
  tests: readonly TestCase[];
  neighbours: Neighbours;
};

/** How long typing pauses before the code is saved on the device. */
const SAVE_DELAY_MS = 400;

type OutputTab = "console" | "tests";

/**
 * The batch field's answers, one per line. An empty field is no answers, and
 * the line break after the last answer does not add an empty one.
 */
export const inputLines = (text: string) =>
  text === "" ? [] : text.replace(/\n$/, "").split("\n");

/** Neither value below changes while the page is open. */
const subscribeToNothing = () => () => undefined;
let support: boolean | undefined;
// Worked out once: the check builds a worker, so it does not run on every render.
const isSupported = () => (support ??= supportsPython(window));
const isApple = () => /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);

/**
 * The lesson workspace at 768 px and wider (docs/spec/03-experience.md
 * section 6.1; FR-WSP-01): the instructions beside the work, the editor above
 * the actions and the output, previous and next below. The page does not
 * scroll; each pane does. Below 768 px the regions follow one another in
 * reading order until WP-5.3 builds the phone layout.
 */
export function Workspace({
  lesson,
  instructions,
  nonce,
}: {
  lesson: WorkspaceLesson;
  /** The rendered instructions, from the server. */
  instructions: ReactNode;
  nonce: string;
}) {
  const root = useRef<HTMLDivElement>(null);
  const editorLabel = useId();
  const key = savedCodeKey(lesson.course.slug, lesson.slug);

  // The browser and the system's keys are known only in the browser; the
  // server renders as if neither were known yet.
  const supported = useSyncExternalStore(subscribeToNothing, isSupported, () => undefined);
  const apple = useSyncExternalStore(subscribeToNothing, isApple, () => false);
  const [code, setCode] = useState(lesson.starterCode);
  const [restored, setRestored] = useState(false);
  const [beforeReset, setBeforeReset] = useState<string | undefined>(undefined);
  const [batchInput, setBatchInput] = useState("");
  const [tab, setTab] = useState<OutputTab>("console");
  const [refusal, setRefusal] = useState<TooLarge | undefined>(undefined);
  const [goToLine, setGoToLine] = useState<{ line: number; request: number } | undefined>();

  const store = useRef<CodeStore | undefined>(undefined);
  const edited = useRef(false);
  const pendingSave = useRef<number | undefined>(undefined);
  const latestCode = useRef(code);

  // The saved code is on the device, so it is read only here.
  useEffect(() => {
    const codeStore = createCodeStore(typeof indexedDB === "undefined" ? undefined : indexedDB);
    store.current = codeStore;
    let active = true;
    void codeStore.load(key).then((saved) => {
      // Typing that began before the saved code arrived wins.
      if (!active || saved === undefined || edited.current) return;
      latestCode.current = saved;
      setCode(saved);
      setRestored(saved !== lesson.starterCode);
    });
    return () => {
      active = false;
    };
  }, [key, lesson.starterCode]);

  const saveNow = useCallback(() => {
    if (pendingSave.current !== undefined) window.clearTimeout(pendingSave.current);
    pendingSave.current = undefined;
    void store.current?.save(key, latestCode.current);
  }, [key]);

  // What is typed is saved when typing pauses, and at once when the page is hidden.
  useEffect(() => {
    const hidden = () => {
      if (document.visibilityState === "hidden" && pendingSave.current !== undefined) saveNow();
    };
    document.addEventListener("visibilitychange", hidden);
    return () => {
      document.removeEventListener("visibilitychange", hidden);
      if (pendingSave.current !== undefined) saveNow();
    };
  }, [saveNow]);

  const program = useCallback(
    (interactive: boolean): Program => ({
      source: code,
      stdin: interactive ? undefined : inputLines(batchInput),
      tests: lesson.tests,
    }),
    [code, batchInput, lesson.tests],
  );
  const { view, chart, dispatch, sendInput, endInput } = useRuntime(program, {
    enabled: supported === true,
  });

  const replaceCode = (next: string) => {
    setRefusal(undefined);
    latestCode.current = next;
    setCode(next);
    if (pendingSave.current !== undefined) window.clearTimeout(pendingSave.current);
    pendingSave.current = window.setTimeout(saveNow, SAVE_DELAY_MS);
    dispatch({ type: "CODE_EDITED" });
  };

  const edit = (next: string) => {
    if (next === latestCode.current) return;
    edited.current = true;
    setRestored(false);
    setBeforeReset(undefined);
    replaceCode(next);
  };

  const runtime = chart.runtime;
  const pending = "pending" in runtime ? runtime.pending : null;
  const canPress = (type: "RUN" | "CHECK") => canStart(chart) || isRemembered(runtime.name, type);
  const press = (action: "run" | "check") => {
    const type = action === "run" ? "RUN" : "CHECK";
    if (!canPress(type)) return;
    // The worker would refuse it and nothing would happen, so say why instead.
    // Check sends no typed-in input.
    const over = tooLarge(
      code,
      action === "run" && !view.interactiveInput ? inputLines(batchInput) : undefined,
    );
    setRefusal(over);
    if (over !== undefined) return;
    setTab(action === "run" ? "console" : "tests");
    dispatch({ type });
  };

  // Said once when a run or a check ends, never chunk by chunk (NFR-A11Y-04).
  // A new run or check empties it first, so the same words are said again.
  const awaitingInput = runtime.name === "awaitingInput";
  const announcement =
    view.ended === "run" && view.result !== undefined
      ? runAnnouncement(view.result, transcript(view.output, false).lines)
      : view.ended === "check" && view.summary !== undefined
        ? words.summary(view.summary.passed, view.summary.total)
        : "";

  const moveTo = (line: number) => {
    setGoToLine((previous) => ({ line, request: (previous?.request ?? 0) + 1 }));
  };

  const passed = chart.lesson === "passed";
  const strategy = view.interactiveInput ? "interactive" : "batch";
  const runLabel = pending === "run" ? words.runPending : words.run;
  const checkLabel = pending === "check" ? words.checkPending : words.check;

  return (
    <div
      ref={root}
      data-workspace
      className="flex flex-col md:grid md:h-full md:grid-cols-(--workspace-columns) md:grid-rows-(--workspace-rows)"
      onKeyDownCapture={(event) => {
        // React passes events up through portals, so a key pressed in the
        // reset dialog arrives here too; only keys pressed in the page count.
        if (!(event.target instanceof Node) || root.current?.contains(event.target) !== true)
          return;
        if (event.nativeEvent.isComposing) return;
        const keys = {
          key: event.key,
          ctrlKey: event.ctrlKey,
          metaKey: event.metaKey,
          shiftKey: event.shiftKey,
          altKey: event.altKey,
          repeat: false,
          isComposing: false,
        };
        const action = workspaceShortcut(keys, apple);
        if (action === undefined) return;
        // Before the editor sees it: CodeMirror would add a line for Ctrl
        // Enter. A held key is kept from the editor too, but presses nothing.
        event.preventDefault();
        event.stopPropagation();
        if (!event.repeat) press(action);
      }}
    >
      <div className="flex flex-col gap-1 border-be border-border px-gutter py-3 md:col-span-2">
        <div>
          <Link href={courseBackPath(lesson.course.slug)} variant="standalone">
            {words.backToCourse(lesson.course.title)}
          </Link>
        </div>
        <h1 className="text-xl font-semibold text-text">{lesson.title}</h1>
      </div>

      <section
        aria-labelledby="workspace-instructions"
        className="flex min-h-0 flex-col gap-6 overflow-auto border-be border-border px-gutter py-5 md:border-be-0 md:border-e"
      >
        <h2 id="workspace-instructions" className="sr-only">
          {words.instructions}
        </h2>
        {instructions}
        <Hints hints={lesson.hints} />
      </section>

      <section
        aria-labelledby={editorLabel}
        className="flex min-h-0 flex-col gap-3 overflow-auto px-gutter py-4"
      >
        {supported === false ? (
          <>
            <h2 id={editorLabel} className="sr-only">
              {words.work}
            </h2>
            <Notice kind="warning" kindLabel={words.warningKind}>
              <strong className="font-semibold">{words.unsupportedTitle}</strong>{" "}
              {words.unsupportedBody}
            </Notice>
          </>
        ) : (
          <>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 id={editorLabel} className="text-lg font-semibold text-text">
                {words.work}
              </h2>
              <ResetCode
                disabled={code === lesson.starterCode}
                onReset={() => {
                  setBeforeReset(latestCode.current);
                  setRestored(false);
                  replaceCode(lesson.starterCode);
                }}
              />
            </div>
            {restored && <p className="text-sm text-text-muted">{words.restored}</p>}
            {/* Always present, so the words are announced when they appear. */}
            <div
              role="status"
              className={beforeReset === undefined ? "sr-only" : "text-base text-text"}
            >
              {beforeReset === undefined ? "" : words.resetDone}
            </div>
            {beforeReset !== undefined && (
              <div className="flex flex-wrap items-center gap-3">
                <Button
                  variant="secondary"
                  onPress={() => {
                    const previous = beforeReset;
                    setBeforeReset(undefined);
                    replaceCode(previous);
                  }}
                >
                  {words.undo}
                </Button>
              </div>
            )}
            <div className="grid min-h-(--workspace-editor-min) md:min-h-0 md:flex-(--workspace-editor-share)">
              <CodeEditor
                labelledBy={editorLabel}
                value={code}
                onChange={edit}
                nonce={nonce}
                fill
                goToLine={goToLine}
              />
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <Button
                variant="secondary"
                icon={<Play size={16} />}
                isPending={!canPress("RUN")}
                keyShortcuts={ariaKeyShortcuts("run", apple)}
                onPress={() => {
                  press("run");
                }}
              >
                {runLabel}
                <kbd aria-hidden="true" className="font-mono text-xs text-text-muted">
                  {words.shortcut(apple, false)}
                </kbd>
              </Button>
              <Button
                variant={passed ? "secondary" : "primary"}
                icon={<Checkmark size={16} />}
                isPending={!canPress("CHECK")}
                keyShortcuts={ariaKeyShortcuts("check", apple)}
                onPress={() => {
                  press("check");
                }}
              >
                {checkLabel}
                <kbd aria-hidden="true" className="font-mono text-xs opacity-80">
                  {words.shortcut(apple, true)}
                </kbd>
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
              <PythonStatus
                runtime={runtime}
                progress={view.progress}
                onRetry={() => {
                  dispatch({ type: "RETRY" });
                }}
              />
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

            <div className="flex min-h-(--workspace-output-min) flex-col md:min-h-0 md:flex-(--workspace-output-share)">
              <h2 className="sr-only">{words.output}</h2>
              <Tabs
                label={words.output}
                selectedKey={tab}
                onSelectionChange={(selected) => {
                  setTab(selected === "tests" ? "tests" : "console");
                }}
                fill
                items={[
                  {
                    id: "console",
                    title: words.console,
                    content: (
                      <ConsolePanel
                        view={view}
                        awaitingInput={awaitingInput}
                        batchInput={batchInput}
                        onBatchInput={(value) => {
                          setRefusal(undefined);
                          setBatchInput(value);
                        }}
                        sendInput={sendInput}
                        endInput={endInput}
                        onGoToLine={moveTo}
                        workspaceRef={root}
                      />
                    ),
                  },
                  {
                    id: "tests",
                    title: words.tests,
                    content: (
                      <TestsPanel
                        tests={lesson.tests}
                        results={view.tests}
                        summary={view.summary}
                        checking={runtime.name === "checking"}
                        checkEnded={view.ended === "check"}
                        strategy={strategy}
                        onGoToLine={moveTo}
                      />
                    ),
                  },
                ]}
              />
              <div role="status" className="sr-only">
                {announcement}
              </div>
            </div>
          </>
        )}
      </section>

      <div className="md:col-span-2">
        <LessonNav course={lesson.course.slug} neighbours={lesson.neighbours} passed={passed} />
      </div>
    </div>
  );
}
