import { defaultKeymap, history, historyKeymap, indentWithTab } from "@codemirror/commands";
import { python } from "@codemirror/lang-python";
import {
  bracketMatching,
  ensureSyntaxTree,
  indentUnit,
  syntaxHighlighting,
} from "@codemirror/language";
import { type EditorState, type Extension, RangeSetBuilder } from "@codemirror/state";
import {
  Decoration,
  type DecorationSet,
  drawSelection,
  EditorView,
  highlightActiveLineGutter,
  keymap,
  lineNumbers,
  ViewPlugin,
  type ViewUpdate,
} from "@codemirror/view";
import { tagHighlighter } from "@lezer/highlight";
import { BUILTINS, PYTHON_TAG_RULES } from "@/content/markdown/python-style";

// What the code editor is made of (docs/spec/03-experience.md section 7.4,
// DESIGN.md section 4.4). Kept apart from the component so a test can build
// the editor's state without a browser.

/** The editor's palette: the same rules as a lesson's code blocks, by class. */
const highlighter = tagHighlighter(
  PYTHON_TAG_RULES.map(({ tag, kind }) => ({ tag, class: `syntax-${kind}` })),
);

const builtin = Decoration.mark({ class: "syntax-builtin" });

/**
 * Where a built-in is called, such as `print(...)`: the code blocks show
 * those in the built-in color, and so does the editor. A name the learner
 * defined, or a built-in's name used as a plain value, is left alone.
 */
export function builtinCalls(state: EditorState, from = 0, to = state.doc.length) {
  const ranges: { from: number; to: number }[] = [];
  const tree = ensureSyntaxTree(state, to, 50);
  if (tree === null) return ranges;
  tree.iterate({
    from,
    to,
    enter: (node) => {
      if (node.name !== "VariableName") return;
      const parent = node.node.parent;
      if (parent?.name !== "CallExpression" || parent.firstChild?.from !== node.from) return;
      if (BUILTINS.has(state.sliceDoc(node.from, node.to))) {
        ranges.push({ from: node.from, to: node.to });
      }
    },
  });
  return ranges;
}

function decorate(view: EditorView): DecorationSet {
  const builder = new RangeSetBuilder<Decoration>();
  for (const { from, to } of view.visibleRanges) {
    for (const range of builtinCalls(view.state, from, to)) {
      builder.add(range.from, range.to, builtin);
    }
  }
  return builder.finish();
}

const builtins = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet;
    constructor(view: EditorView) {
      this.decorations = decorate(view);
    }
    update(update: ViewUpdate) {
      if (update.docChanged || update.viewportChanged) this.decorations = decorate(update.view);
    }
  },
  { decorations: (plugin) => plugin.decorations },
);

export type EditorOptions = {
  /** This request's script and style nonce: the editor's style sheets need it (ADR-0028). */
  nonce: string;
  /** The ID of the element that names the editor. */
  labelledBy: string;
  /** The ID of the element that says how to leave the editor by keyboard. */
  describedBy: string;
  onChange: (value: string) => void;
};

export function editorExtensions({
  nonce,
  labelledBy,
  describedBy,
  onChange,
}: EditorOptions): Extension[] {
  return [
    EditorView.cspNonce.of(nonce),
    EditorView.contentAttributes.of({
      "aria-labelledby": labelledBy,
      "aria-describedby": describedBy,
      "aria-multiline": "true",
    }),
    lineNumbers(),
    highlightActiveLineGutter(),
    drawSelection(),
    history(),
    bracketMatching(),
    indentUnit.of("    "),
    python(),
    syntaxHighlighting(highlighter),
    builtins,
    // Tab indents. Escape, then Tab, leaves the editor: CodeMirror turns on
    // its tab focus mode after Escape (section 6.8, "Esc then Tab").
    keymap.of([...defaultKeymap, ...historyKeymap, indentWithTab]),
    EditorView.updateListener.of((update) => {
      if (update.docChanged) onChange(update.state.doc.toString());
    }),
  ];
}
