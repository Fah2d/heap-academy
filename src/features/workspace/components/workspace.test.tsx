// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
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
    };
  },
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
