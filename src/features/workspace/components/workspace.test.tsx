// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { LessonId } from "@/domain/ids";
import { EXAMPLE_LESSON } from "@/grader/example-lesson";
import { goToLine, workspace as words } from "@/messages/workspace";
import type { RunId } from "@/runtime/protocol";
import { SOURCE_LIMIT } from "@/runtime/protocol";
import type { WorkspaceEvent, WorkspaceState } from "@/runtime/workspace-chart";
import { NARROW_QUERY } from "../client/phone-layout";
import { INITIAL_VIEW, type RuntimeView } from "../client/runtime-view";
import { runAnnouncement } from "../client/workspace-view";

// The workspace's own rules, with the runtime, the editor and the device
// store replaced: the shortcuts and their labels (FR-WSP-12), what the live
// region says (NFR-A11Y-04), reset with undo (FR-WSP-10), a refused program
// (FR-WSP-04), and the batch field's lines (FR-WSP-08). The journeys in
// e2e/workspace-runtime.spec.ts drive the real runtime.

const runtime = vi.hoisted(() => ({
  view: undefined as unknown as RuntimeView,
  chart: undefined as unknown as WorkspaceState,
  dispatch: vi.fn<(event: WorkspaceEvent) => void>(),
  program: undefined as unknown as (interactive: boolean) => { stdin: string[] | undefined },
  /** The source the last check started with, as the hook reports it. */
  checkedSource: undefined as string | undefined,
}));

vi.mock("../client/use-runtime", () => ({
  useRuntime: (program: typeof runtime.program) => {
    runtime.program = program;
    return {
      view: runtime.view,
      chart: runtime.chart,
      dispatch: runtime.dispatch,
      sendInput: () => ({ ok: true }),
      endInput: () => undefined,
      lastCheckedSource: () => runtime.checkedSource,
    };
  },
}));
// The device's progress store, answering as the test says.
const progress = vi.hoisted(() => ({
  first: true,
  durability: "device" as "device" | "memory",
  /** When set, `record` answers only once the test calls it. */
  hold: undefined as undefined | ((answer: () => void) => void),
  record: vi.fn<(completion: { lessonId: string; completedAt: number; code: string }) => void>(),
  /** What the root layout hands down: the invitation for a guest, null when signed in. */
  invitation: null as unknown,
}));
// What the sync says is still waiting, as the test sets it.
const sync = vi.hoisted(() => {
  let unsynced = false;
  let listener = () => {};
  return {
    unsynced: () => unsynced,
    set: (next: boolean) => {
      unsynced = next;
      listener();
    },
    subscribe: (changed: () => void) => {
      listener = changed;
      return () => {};
    },
  };
});
vi.mock("@/features/progress", () => ({
  syncStatus: sync,
  deviceProgress: () => ({
    record: (completion: { lessonId: string; completedAt: number; code: string }) => {
      progress.record(completion);
      const first = progress.first;
      const hold = progress.hold;
      if (hold === undefined) return Promise.resolve(first);
      return new Promise<boolean>((resolve) => {
        hold(() => {
          resolve(first);
        });
      });
    },
    durability: () => Promise.resolve(progress.durability),
  }),
  useGuestInvitation: () => progress.invitation,
}));
vi.mock("../client/browser-support", () => ({ supportsPython: () => true }));
vi.mock("../client/saved-code", () => ({
  savedCodeKey: (course: string, lesson: string) => `${course}/${lesson}`,
  createCodeStore: () => ({
    load: () => Promise.resolve(undefined),
    save: () => Promise.resolve(),
  }),
}));
vi.mock("./code-editor", () => ({
  CodeEditor: ({
    value,
    onChange,
    labelledBy,
  }: {
    value: string;
    onChange: (next: string) => void;
    labelledBy: string;
  }) => (
    <textarea
      aria-labelledby={labelledBy}
      value={value}
      onChange={(event) => {
        onChange(event.target.value);
      }}
    />
  ),
}));

const { Workspace } = await import("./workspace");

const lesson = {
  id: "00000000-0000-4000-8000-00000000e001" as LessonId,
  xp: 10,
  course: { slug: "python-basics", title: "Python basics" },
  slug: "say-hello",
  title: EXAMPLE_LESSON.title,
  starterCode: EXAMPLE_LESSON.starter,
  hints: [],
  tests: EXAMPLE_LESSON.testCases,
  neighbours: { previous: null, next: null },
};

function show() {
  return render(<Workspace lesson={lesson} instructions={null} nonce="nonce" />);
}

const editor = () => screen.getByRole("textbox", { name: words.work });
const button = (name: string) => screen.getByRole("button", { name: new RegExp(`^${name}`) });

// jsdom has no media queries; each test says how wide the screen is.
let narrow = false;
beforeEach(() => {
  narrow = false;
  vi.stubGlobal("matchMedia", (query: string) => ({
    matches: query === NARROW_QUERY && narrow,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
  }));
  runtime.view = { ...INITIAL_VIEW, status: "ready" };
  runtime.chart = { runtime: { name: "ready" }, lesson: "untouched" };
  runtime.dispatch.mockReset();
  progress.first = true;
  progress.durability = "device";
  progress.record.mockReset();
  progress.hold = undefined;
  progress.invitation = null;
  runtime.checkedSource = undefined;
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("[FR-WSP-12] shortcuts", () => {
  it("Run and Check name their keys for assistive technology and show them", () => {
    show();
    expect(button(words.run).getAttribute("aria-keyshortcuts")).toBe("Control+Enter");
    expect(button(words.check).getAttribute("aria-keyshortcuts")).toBe("Control+Shift+Enter");
    expect(within(button(words.run)).getByText(words.shortcut(false, false))).toBeTruthy();
  });

  it("Ctrl Enter runs, Ctrl Shift Enter checks, and a held key presses nothing more", () => {
    show();
    fireEvent.keyDown(editor(), { key: "Enter", ctrlKey: true });
    fireEvent.keyDown(editor(), { key: "Enter", ctrlKey: true, shiftKey: true });
    const held = fireEvent.keyDown(editor(), { key: "Enter", ctrlKey: true, repeat: true });
    expect(runtime.dispatch.mock.calls.map(([event]) => event.type)).toEqual(["RUN", "CHECK"]);
    // The held key is still kept from the editor, which would add a line.
    expect(held).toBe(false);
  });
});

describe("[NFR-A11Y-04] the live region", () => {
  it("says a run's outcome once it has ended, and a check's summary", () => {
    const { rerender } = show();
    const region = () =>
      screen.getAllByRole("status").find((element) => element.textContent !== "");
    expect(region()).toBeUndefined();

    const result = {
      runId: "run-1" as RunId,
      outcome: { kind: "ok" } as const,
      truncated: false,
      durationMs: 3,
    };
    runtime.view = {
      ...runtime.view,
      output: [{ stream: "stdout", text: "hi\n" }],
      result,
      ended: "run",
    };
    rerender(<Workspace lesson={lesson} instructions={null} nonce="nonce" />);
    expect(region()?.textContent).toBe(runAnnouncement(result, 1));

    runtime.view = {
      ...runtime.view,
      summary: { total: 2, passed: 1, failed: 1, notRun: 0, allPassed: false, timeLimit: false },
      ended: "check",
    };
    rerender(<Workspace lesson={lesson} instructions={null} nonce="nonce" />);
    expect(region()?.textContent).toBe(words.summary(1, 2));
  });
});

describe("[FR-WSP-10] reset with undo", () => {
  it("puts the starter code back after a confirmation, and Undo restores the code before it", async () => {
    show();
    const reset = button(words.reset);
    expect(reset.getAttribute("aria-disabled")).toBe("true");
    fireEvent.change(editor(), { target: { value: "print('mine')" } });
    expect(reset.getAttribute("aria-disabled")).toBeNull();

    await userEvent.click(reset);
    await userEvent.click(
      within(screen.getByRole("dialog")).getByRole("button", { name: words.resetConfirm }),
    );
    expect(editor()).toHaveProperty("value", EXAMPLE_LESSON.starter);
    expect(screen.getByText(words.resetDone)).toBeTruthy();

    await userEvent.click(screen.getByRole("button", { name: words.undo }));
    expect(editor()).toHaveProperty("value", "print('mine')");
    expect(screen.queryByText(words.resetDone)).toBeNull();
  });
});

describe("[FR-WSP-04] a program the worker would refuse", () => {
  it("is not sent, and the reason is said until the code changes", async () => {
    show();
    fireEvent.change(editor(), { target: { value: "#".repeat(SOURCE_LIMIT + 1) } });
    await userEvent.click(button(words.run));
    expect(runtime.dispatch.mock.calls.map(([event]) => event.type)).toEqual(["CODE_EDITED"]);
    expect(await screen.findByText(words.tooLarge("source", SOURCE_LIMIT))).toBeTruthy();
    fireEvent.change(editor(), { target: { value: "print()" } });
    expect(screen.queryByText(words.tooLarge("source", SOURCE_LIMIT))).toBeNull();
  });
});

describe("[FR-WSP-08] the batch field", () => {
  it("gives one answer per line, and the line break after the last adds none", async () => {
    runtime.view = { ...runtime.view, interactiveInput: false };
    show();
    const field = screen.getByLabelText(words.batchLabel);
    await act(async () => {
      fireEvent.change(field, { target: { value: "3\n4\n" } });
      await Promise.resolve();
    });
    expect(runtime.program(false).stdin).toEqual(["3", "4"]);
    expect(runtime.program(true).stdin).toBeUndefined();
  });
});

describe("[FR-WSP-13] below 768 px", () => {
  const views = () => within(screen.getByRole("tablist", { name: words.views }));
  const tab = (name: string) => views().getByRole("tab", { name });
  // A view that is not selected stays in the page, hidden and inert.
  const shown = (element: Element) => element.closest("[inert]") === null;
  const lessonAction = () => screen.getByRole("button", { name: words.toCode, hidden: true });
  const consoleTab = () => screen.getByRole("tab", { name: words.console, hidden: true });
  const testsTab = () => screen.getByRole("tab", { name: words.tests, hidden: true });
  const hiddenEditor = () => screen.getByRole("textbox", { name: words.work, hidden: true });

  it("shows one of three views, the Lesson first, with the others inert", () => {
    narrow = true;
    show();
    expect(
      views()
        .getAllByRole("tab")
        .map((element) => element.textContent),
    ).toEqual([
      words.viewLesson + words.viewLesson,
      words.viewCode + words.viewCode,
      words.viewOutput + words.viewOutput,
    ]);
    expect(tab(words.viewLesson).getAttribute("aria-selected")).toBe("true");
    expect(shown(lessonAction())).toBe(true);
    expect(shown(hiddenEditor())).toBe(false);
    expect(shown(consoleTab())).toBe(false);
    expect(
      document.querySelector(`[role="tabpanel"][aria-labelledby="${tab(words.viewLesson).id}"]`),
    ).not.toBeNull();
  });

  it("ends the Lesson view with one action that shows the Code view and focuses its tab", async () => {
    narrow = true;
    show();
    await userEvent.click(lessonAction());
    expect(shown(hiddenEditor())).toBe(true);
    expect(shown(lessonAction())).toBe(false);
    expect(document.activeElement).toBe(tab(words.viewCode));
  });

  it("moves between views with the arrow keys", async () => {
    narrow = true;
    show();
    act(() => {
      tab(words.viewLesson).focus();
    });
    await userEvent.keyboard("{ArrowRight}");
    expect(tab(words.viewCode).getAttribute("aria-selected")).toBe("true");
    expect(document.activeElement).toBe(tab(words.viewCode));
    expect(shown(hiddenEditor())).toBe(true);
  });

  it("Run shows the Output view with the console, Check the Output view with the tests", async () => {
    narrow = true;
    show();
    await userEvent.click(button(words.run));
    expect(tab(words.viewOutput).getAttribute("aria-selected")).toBe("true");
    expect(shown(consoleTab())).toBe(true);
    expect(consoleTab().getAttribute("aria-selected")).toBe("true");
    await userEvent.click(tab(words.viewLesson));
    await userEvent.click(button(words.check));
    expect(tab(words.viewOutput).getAttribute("aria-selected")).toBe("true");
    expect(testsTab().getAttribute("aria-selected")).toBe("true");
    expect(runtime.dispatch.mock.calls.map(([event]) => event.type)).toEqual(["RUN", "CHECK"]);
  });

  it("a shortcut in the editor shows the Output view, keeps focus in the workspace, and works again", async () => {
    narrow = true;
    show();
    await userEvent.click(tab(words.viewCode));
    act(() => {
      hiddenEditor().focus();
    });
    fireEvent.keyDown(hiddenEditor(), { key: "Enter", ctrlKey: true });
    expect(tab(words.viewOutput).getAttribute("aria-selected")).toBe("true");
    expect(document.activeElement).toBe(tab(words.viewOutput));
    fireEvent.keyDown(document.activeElement ?? document.body, { key: "Enter", ctrlKey: true });
    expect(runtime.dispatch.mock.calls.map(([event]) => event.type)).toEqual(["RUN", "RUN"]);
  });

  it("Go to line on an error shows the Code view", async () => {
    narrow = true;
    runtime.view = {
      ...runtime.view,
      result: {
        runId: "run-1" as RunId,
        outcome: { kind: "syntax", message: "invalid syntax", line: 2 },
        truncated: false,
        durationMs: 3,
      },
      ended: "run",
    };
    show();
    await userEvent.click(tab(words.viewOutput));
    await userEvent.click(screen.getByRole("button", { name: goToLine(2) }));
    expect(tab(words.viewCode).getAttribute("aria-selected")).toBe("true");
    expect(shown(hiddenEditor())).toBe(true);
  });

  it("keeps Run, Check and Stop in the bar in every view, with no icons or keys", async () => {
    narrow = true;
    show();
    for (const name of [words.viewLesson, words.viewCode, words.viewOutput]) {
      await userEvent.click(tab(name));
      expect(shown(button(words.run))).toBe(true);
      expect(shown(button(words.check))).toBe(true);
      expect(shown(screen.getByRole("button", { name: words.stop }))).toBe(true);
    }
    expect(button(words.run).textContent).toBe(words.run);
  });

  it("places the bar above the on-screen keyboard from the visual viewport", () => {
    narrow = true;
    const listeners = new Map<string, () => void>();
    const viewport = {
      height: 460,
      offsetTop: 0,
      addEventListener: (type: string, listener: () => void) => {
        listeners.set(type, listener);
      },
      removeEventListener: (type: string) => {
        listeners.delete(type);
      },
    };
    vi.stubGlobal("visualViewport", viewport);
    const height = vi.spyOn(document.documentElement, "clientHeight", "get").mockReturnValue(800);
    const { container, unmount } = show();
    const root = container.querySelector<HTMLElement>("[data-workspace]");
    expect(root?.style.getPropertyValue("--keyboard-inset")).toBe("340px");
    viewport.height = 800;
    act(() => {
      listeners.get("resize")?.();
    });
    expect(root?.style.getPropertyValue("--keyboard-inset")).toBe("0px");
    unmount();
    expect(listeners.size).toBe(0);
    height.mockRestore();
  });

  it("says a run's outcome from any view", () => {
    narrow = true;
    const { rerender } = show();
    const result = {
      runId: "run-1" as RunId,
      outcome: { kind: "ok" } as const,
      truncated: false,
      durationMs: 3,
    };
    runtime.view = { ...runtime.view, output: [], result, ended: "run" };
    rerender(<Workspace lesson={lesson} instructions={null} nonce="nonce" />);
    const region = screen
      .getAllByRole("status")
      .find((element) => element.textContent === runAnnouncement(result, 0));
    expect(region).toBeDefined();
    expect(region?.closest("[inert], [hidden]")).toBeNull();
  });

  it("is not built at 768 px and wider", () => {
    show();
    expect(screen.queryByRole("tablist", { name: words.views })).toBeNull();
    expect(screen.queryByRole("button", { name: words.toCode })).toBeNull();
  });
});

describe("[FR-WSP-06] [FR-PRG-01] [NFR-REL-01] the completion moment", () => {
  const passedAll = {
    total: 2,
    passed: 2,
    failed: 0,
    notRun: 0,
    allPassed: true,
    timeLimit: false,
  };
  const passedOne = {
    total: 2,
    passed: 1,
    failed: 1,
    notRun: 0,
    allPassed: false,
    timeLimit: false,
  };
  const line = () => document.querySelector("[data-completion]")?.textContent ?? null;
  const regions = () => screen.getAllByRole("status").map((element) => element.textContent);
  const completionRegion = () =>
    document.querySelector("[data-completion-announcement]")?.textContent ?? "";
  const again = (ended: "run" | "check", rerender: (ui: React.ReactElement) => void) => {
    runtime.view = { ...runtime.view, ended };
    rerender(<Workspace lesson={lesson} instructions={null} nonce="nonce" />);
  };

  async function check(summary: typeof passedAll, rerender: (ui: React.ReactElement) => void) {
    fireEvent.change(editor(), { target: { value: 'print("mine")' } });
    await userEvent.click(button(words.check));
    runtime.checkedSource = 'print("mine")';
    runtime.view = { ...runtime.view, summary, ended: "check" };
    await act(async () => {
      rerender(<Workspace lesson={lesson} instructions={null} nonce="nonce" />);
      await Promise.resolve();
    });
  }

  it("keeps a pass on the device with the checked code, and shows the XP of a first pass", async () => {
    const { rerender } = show();
    await check(passedAll, rerender);
    expect(progress.record).toHaveBeenCalledOnce();
    expect(progress.record.mock.calls[0]?.[0]).toMatchObject({
      lessonId: lesson.id,
      code: 'print("mine")',
    });
    await waitFor(() => {
      expect(line()).toBe(words.completeFirst(10));
    });
    // Two regions: the summary is not said again when the completion arrives.
    expect(regions()).toContain(words.summary(2, 2));
    expect(regions()).not.toContain(`${words.summary(2, 2)}. ${words.completeFirst(10)}`);
    expect(completionRegion()).toBe(words.completeFirst(10));
  });

  it("keeps the code the check started with, not the code typed since", async () => {
    const { rerender } = show();
    await check(passedAll, rerender);
    fireEvent.change(editor(), { target: { value: 'print("later")' } });
    expect(progress.record.mock.calls[0]?.[0].code).toBe('print("mine")');
    runtime.checkedSource = 'print("started late")';
    runtime.view = { ...runtime.view, summary: { ...passedAll }, ended: "check" };
    await act(async () => {
      rerender(<Workspace lesson={lesson} instructions={null} nonce="nonce" />);
      await Promise.resolve();
    });
    expect(progress.record.mock.calls[1]?.[0].code).toBe('print("started late")');
  });

  it("shows the XP line even when a run starts before the device answers", async () => {
    let answer: (() => void) | undefined;
    progress.hold = (release) => {
      answer = release;
    };
    const { rerender } = show();
    await check(passedAll, rerender);
    again("run", rerender);
    await act(async () => {
      answer?.();
      await Promise.resolve();
    });
    again("check", rerender);
    await waitFor(() => {
      expect(line()).toBe(words.completeFirst(10));
    });
    expect(progress.record).toHaveBeenCalledOnce();
  });

  it("shows the notice when a write is refused during the visit", async () => {
    const { rerender } = show();
    await act(async () => {
      await Promise.resolve();
    });
    expect(screen.queryByText(words.memoryTitle)).toBeNull();
    progress.durability = "memory";
    await check(passedAll, rerender);
    expect(await screen.findByText(words.memoryTitle)).toBeTruthy();
  });

  it("says a repeat pass earns no XP again", async () => {
    progress.first = false;
    const { rerender } = show();
    await check(passedAll, rerender);
    await waitFor(() => {
      expect(line()).toBe(words.completeAgain);
    });
    expect(screen.queryAllByText(words.completeFirst(10))).toEqual([]);
  });

  it("keeps one pass once, however often the same result renders", async () => {
    const { rerender } = show();
    await check(passedAll, rerender);
    again("run", rerender);
    again("check", rerender);
    expect(progress.record).toHaveBeenCalledOnce();
  });

  it("keeps nothing and says nothing of completion when a test fails", async () => {
    const { rerender } = show();
    await check(passedOne, rerender);
    expect(progress.record).not.toHaveBeenCalled();
    expect(line()).toBeNull();
    expect(regions()).toContain(words.summary(1, 2));
    expect(completionRegion()).toBe("");
  });

  it("drops the completion line when a later check fails", async () => {
    const { rerender } = show();
    await check(passedAll, rerender);
    await waitFor(() => {
      expect(line()).toBe(words.completeFirst(10));
    });
    runtime.view = { ...runtime.view, summary: { ...passedOne }, ended: "check" };
    rerender(<Workspace lesson={lesson} instructions={null} nonce="nonce" />);
    expect(line()).toBeNull();
  });

  const INVITATION = "Save your progress here";
  const invitation = () => screen.queryByText(INVITATION);

  it("[FR-AUTH-07] invites a guest below a first completion, without a dialog", async () => {
    progress.invitation = <p>{INVITATION}</p>;
    const { rerender } = show();
    expect(invitation()).toBeNull();
    await check(passedAll, rerender);
    await waitFor(() => {
      expect(invitation()).not.toBeNull();
    });
    const host = invitation()?.closest("[data-invitation-host]");
    expect(host?.getAttribute("tabindex")).toBe("-1");
    // Below the completion line, in the tests panel, and nothing is modal.
    const completion = document.querySelector("[data-completion]");
    expect(completion?.compareDocumentPosition(host!)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(button(words.check).hasAttribute("disabled")).toBe(false);
  });

  it("[FR-AUTH-07] does not invite after a repeat pass", async () => {
    progress.invitation = <p>{INVITATION}</p>;
    progress.first = false;
    const { rerender } = show();
    await check(passedAll, rerender);
    await waitFor(() => {
      expect(line()).toBe(words.completeAgain);
    });
    expect(invitation()).toBeNull();
  });

  it("[FR-AUTH-07] does not invite a signed-in learner, for whom the layout hands down nothing", async () => {
    progress.invitation = null;
    const { rerender } = show();
    await check(passedAll, rerender);
    await waitFor(() => {
      expect(line()).toBe(words.completeFirst(10));
    });
    expect(document.querySelector("[data-invitation-host]")).toBeNull();
  });

  it("[FR-AUTH-07] does not say progress is saved on the device when it is kept only in memory", async () => {
    progress.invitation = <p>{INVITATION}</p>;
    progress.durability = "memory";
    const { rerender } = show();
    await check(passedAll, rerender);
    await waitFor(() => {
      expect(line()).toBe(words.completeFirst(10));
    });
    expect(invitation()).toBeNull();
  });

  it("drops the invitation with the completion line when a later check fails", async () => {
    progress.invitation = <p>{INVITATION}</p>;
    const { rerender } = show();
    await check(passedAll, rerender);
    await waitFor(() => {
      expect(invitation()).not.toBeNull();
    });
    runtime.view = { ...runtime.view, summary: { ...passedOne }, ended: "check" };
    rerender(<Workspace lesson={lesson} instructions={null} nonce="nonce" />);
    expect(invitation()).toBeNull();
  });

  it("says when the device keeps nothing past this tab", async () => {
    progress.durability = "memory";
    show();
    expect(await screen.findByText(words.memoryTitle)).toBeTruthy();
    expect(screen.getByText(words.memoryBody)).toBeTruthy();
  });

  it("[FR-PRG-06] says while a completed lesson is not saved to the account", async () => {
    show();
    expect(screen.queryByText(words.unsyncedTitle)).toBeNull();
    act(() => sync.set(true));
    expect(await screen.findByText(words.unsyncedTitle)).toBeTruthy();
    act(() => sync.set(false));
    expect(screen.queryByText(words.unsyncedTitle)).toBeNull();
  });

  it("shows no storage notice when the device keeps progress", async () => {
    show();
    await act(async () => {
      await Promise.resolve();
    });
    expect(screen.queryByText(words.memoryTitle)).toBeNull();
  });
});
