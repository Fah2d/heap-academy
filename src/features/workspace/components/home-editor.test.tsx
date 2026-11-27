// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { homeEditor as homeWords } from "@/messages/catalog";
import { workspace as words } from "@/messages/workspace";
import type { RunId } from "@/runtime/protocol";
import type { WorkspaceEvent, WorkspaceState } from "@/runtime/workspace-chart";
import { INITIAL_VIEW, type RuntimeView } from "../client/runtime-view";
import { runAnnouncement } from "../client/workspace-view";

// The home page's live editor (FR-LND-01), with the runtime and the editor
// replaced: the program is on screen before the editor's code arrives,
// Python is not started until the visitor runs or edits, and a Run pressed
// before then is kept until Python is starting. e2e/home-editor-journey.spec.ts
// runs the real program in the real worker.

const runtime = vi.hoisted(() => ({
  view: undefined as unknown as RuntimeView,
  chart: undefined as unknown as WorkspaceState,
  dispatch: vi.fn<(event: WorkspaceEvent) => void>(),
  /** Every `enabled` the hook was called with, in order. */
  enabled: [] as boolean[],
  source: undefined as string | undefined,
  supported: true,
}));

vi.mock("../client/use-runtime", () => ({
  useRuntime: (
    program: (interactive: boolean) => { source: string },
    options: { enabled: boolean },
  ) => {
    runtime.enabled.push(options.enabled);
    runtime.source = program(false).source;
    return {
      view: runtime.view,
      chart: runtime.chart,
      dispatch: runtime.dispatch,
      sendInput: () => ({ ok: true }),
      endInput: () => undefined,
      lastCheckedSource: () => undefined,
    };
  },
}));
vi.mock("../client/browser-support", () => ({ supportsPython: () => runtime.supported }));
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
      data-editor
      aria-labelledby={labelledBy}
      value={value}
      onChange={(event) => {
        onChange(event.target.value);
      }}
    />
  ),
}));

const { HomeEditor } = await import("./home-editor");

const idle: WorkspaceState = { runtime: { name: "idle" }, lesson: "untouched" };
const loading: WorkspaceState = {
  runtime: { name: "loading", pending: null },
  lesson: "untouched",
};

beforeEach(() => {
  runtime.view = INITIAL_VIEW;
  runtime.chart = idle;
  runtime.dispatch.mockClear();
  runtime.enabled = [];
  runtime.source = undefined;
  runtime.supported = true;
});

afterEach(cleanup);

const runButton = () => screen.getByRole("button", { name: new RegExp(`^${words.run}`) });

describe("the home page's live editor", () => {
  it("[FR-LND-01] shows the program in the editor's box at once, and the real editor once the page has loaded", async () => {
    render(<HomeEditor nonce="nonce" />);
    expect(screen.getByRole("heading", { level: 2, name: homeWords.heading })).toBeTruthy();
    // jsdom's document has finished loading, so the editor is asked for at once.
    const editor = await screen.findByRole("textbox", { name: homeWords.heading });
    expect((editor as HTMLTextAreaElement).value).toBe(homeWords.program);
    expect(runtime.source).toBe(homeWords.program);
  });

  it("[FR-LND-01] [NFR-PERF-01] does not start Python when the page opens", () => {
    render(<HomeEditor nonce="nonce" />);
    expect(runtime.enabled.every((enabled) => !enabled)).toBe(true);
    expect(runtime.dispatch).not.toHaveBeenCalled();
    expect(screen.queryByText(words.starting)).toBeNull();
  });

  it("[FR-LND-01] [FR-WSP-17] Run starts Python and runs once it is starting", async () => {
    const { rerender } = render(<HomeEditor nonce="nonce" />);
    await userEvent.click(runButton());
    expect(runtime.enabled.at(-1)).toBe(true);
    expect(runButton().textContent).toContain(words.runPending);
    expect(runtime.dispatch).not.toHaveBeenCalledWith({ type: "RUN" });

    // useRuntime has made the controller and sent LESSON_OPENED.
    runtime.chart = loading;
    rerender(<HomeEditor nonce="nonce" />);
    expect(runtime.dispatch).toHaveBeenCalledWith({ type: "RUN" });
    expect(runtime.dispatch.mock.calls.filter(([event]) => event.type === "RUN")).toHaveLength(1);
  });

  it("[FR-LND-01] an edit starts Python and runs the edited program", async () => {
    render(<HomeEditor nonce="nonce" />);
    const editor = await screen.findByRole("textbox", { name: homeWords.heading });
    fireEvent.change(editor, { target: { value: 'print("mine")\n' } });
    expect(runtime.enabled.at(-1)).toBe(true);
    expect(runtime.dispatch).toHaveBeenCalledWith({ type: "CODE_EDITED" });
    expect(runtime.source).toBe('print("mine")\n');
  });

  it("[FR-LND-01] runs at once when Python is ready", async () => {
    runtime.chart = { runtime: { name: "ready" }, lesson: "untouched" };
    render(<HomeEditor nonce="nonce" />);
    await userEvent.click(runButton());
    expect(runtime.dispatch).toHaveBeenCalledWith({ type: "RUN" });
  });

  it("[FR-LND-01] [NFR-A11Y-04] says once how the run ended", () => {
    runtime.chart = { runtime: { name: "ready" }, lesson: "untouched" };
    runtime.view = {
      ...INITIAL_VIEW,
      status: "ready",
      output: [{ stream: "stdout", text: "Hello, Sara!\n" }],
      result: { runId: "run-1" as RunId, outcome: { kind: "ok" }, truncated: false, durationMs: 3 },
      ended: "run",
    } as RuntimeView;
    render(<HomeEditor nonce="nonce" />);
    const said = runAnnouncement(runtime.view.result!, 1);
    expect(screen.getAllByRole("status").map((region) => region.textContent)).toContain(said);
    expect(screen.getByText("Hello, Sara!")).toBeTruthy();
  });

  it("[FR-LND-01] [FR-SYS-02] says the browser cannot run Python, with no Run that does nothing", async () => {
    runtime.supported = false;
    // The support check runs once per page load, so this test loads the module afresh.
    vi.resetModules();
    const { HomeEditor: FreshEditor } = await import("./home-editor");
    render(<FreshEditor nonce="nonce" />);
    expect(screen.getByText(words.unsupportedTitle)).toBeTruthy();
    expect(screen.queryByRole("button", { name: new RegExp(`^${words.run}`) })).toBeNull();
  });

  it("[FR-LND-01] keeps the box one height before and after the editor loads (NFR-PERF-01)", async () => {
    const { container } = render(<HomeEditor nonce="nonce" />);
    await act(async () => {
      await screen.findByRole("textbox", { name: homeWords.heading });
    });
    const box = container.querySelector("[data-home-editor] > div:nth-child(2)");
    expect(box?.className).toContain("h-(--home-editor-size)");
  });
});

describe("the home page's live editor when the editor's code cannot be fetched", () => {
  it("[FR-LND-01] keeps the program and Run, says the editor did not load, and leaves the page", async () => {
    vi.resetModules();
    vi.doMock("./code-editor", () => {
      throw new Error("chunk failed");
    });
    const { HomeEditor: FreshEditor } = await import("./home-editor");
    // React reports the caught error on the console; the test reads the page.
    const quiet = vi.spyOn(console, "error").mockImplementation(() => undefined);
    render(<FreshEditor nonce="nonce" />);
    expect(await screen.findByText(homeWords.editorFailed)).toBeTruthy();
    expect(
      screen.getByText(
        (_, element) => element?.tagName === "PRE" && element.textContent === homeWords.program,
      ),
    ).toBeTruthy();
    expect(runButton()).toBeTruthy();
    await userEvent.click(runButton());
    expect(runtime.enabled.at(-1)).toBe(true);
    quiet.mockRestore();
    vi.doUnmock("./code-editor");
  });
});
