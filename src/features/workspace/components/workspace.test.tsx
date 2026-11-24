// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { EXAMPLE_LESSON } from "@/grader/example-lesson";
import { workspace as words } from "@/messages/workspace";
import type { RunId } from "@/runtime/protocol";
import { SOURCE_LIMIT } from "@/runtime/protocol";
import type { WorkspaceEvent, WorkspaceState } from "@/runtime/workspace-chart";
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

beforeEach(() => {
  runtime.view = { ...INITIAL_VIEW, status: "ready" };
  runtime.chart = { runtime: { name: "ready" }, lesson: "untouched" };
  runtime.dispatch.mockReset();
});

afterEach(() => {
  cleanup();
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
