"use client";

import { EditorState } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { useEffect, useId, useRef } from "react";
import { codeEditor as words } from "@/messages/lesson";
import { editorExtensions } from "./code-editor-extensions";

// The code editor (docs/spec/03-experience.md sections 6 and 7.4): the one
// editor for learners and for the dashboard's starter and solution. It owns
// its text while it is open; the page hears every change through `onChange`,
// and a new `value` from the page (a reset, a reload) replaces the text.

export type CodeEditorProps = {
  /** The visible label's ID: the editor is named by it. */
  labelledBy: string;
  value: string;
  onChange: (value: string) => void;
  /** This request's nonce, read on the server (`requestNonce`). */
  nonce: string;
};

export function CodeEditor({ labelledBy, value, onChange, nonce }: CodeEditorProps) {
  const host = useRef<HTMLDivElement>(null);
  const view = useRef<EditorView | null>(null);
  const changed = useRef(onChange);
  // The latest value from the page: the text a newly built editor opens with.
  const initial = useRef(value);
  const hintId = useId();

  useEffect(() => {
    changed.current = onChange;
  }, [onChange]);

  useEffect(() => {
    if (host.current === null) return;
    const editor = new EditorView({
      parent: host.current,
      state: EditorState.create({
        doc: initial.current,
        extensions: editorExtensions({
          nonce,
          labelledBy,
          describedBy: hintId,
          onChange: (next) => changed.current(next),
        }),
      }),
    });
    view.current = editor;
    return () => {
      editor.destroy();
      view.current = null;
    };
  }, [nonce, labelledBy, hintId]);

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
    <div className="code-surface overflow-hidden rounded-panel border border-border-control">
      <span id={hintId} className="sr-only">
        {words.leaveHint}
      </span>
      <div ref={host} className="min-h-40" />
    </div>
  );
}
