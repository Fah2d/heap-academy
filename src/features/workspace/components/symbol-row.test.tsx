// @vitest-environment jsdom
import { EditorSelection } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { act, cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { symbolRow as words } from "@/messages/workspace";
import { CodeEditor } from "./code-editor";
import { SymbolRow } from "./symbol-row";

// FR-WSP-21: the phone's symbol row offers the symbols of section 6.8 in
// order, and each key inserts at the editor's cursor. The workspace shows the
// row in the Code view below 768 px only (workspace.test.tsx).

afterEach(cleanup);

describe("[FR-WSP-21] the symbol row", () => {
  it("offers Tab and the slow symbols, in the order section 6.8 lists them", () => {
    render(<SymbolRow onInsert={vi.fn()} />);
    const keys = within(screen.getByRole("group", { name: words.label })).getAllByRole("button");
    expect(keys.map((key) => key.textContent)).toEqual([
      "Tab",
      ":",
      "(",
      ")",
      "[",
      "]",
      '"',
      "'",
      "=",
      "#",
      "_",
    ]);
    // Each key is named; the Tab key's name holds the word on its face.
    expect(keys.map((key) => key.getAttribute("aria-label"))).toEqual(
      words.keys.map((key) => key.name),
    );
    expect(keys[0]?.getAttribute("aria-label")).toBe("Tab");
  });

  it("says which symbol was pressed", async () => {
    const onInsert = vi.fn();
    render(<SymbolRow onInsert={onInsert} />);
    await userEvent.click(screen.getByRole("button", { name: "Colon" }));
    await userEvent.click(screen.getByRole("button", { name: "Tab" }));
    expect(onInsert.mock.calls).toEqual([[":"], ["indent"]]);
  });
});

describe("[FR-WSP-21] the editor inserts a symbol at the cursor", () => {
  const view = () => {
    const content = document.querySelector(".cm-editor");
    const found = content instanceof HTMLElement ? EditorView.findFromDOM(content) : null;
    if (found === null) throw new Error("no editor");
    return found;
  };
  const show = (insert?: { text: string | { indent: true }; request: number }) => (
    <CodeEditor
      labelledBy="label"
      value={"print\nx = 1"}
      onChange={vi.fn()}
      nonce=""
      insert={insert}
    />
  );

  it("puts the symbol at the cursor, in place of a selection, and focuses the editor", () => {
    const { rerender } = render(show());
    act(() => {
      view().dispatch({ selection: EditorSelection.cursor(5) });
    });
    rerender(show({ text: "(", request: 1 }));
    expect(view().state.doc.toString()).toBe("print(\nx = 1");
    expect(view().state.selection.main.head).toBe(6);
    expect(view().hasFocus).toBe(true);

    act(() => {
      view().dispatch({ selection: EditorSelection.range(11, 12) });
    });
    rerender(show({ text: "_", request: 2 }));
    expect(view().state.doc.toString()).toBe("print(\nx = _");
  });

  it("inserts one indent unit, four spaces, for Tab", () => {
    const { rerender } = render(show());
    act(() => {
      view().dispatch({ selection: EditorSelection.cursor(6) });
    });
    rerender(show({ text: { indent: true }, request: 1 }));
    expect(view().state.doc.toString()).toBe("print\n    x = 1");
  });

  it("inserts again for the same symbol with a new request", () => {
    const { rerender } = render(show());
    rerender(show({ text: ":", request: 1 }));
    rerender(show({ text: ":", request: 2 }));
    expect(view().state.doc.toString().startsWith("::")).toBe(true);
  });
});

describe("[FR-WSP-21] a rebuilt editor", () => {
  it("does not insert the last symbol again when the editor is built anew, as at 768 px", () => {
    const props = {
      labelledBy: "label",
      value: "print",
      onChange: vi.fn(),
      nonce: "",
      insert: { text: { indent: true as const }, request: 3 },
    };
    const first = render(<CodeEditor {...props} />);
    first.unmount();
    render(<CodeEditor {...props} />);
    const content = document.querySelector(".cm-editor");
    const view = content instanceof HTMLElement ? EditorView.findFromDOM(content) : null;
    expect(view?.state.doc.toString()).toBe("print");
    expect(props.onChange).not.toHaveBeenCalled();
  });
});
