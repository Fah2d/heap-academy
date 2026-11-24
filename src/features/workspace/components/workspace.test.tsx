// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { EXAMPLE_LESSON } from "@/grader/example-lesson";
import { workspace as words } from "@/messages/workspace";
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
  const tab = (name: string) => screen.getByRole("tab", { name });
  const panelOf = (name: string) => {
    const id = tab(name).getAttribute("aria-controls") ?? "";
    const panel = document.getElementById(id);
    if (panel === null) throw new Error(`no panel for ${name}`);
    return panel;
  };

  it("shows one of three views, the Lesson first, with the others hidden", () => {
    narrow = true;
    show();
    const views = within(screen.getByRole("tablist", { name: words.views }));
    expect(views.getAllByRole("tab").map((element) => element.textContent)).toEqual([
      words.viewLesson + words.viewLesson,
      words.viewCode + words.viewCode,
      words.viewOutput + words.viewOutput,
    ]);
    expect(tab(words.viewLesson).getAttribute("aria-selected")).toBe("true");
    expect(panelOf(words.viewLesson).hidden).toBe(false);
    expect(panelOf(words.viewCode).hidden).toBe(true);
    expect(panelOf(words.viewOutput).hidden).toBe(true);
    expect(panelOf(words.viewCode).getAttribute("role")).toBe("tabpanel");
    expect(panelOf(words.viewCode).getAttribute("aria-labelledby")).toBe(tab(words.viewCode).id);
  });

  it("ends the Lesson view with one action that shows the Code view and focuses its tab", async () => {
    narrow = true;
    show();
    await userEvent.click(screen.getByRole("button", { name: words.toCode }));
    expect(panelOf(words.viewCode).hidden).toBe(false);
    expect(panelOf(words.viewLesson).hidden).toBe(true);
    expect(document.activeElement).toBe(tab(words.viewCode));
  });

  it("moves between views with the arrows, and keeps one tab in the tab order", () => {
    narrow = true;
    show();
    fireEvent.keyDown(tab(words.viewLesson), { key: "ArrowRight" });
    expect(tab(words.viewCode).getAttribute("aria-selected")).toBe("true");
    expect(document.activeElement).toBe(tab(words.viewCode));
    fireEvent.keyDown(tab(words.viewCode), { key: "End" });
    expect(panelOf(words.viewOutput).hidden).toBe(false);
    const views = within(screen.getByRole("tablist", { name: words.views }));
    expect(views.getAllByRole("tab").map((element) => element.getAttribute("tabindex"))).toEqual([
      "-1",
      "-1",
      "0",
    ]);
  });

  it("Run shows the Output view with the console, Check the Output view with the tests", async () => {
    narrow = true;
    show();
    await userEvent.click(button(words.run));
    expect(panelOf(words.viewOutput).hidden).toBe(false);
    expect(screen.getByRole("tab", { name: words.console }).getAttribute("aria-selected")).toBe(
      "true",
    );
    await userEvent.click(tab(words.viewLesson));
    await userEvent.click(button(words.check));
    expect(panelOf(words.viewOutput).hidden).toBe(false);
    expect(screen.getByRole("tab", { name: words.tests }).getAttribute("aria-selected")).toBe(
      "true",
    );
    expect(runtime.dispatch.mock.calls.map(([event]) => event.type)).toEqual(["RUN", "CHECK"]);
  });

  it("keeps Run, Check and Stop in the bar in every view, without the keyboard's keys", async () => {
    narrow = true;
    show();
    for (const view of [words.viewLesson, words.viewCode, words.viewOutput]) {
      await userEvent.click(tab(view));
      expect(button(words.run)).toBeTruthy();
      expect(button(words.check)).toBeTruthy();
      expect(screen.getByRole("button", { name: words.stop })).toBeTruthy();
    }
    expect(within(button(words.run)).queryByText(words.shortcut(false, false))).toBeNull();
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
    expect(region?.closest("[hidden]")).toBeNull();
  });

  it("is not built at 768 px and wider", () => {
    show();
    expect(screen.queryByRole("tablist", { name: words.views })).toBeNull();
    expect(screen.queryByRole("button", { name: words.toCode })).toBeNull();
  });
});
