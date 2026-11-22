// @vitest-environment jsdom
import { EditorState } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { indentUnit } from "@codemirror/language";
import { describe, expect, it, vi } from "vitest";
import { builtinCalls, editorExtensions } from "./code-editor-extensions";

// The editor's state without a browser. Its styles under the page policy
// and its keyboard behavior are checked in a browser (e2e/lesson-editor.spec.ts).

const state = (doc: string, onChange = vi.fn()) =>
  EditorState.create({
    doc,
    extensions: editorExtensions({
      nonce: "bm9uY2U=",
      labelledBy: "label",
      describedBy: "hint",
      onChange,
    }),
  });

describe("the code editor's extensions", () => {
  it("[NFR-SEC-02] gives the editor's style sheets this request's nonce", () => {
    expect(state("").facet(EditorView.cspNonce)).toBe("bm9uY2U=");
  });

  it("indents Python by four spaces", () => {
    expect(state("").facet(indentUnit)).toBe("    ");
  });

  it("names the editor by its label and describes how to leave it [NFR-A11Y-03]", () => {
    const attributes = state("").facet(EditorView.contentAttributes);
    expect(attributes).toContainEqual({
      "aria-labelledby": "label",
      "aria-describedby": "hint",
      "aria-multiline": "true",
    });
  });

  it("reports each change of the text", () => {
    const onChange = vi.fn();
    const view = new EditorView({ state: state("a", onChange) });
    view.dispatch({ changes: { from: 1, insert: "b" } });
    expect(onChange).toHaveBeenCalledWith("ab");
    view.destroy();
  });

  it("marks calls of built-ins only, as a lesson's code blocks do", () => {
    const doc = "print(len(x))\ndef show(print):\n    return print\nsum = 1\nmy(1)\nobj.print(2)";
    const text = builtinCalls(state(doc)).map(({ from, to }) => doc.slice(from, to));
    expect(text).toEqual(["print", "len"]);
  });
});
