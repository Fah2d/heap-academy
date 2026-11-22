import { highlightTree, tagHighlighter } from "@lezer/highlight";
import { parser } from "@lezer/python";
import { BUILTINS, PYTHON_TAG_RULES, type TokenKind } from "./python-style";

// Python highlighting for fenced code blocks (docs/spec/04-content-system.md
// section 5, DESIGN.md section 4.4). The code is cut into runs of plain text,
// each with at most one kind from the design's palette. Nothing here makes
// markup: the renderer turns each run into a text node in a span.

export type { TokenKind };

export type Run = { text: string; kind?: TokenKind };

/** The languages a fenced block may name to be highlighted as Python. */
const PYTHON = new Set(["python", "py", "python3"]);

export function isPython(language: string | undefined): boolean {
  return language !== undefined && PYTHON.has(language.toLowerCase());
}

const highlighter = tagHighlighter(PYTHON_TAG_RULES.map(({ tag, kind }) => ({ tag, class: kind })));

/** The longest block that is highlighted; a longer one stays plain text. */
export const MAX_HIGHLIGHT = 10_000;

/**
 * The code as runs of text, highlighted when the block is Python. The runs
 * joined give back the code exactly.
 */
export function highlightCode(code: string, language: string | undefined): Run[] {
  if (!isPython(language) || code.length > MAX_HIGHLIGHT) return [{ text: code }];
  const runs: Run[] = [];
  let at = 0;
  const plain = (to: number) => {
    if (to > at) runs.push({ text: code.slice(at, to) });
  };
  highlightTree(parser.parse(code), highlighter, (from, to, classes) => {
    plain(from);
    const text = code.slice(from, to);
    const kind = (classes.split(" ")[0] ?? "") as TokenKind | "";
    // A call of a built-in is a built-in, not one of the learner's functions.
    const shown: TokenKind | undefined =
      kind === "function" && BUILTINS.has(text) ? "builtin" : kind === "" ? undefined : kind;
    runs.push(shown === undefined ? { text } : { text, kind: shown });
    at = to;
  });
  plain(code.length);
  return runs;
}
