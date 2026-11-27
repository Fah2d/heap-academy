"use client";

import {
  Fragment,
  type KeyboardEvent,
  type ReactNode,
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import type { LessonId } from "@/domain/ids";
import type { Neighbours } from "@/domain/workspace/neighbours";
import { ariaKeyShortcuts, workspaceShortcut } from "@/domain/workspace/shortcuts";
import {
  deviceProgress,
  type Durability,
  syncStatus,
  useGuestInvitation,
} from "@/features/progress";
import type { CheckSummary } from "@/grader/grade";
import type { TestCase } from "@/grader/test-case";
import { workspace as words } from "@/messages/workspace";
import { SOURCE_LIMIT, STDIN_LINE_LENGTH_LIMIT, STDIN_LINE_LIMIT } from "@/runtime/protocol";
import { canStart, canStop, isRemembered } from "@/runtime/workspace-chart";
import { Button, Link, Notice, Play, Tabs } from "@/ui";
import { cx } from "@/ui/class-names";
import { Checkmark, StopFilledAlt } from "@/ui/icons";
import { supportsPython } from "../client/browser-support";
import { keyboardInset, narrowScreen, PHONE_VIEWS, type PhoneView } from "../client/phone-layout";
import { createCodeStore, type CodeStore, savedCodeKey } from "../client/saved-code";
import { type Program, useRuntime } from "../client/use-runtime";
import { runAnnouncement, type TooLarge, tooLarge, transcript } from "../client/workspace-view";
import { courseBackPath } from "../paths";
import { CodeEditor } from "./code-editor";
import { ConsolePanel } from "./console-panel";
import { Hints } from "./hints";
import { inputLines } from "./input-lines";
import { LessonNav } from "./lesson-nav";
import { PythonStatus } from "./python-status";
import { ResetCode } from "./reset-code";
import { TestsPanel } from "./tests-panel";

export type WorkspaceLesson = {
  /** The lesson's ID, which its completion is kept under (FR-PRG-07). */
  id: LessonId;
  /** What a first pass earns (FR-WSP-06). */
  xp: number;
  course: { slug: string; title: string };
  slug: string;
  title: string;
  starterCode: string;
  hints: readonly string[];
  tests: readonly TestCase[];
  neighbours: Neighbours;
};

/**
 * The admin's preview of a lesson (docs/spec/03-experience.md section 7.7;
 * FR-ADM-08): the same workspace, which keeps nothing on the device and
 * records no completion, with a banner that says so.
 */
export type WorkspacePreview = {
  /** Where the back link goes: the lesson's editor. */
  backHref: string;
  backLabel: string;
};

/** How long typing pauses before the code is saved on the device. */
const SAVE_DELAY_MS = 400;

type OutputTab = "console" | "tests";

export { inputLines } from "./input-lines";

/** Neither value below changes while the page is open. */
const subscribeToNothing = () => () => undefined;
let support: boolean | undefined;
// Worked out once: the check builds a worker, so it does not run on every render.
const isSupported = () => (support ??= supportsPython(window));
const isApple = () => /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);

// The screen's width and the on-screen keyboard change while the page is open.
const subscribeToNarrow = (onChange: () => void) => narrowScreen(window).subscribe(onChange);
const isNarrow = () => narrowScreen(window).snapshot();

const isPhoneView = (key: unknown): key is PhoneView =>
  PHONE_VIEWS.some((phoneView) => phoneView === key);

/**
 * The lesson workspace. At 768 px and wider (docs/spec/03-experience.md
 * section 6.1; FR-WSP-01): the instructions beside the work, the editor above
 * the actions and the output, previous and next below; the page does not
 * scroll, each pane does. Below 768 px (section 6.8; FR-WSP-13): a tab list
 * shows one of three views, Lesson, Code and Output, and Run, Check and Stop
 * sit in a bar fixed above the on-screen keyboard. The server renders the
 * wide layout, whose regions follow one another below 768 px, until the
 * browser knows the screen's width.
 */
export function Workspace({
  lesson,
  instructions,
  nonce,
  preview,
}: {
  lesson: WorkspaceLesson;
  /** The rendered instructions, from the server. */
  instructions: ReactNode;
  nonce: string;
  /** Set only by the admin's preview, which records nothing. */
  preview?: WorkspacePreview;
}) {
  const previewing = preview !== undefined;
  const root = useRef<HTMLDivElement>(null);
  const editorLabel = useId();
  const key = savedCodeKey(lesson.course.slug, lesson.slug);

  // The browser and the system's keys are known only in the browser; the
  // server renders as if neither were known yet.
  const supported = useSyncExternalStore(subscribeToNothing, isSupported, () => undefined);
  const apple = useSyncExternalStore(subscribeToNothing, isApple, () => false);
  // Undefined on the server and in the first render: the width is not known.
  const narrow = useSyncExternalStore<boolean | undefined>(
    subscribeToNarrow,
    isNarrow,
    () => undefined,
  );
  const [phoneView, setPhoneView] = useState<PhoneView>("lesson");
  const shownView = useRef(phoneView);
  const actionBar = useRef<HTMLDivElement>(null);
  // Whether the learner's last answer came from the console's input line,
  // held here so it outlives the console when the layout changes at 768 px.
  const answered = useRef(false);
  const wasAnswered = useCallback(() => answered.current, []);
  const setAnswered = useCallback((sent: boolean) => {
    answered.current = sent;
  }, []);
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
  const [completion, setCompletion] = useState<{ summary: CheckSummary; first: boolean }>();
  const [durability, setDurability] = useState<Durability>("device");
  const recorded = useRef<CheckSummary | undefined>(undefined);
  const unsynced = useSyncExternalStore(syncStatus.subscribe, syncStatus.unsynced, () => false);

  // The saved code is on the device, so it is read only here. A preview keeps
  // code in memory only, so it never reads or replaces a learner's saved code.
  useEffect(() => {
    const codeStore = createCodeStore(
      previewing || typeof indexedDB === "undefined" ? undefined : indexedDB,
    );
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
  }, [key, lesson.starterCode, previewing]);

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
  const { view, chart, dispatch, sendInput, endInput, lastCheckedSource } = useRuntime(program, {
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

  // Whether the device keeps what is saved, known only in the browser (FR-PRG-01).
  // A preview asks nothing of the device: its banner says nothing is kept.
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    if (!previewing) {
      void deviceProgress()
        .durability()
        .then((known) => {
          if (mounted.current) setDurability(known);
        });
    }
    return () => {
      mounted.current = false;
    };
  }, [previewing]);

  // A check that passed every test is kept on the device at once, once per
  // summary (NFR-REL-01). The store says whether it is the lesson's first
  // pass, which alone earns its XP (FR-WSP-06).
  useEffect(() => {
    const summary = view.summary;
    // A preview records nothing (FR-ADM-08); its line says so.
    if (previewing || view.ended !== "check" || summary?.allPassed !== true) return;
    if (recorded.current === summary) return;
    recorded.current = summary;
    const progress = deviceProgress();
    void progress
      .record({ lessonId: lesson.id, completedAt: Date.now(), code: lastCheckedSource() ?? "" })
      .then(async (first) => {
        // A later answer is harmless: the line shows only beside its own summary.
        if (mounted.current) setCompletion({ summary, first });
        const known = await progress.durability();
        if (mounted.current) setDurability(known);
      });
  }, [view.ended, view.summary, lesson.id, lastCheckedSource, previewing]);

  // A guest is invited to save progress below a lesson's first completion,
  // when the device keeps it (FR-AUTH-07): in memory the warning above the
  // editor already says what is lost, and "saved on this device" would be false.
  const guestInvitation = useGuestInvitation();
  const invitation =
    completion !== undefined &&
    completion.summary === view.summary &&
    completion.first &&
    durability === "device" &&
    !previewing
      ? guestInvitation
      : null;

  const completionText = previewing
    ? view.ended === "check" && view.summary?.allPassed === true
      ? words.previewComplete
      : undefined
    : completion !== undefined && completion.summary === view.summary
      ? completion.first
        ? words.completeFirst(lesson.xp)
        : words.completeAgain
      : undefined;

  const runtime = chart.runtime;
  const pending = "pending" in runtime ? runtime.pending : null;
  const canPress = (type: "RUN" | "CHECK") => canStart(chart) || isRemembered(runtime.name, type);
  // Only a draft in the admin's preview can have no test case: the worker
  // refuses a check of none, so Check is off and the tests panel says why.
  const noTests = lesson.tests.length === 0;
  const press = (action: "run" | "check") => {
    const type = action === "run" ? "RUN" : "CHECK";
    if (!canPress(type) || (action === "check" && noTests)) return;
    // The worker would refuse it and nothing would happen, so say why instead.
    // Check sends no typed-in input.
    const over = tooLarge(
      code,
      action === "run" && !view.interactiveInput ? inputLines(batchInput) : undefined,
    );
    setRefusal(over);
    // Below 768 px, Run and Check show the Output view: the console or the tests.
    setPhoneView("output");
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
    setPhoneView("code");
    setGoToLine((previous) => ({ line, request: (previous?.request ?? 0) + 1 }));
  };

  const passed = chart.lesson === "passed";
  const strategy = view.interactiveInput ? "interactive" : "batch";
  const runLabel = pending === "run" ? words.runPending : words.run;
  const checkLabel = pending === "check" ? words.checkPending : words.check;

  // The three views exist only when the workspace can run Python.
  const phone = narrow === true && supported !== false;

  // Below 768 px the action bar sits on the on-screen keyboard, and the page
  // keeps room for the bar at its end. Both are CSS variables written on the
  // workspace's element as the visual viewport and the bar change, with no
  // render.
  useEffect(() => {
    const element = root.current;
    const bar = actionBar.current;
    if (!phone || element === null || bar === null) return;
    const viewport = window.visualViewport;
    const placeBar = () => {
      element.style.setProperty(
        "--keyboard-inset",
        `${keyboardInset(document.documentElement.clientHeight, viewport)}px`,
      );
    };
    placeBar();
    viewport?.addEventListener("resize", placeBar);
    viewport?.addEventListener("scroll", placeBar);
    const observer =
      typeof ResizeObserver === "undefined"
        ? undefined
        : new ResizeObserver(() => {
            element.style.setProperty(
              "--action-bar-size",
              `${Math.ceil(bar.getBoundingClientRect().height)}px`,
            );
          });
    observer?.observe(bar);
    return () => {
      viewport?.removeEventListener("resize", placeBar);
      viewport?.removeEventListener("scroll", placeBar);
      observer?.disconnect();
      element.style.removeProperty("--keyboard-inset");
      element.style.removeProperty("--action-bar-size");
    };
  }, [phone]);

  // When the view changes under the focus (Run from the editor's shortcut, Go
  // to line from the output), the focused element is now hidden and inert,
  // and the browser would drop focus to the page. The selected tab takes it,
  // so the learner keeps a place in the workspace and the shortcuts still work.
  useEffect(() => {
    if (shownView.current === phoneView) return;
    shownView.current = phoneView;
    if (!phone) return;
    const active = document.activeElement;
    if (
      active instanceof HTMLElement &&
      active !== document.body &&
      active.closest("[inert]") === null
    )
      return;
    root.current
      ?.querySelector<HTMLElement>('[role="tablist"] [role="tab"][aria-selected="true"]')
      ?.focus();
  }, [phone, phoneView]);

  const onKeyDownCapture = (event: KeyboardEvent<HTMLDivElement>) => {
    // React passes events up through portals, so a key pressed in the
    // reset dialog arrives here too; only keys pressed in the page count.
    if (!(event.target instanceof Node) || root.current?.contains(event.target) !== true) return;
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
  };

  const title = (
    <div className="flex flex-col gap-1 border-be border-border px-gutter py-3 md:col-span-2">
      <div>
        <Link href={preview?.backHref ?? courseBackPath(lesson.course.slug)} variant="standalone">
          {preview?.backLabel ?? words.backToCourse(lesson.course.title)}
        </Link>
      </div>
      <h1 className="text-xl font-semibold text-text">{lesson.title}</h1>
      {previewing && (
        <Notice kind="information" kindLabel={words.previewKind}>
          {words.previewBody}
        </Notice>
      )}
    </div>
  );

  const lessonText = (
    <>
      <h2 id="workspace-instructions" className="sr-only">
        {words.instructions}
      </h2>
      {instructions}
      <Hints hints={lesson.hints} />
    </>
  );

  const editorPart = (
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
      {durability === "memory" && (
        <Notice kind="warning" kindLabel={words.warningKind}>
          <strong className="font-semibold">{words.memoryTitle}</strong> {words.memoryBody}
        </Notice>
      )}
      {unsynced && (
        <Notice kind="warning" kindLabel={words.warningKind} announce="polite">
          <strong className="font-semibold">{words.unsyncedTitle}</strong> {words.unsyncedBody}
        </Notice>
      )}
      {/* Always present, so the words are announced when they appear. */}
      <div role="status" className={beforeReset === undefined ? "sr-only" : "text-base text-text"}>
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
      <div className="grid min-h-(--workspace-editor-min) md:min-h-0 md:flex-1">
        <CodeEditor
          labelledBy={editorLabel}
          value={code}
          onChange={edit}
          nonce={nonce}
          fill
          goToLine={goToLine}
        />
      </div>
    </>
  );

  // Below 768 px the bar has no icons and no keys, so it fits one row at 320 px.
  const actions = (
    <div
      ref={actionBar}
      className={cx(
        "flex flex-wrap items-center gap-3 px-gutter",
        phone
          ? "fixed inset-x-0 inset-be-(--keyboard-inset) z-10 border-bs border-border bg-bg py-3"
          : narrow === undefined && "max-md:hidden",
      )}
    >
      <Button
        variant="secondary"
        {...(!phone && { icon: <Play size={16} /> })}
        isPending={!canPress("RUN")}
        keyShortcuts={ariaKeyShortcuts("run", apple)}
        onPress={() => {
          press("run");
        }}
      >
        {runLabel}
        {!phone && (
          <kbd aria-hidden="true" className="font-mono text-xs text-text-muted">
            {words.shortcut(apple, false)}
          </kbd>
        )}
      </Button>
      <Button
        variant={passed ? "secondary" : "primary"}
        {...(!phone && { icon: <Checkmark size={16} /> })}
        isPending={!canPress("CHECK")}
        isDisabled={noTests}
        keyShortcuts={ariaKeyShortcuts("check", apple)}
        onPress={() => {
          press("check");
        }}
      >
        {checkLabel}
        {!phone && (
          <kbd aria-hidden="true" className="font-mono text-xs opacity-80">
            {words.shortcut(apple, true)}
          </kbd>
        )}
      </Button>
      <Button
        variant="secondary"
        {...(!phone && { icon: <StopFilledAlt size={16} /> })}
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
  );

  const outputPart = (
    <>
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
                answered={wasAnswered}
                setAnswered={setAnswered}
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
                completion={completionText}
                invitation={invitation}
                checking={runtime.name === "checking"}
                checkEnded={view.ended === "check"}
                strategy={strategy}
                onGoToLine={moveTo}
              />
            ),
          },
        ]}
      />
    </>
  );

  // Outside the views, so it is said whichever view is showing.
  // The completion has its own region: it arrives after the summary, once
  // the device has kept the pass, and the summary is not said again.
  const announcementRegion = (
    <>
      <div role="status" className="sr-only">
        {announcement}
      </div>
      <div role="status" className="sr-only" data-completion-announcement>
        {view.ended === "check" ? (completionText ?? "") : ""}
      </div>
    </>
  );

  // A preview has no previous or next: the lesson may be the course's only
  // draft, and its neighbours' public addresses may not exist yet.
  const nav = previewing ? null : (
    <LessonNav course={lesson.course.slug} neighbours={lesson.neighbours} passed={passed} />
  );

  // The root's children are keyed, and the action bar is one of them in both
  // layouts, so crossing 768 px moves the bar instead of building it again: a
  // focused button keeps its element, and what React Aria announced about it
  // still names an element in the page.
  if (phone) {
    // Below 768 px (section 6.8): one view at a time, the bar fixed at the end.
    return (
      <div
        ref={root}
        data-workspace
        data-phone={phoneView}
        className="flex flex-col pbe-(--action-bar-size)"
        onKeyDownCapture={onKeyDownCapture}
      >
        <Fragment key="title">{title}</Fragment>
        <Tabs
          key="views"
          kind="views"
          label={words.views}
          selectedKey={phoneView}
          onSelectionChange={(key) => {
            if (isPhoneView(key)) setPhoneView(key);
          }}
          items={[
            {
              id: "lesson",
              title: words.viewLesson,
              content: (
                <section
                  aria-labelledby="workspace-instructions"
                  className="flex flex-col gap-6 px-gutter py-5"
                >
                  {lessonText}
                  <Button
                    variant="secondary"
                    block
                    onPress={() => {
                      setPhoneView("code");
                    }}
                  >
                    {words.toCode}
                  </Button>
                </section>
              ),
            },
            {
              id: "code",
              title: words.viewCode,
              content: (
                <section
                  aria-labelledby={editorLabel}
                  className="flex flex-col gap-3 px-gutter py-4"
                >
                  {editorPart}
                </section>
              ),
            },
            {
              id: "output",
              title: words.viewOutput,
              content: (
                <section aria-label={words.output} className="flex flex-col gap-3 px-gutter py-4">
                  {outputPart}
                </section>
              ),
            },
          ]}
        />
        <Fragment key="announcement">{announcementRegion}</Fragment>
        {/* Previous and next end the Lesson and Output views. */}
        <div key="nav" hidden={phoneView === "code"}>
          {nav}
        </div>
        <Fragment key="actions">{actions}</Fragment>
      </div>
    );
  }

  // Until the width is known, a narrow screen shows the title and the lesson
  // only, the first view it will get, so nothing below the lesson jumps away.
  const beforeWidth = narrow === undefined && "max-md:hidden";
  return (
    <div
      ref={root}
      data-workspace
      className="flex flex-col md:grid md:h-full md:grid-cols-(--workspace-columns) md:grid-rows-(--workspace-rows)"
      onKeyDownCapture={onKeyDownCapture}
    >
      <Fragment key="title">{title}</Fragment>
      <section
        key="lesson"
        aria-labelledby="workspace-instructions"
        className="flex min-h-0 flex-col gap-6 overflow-auto border-be border-border px-gutter py-5 md:row-span-3 md:border-be-0 md:border-e"
      >
        {lessonText}
      </section>
      {supported === false && (
        <section
          key="unsupported"
          aria-labelledby={editorLabel}
          className="flex flex-col gap-3 px-gutter py-4 md:row-span-3"
        >
          <h2 id={editorLabel} className="sr-only">
            {words.work}
          </h2>
          <Notice kind="warning" kindLabel={words.warningKind}>
            <strong className="font-semibold">{words.unsupportedTitle}</strong>{" "}
            {words.unsupportedBody}
          </Notice>
        </section>
      )}
      {supported !== false && (
        <section
          key="code"
          aria-labelledby={editorLabel}
          className={cx("flex min-h-0 flex-col gap-3 px-gutter pbs-4 pbe-3", beforeWidth)}
        >
          {editorPart}
        </section>
      )}
      {supported !== false && <Fragment key="actions">{actions}</Fragment>}
      {supported !== false && (
        <section
          key="output"
          aria-label={words.output}
          className={cx(
            "flex min-h-(--workspace-output-min) flex-col gap-3 px-gutter pbs-3 pbe-4 md:min-h-0",
            beforeWidth,
          )}
        >
          {outputPart}
        </section>
      )}
      <Fragment key="announcement">{announcementRegion}</Fragment>
      <div key="nav" className={cx("md:col-span-2", beforeWidth)}>
        {nav}
      </div>
    </div>
  );
}
