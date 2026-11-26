import { defaultKeymap, history, historyKeymap, indentWithTab } from "@codemirror/commands";
import { python } from "@codemirror/lang-python";
import {
  bracketMatching,
  ensureSyntaxTree,
  indentUnit,
  syntaxHighlighting,
} from "@codemirror/language";
import { Compartment, type EditorState, type Extension, RangeSetBuilder } from "@codemirror/state";
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

const SELECTION =
  "&.cm-focused > .cm-scroller > .cm-selectionLayer .cm-selectionBackground, .cm-selectionBackground, .cm-content ::selection";

/**
 * The editor's chrome from the design tokens (DESIGN.md section 4.4). It is
 * a CodeMirror theme, not rules in `src/ui/code.css`: CodeMirror's base theme
 * is injected outside any cascade layer, so it beats every rule inside
 * `@layer components`, however specific. A theme is scoped to the editor and
 * outranks the base theme. Marked dark, so the base theme's light caret,
 * selection and gutter never apply.
 */
export const EDITOR_THEME = {
  "&": {
    backgroundColor: "var(--color-surface-editor)",
    color: "var(--syntax-text)",
  },
  "&.cm-focused": {
    outline: "var(--focus-ring-width) solid var(--color-focus)",
    outlineOffset: "calc(var(--focus-ring-width) * -1)",
  },
  ".cm-scroller": {
    fontFamily: "var(--font-mono)",
    fontSize: "var(--text-code)",
    lineHeight: "var(--text-code--line-height)",
  },
  ".cm-content": {
    caretColor: "var(--editor-caret)",
    paddingBlock: "var(--space-3)",
  },
  ".cm-cursor, .cm-dropCursor": {
    borderInlineStartWidth: "var(--marker-width)",
    borderInlineStartStyle: "solid",
    borderInlineStartColor: "var(--editor-caret)",
  },
  [SELECTION]: {
    backgroundColor: "var(--editor-selection)",
  },
  ".cm-gutters": {
    backgroundColor: "var(--color-surface-editor)",
    color: "var(--editor-gutter-text)",
    border: "none",
    borderInlineEnd: "var(--hairline) solid var(--color-border)",
  },
  // The caret's line is marked in the gutter only, never with a background
  // over the selection.
  ".cm-activeLineGutter": {
    backgroundColor: "transparent",
    color: "var(--editor-gutter-active)",
  },
  ".cm-matchingBracket, &.cm-focused .cm-matchingBracket": {
    backgroundColor: "transparent",
    outline: "var(--hairline) solid var(--editor-bracket-match)",
  },
  ".cm-searchMatch": {
    backgroundColor: "var(--editor-search-match)",
    outline: "var(--hairline) solid var(--editor-search-outline)",
  },
} as const;

const theme = EditorView.theme(EDITOR_THEME, { dark: true });

export type EditorOptions = {
  /** This request's script and style nonce: the editor's style sheets need it (ADR-0028). */
  nonce: string;
  /** The ID of the element that names the editor. */
  labelledBy: string;
  /** The IDs of the elements that describe the editor: how to leave it, a hint, an error. */
  describedBy: string;
  /** Whether the text is refused; the error's ID is then in `describedBy`. */
  invalid?: boolean;
  onChange: (value: string) => void;
};

/** The editor's name, description and invalid state, for its text area. */
export function editorAttributes({
  labelledBy,
  describedBy,
  invalid = false,
}: Pick<EditorOptions, "labelledBy" | "describedBy" | "invalid">): Extension {
  return EditorView.contentAttributes.of({
    // The text area is in the tab order already, as an editable element. Said
    // outright, so a checker that does not count editable elements sees that
    // the scrolling box around a long program can be reached by keyboard
    // (axe `scrollable-region-focusable`, WP-5.2).
    tabindex: "0",
    "aria-labelledby": labelledBy,
    "aria-describedby": describedBy,
    "aria-multiline": "true",
    ...(invalid ? { "aria-invalid": "true" } : {}),
  });
}

export function editorExtensions(
  { nonce, onChange, ...attributes }: EditorOptions,
  /** Holds the attributes, so they can change without building a new editor. */
  attributeSlot: Compartment = new Compartment(),
): Extension[] {
  return [
    EditorView.cspNonce.of(nonce),
    attributeSlot.of(editorAttributes(attributes)),
    theme,
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
    // its tab focus mode after Escape (03-experience.md section 6.2, "Esc then Tab").
    keymap.of([...defaultKeymap, ...historyKeymap, indentWithTab]),
    // Below 768 px the workspace's action bar is fixed over the end of the
    // screen (--action-bar-size, 0 elsewhere), so the cursor is scrolled to
    // stay above it while typing.
    EditorView.scrollMargins.of((view) => ({
      bottom:
        Number.parseFloat(getComputedStyle(view.dom).getPropertyValue("--action-bar-size")) || 0,
    })),
    EditorView.updateListener.of((update) => {
      if (update.docChanged) onChange(update.state.doc.toString());
    }),
  ];
}
