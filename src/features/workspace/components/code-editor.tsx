"use client";

import { Compartment, EditorState } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { useEffect, useId, useRef } from "react";
import { codeEditor as words } from "@/messages/lesson";
import { editorAttributes, editorExtensions } from "./code-editor-extensions";

// The code editor (docs/spec/03-experience.md sections 6 and 7.4): the one
// editor for learners and for the dashboard's starter and solution. It owns
// its text while it is open; the page hears every change through `onChange`,
// and a new `value` from the page (a reset, a reload) replaces the text.

/**
 * The nonce of the policy this document was loaded with. A browser checks a
 * style element against that policy, not against the request that rendered
 * the current page: after a move inside the app the server's nonce is a new
 * one the document does not know. Next.js puts the load's nonce on its own
 * scripts; the browser hides the attribute's text but keeps the `nonce`
 * property. The server's nonce is used only when no script carries one.
 */
export function documentNonce(page: Document, fallback: string): string {
  for (const script of page.querySelectorAll<HTMLScriptElement>("script[nonce]")) {
    const nonce = script.nonce || script.getAttribute("nonce");
    if (nonce) return nonce;
  }
  return fallback;
}

export type CodeEditorProps = {
  /** The visible label's ID: the editor is named by it. */
  labelledBy: string;
  value: string;
  onChange: (value: string) => void;
  /** IDs of a hint and an error outside the editor that describe it. */
  describedBy?: string;
  /** Whether the field's text is refused. */
  invalid?: boolean;
  /** This request's nonce, read on the server (`requestNonce`): used only when the document's own is not found. */
  nonce: string;
};

export function CodeEditor({
  labelledBy,
  describedBy,
  invalid = false,
  value,
  onChange,
  nonce,
}: CodeEditorProps) {
  const host = useRef<HTMLDivElement>(null);
  const view = useRef<EditorView | null>(null);
  const changed = useRef(onChange);
  // The latest value from the page: the text a newly built editor opens with.
  const initial = useRef(value);
  const hintId = useId();
  const attributeSlot = useRef(new Compartment());
  const description = describedBy === undefined ? hintId : `${hintId} ${describedBy}`;
  // The attributes a newly built editor opens with.
  const attributes = useRef({ labelledBy, describedBy: description, invalid });

  useEffect(() => {
    changed.current = onChange;
  }, [onChange]);

  useEffect(() => {
    if (host.current === null) return;
    const editor = new EditorView({
      parent: host.current,
      state: EditorState.create({
        doc: initial.current,
        extensions: editorExtensions(
          {
            nonce: documentNonce(document, nonce),
            ...attributes.current,
            onChange: (next) => changed.current(next),
          },
          attributeSlot.current,
        ),
      }),
    });
    view.current = editor;
    return () => {
      editor.destroy();
      view.current = null;
    };
  }, [nonce]);

  useEffect(() => {
    attributes.current = { labelledBy, describedBy: description, invalid };
    view.current?.dispatch({
      effects: attributeSlot.current.reconfigure(editorAttributes(attributes.current)),
    });
  }, [labelledBy, description, invalid]);

  useEffect(() => {
    initial.current = value;
    const editor = view.current;
    if (editor === null) return;
    const current = editor.state.doc.toString();
    if (current !== value) {
      editor.dispatch({ changes: { from: 0, to: current.length, insert: value } });
    }
  }, [value]);

  return (
    <div
      className={`code-surface overflow-hidden rounded-panel border ${invalid ? "border-fail" : "border-border-control"}`}
    >
      <span id={hintId} className="sr-only">
        {words.leaveHint}
      </span>
      <div ref={host} className="min-h-40" />
    </div>
  );
}
