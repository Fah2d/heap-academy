import "server-only";
import { highlightCode, isPython, type Run } from "./highlight";
import { type Alignment, type Block as ParsedBlock, type Inline, parseMarkdown } from "./parse";

// Lesson instructions as learners see them (docs/spec/04-content-system.md
// section 5, docs/spec/02-architecture.md section 7.3, NFR-SEC-07): the
// Markdown parsed through the allowlist and each fenced block highlighted,
// on the server. The result is a tree of plain values, never an HTML string.
// One component turns it into elements, for the workspace and for the
// dashboard's preview alike, so the preview cannot differ from the lesson.

export type { Inline, Run };

/** A column's alignment in the reading direction. */
export type CellAlign = "start" | "center" | "end";

export type DocumentBlock =
  | Exclude<ParsedBlock, { kind: "code_block" | "list" | "quote" | "table" }>
  | { kind: "table"; align: CellAlign[]; head: Inline[][]; rows: Inline[][][] }
  | {
      kind: "code_block";
      language: string | undefined;
      /** Whether the fence names Python, however it spells it. */
      python: boolean;
      text: string;
      runs: Run[];
    }
  | { kind: "list"; ordered: boolean; start: number; items: DocumentBlock[][] }
  | { kind: "quote"; children: DocumentBlock[] };

export type LessonDocument = { blocks: DocumentBlock[] };

/** Markdown says left and right; a lesson reads in its own direction, so these become start and end. */
const LOGICAL: Record<NonNullable<Alignment>, CellAlign> = {
  left: "start",
  center: "center",
  right: "end",
};

function withRuns(block: ParsedBlock): DocumentBlock {
  switch (block.kind) {
    case "table":
      return {
        ...block,
        align: block.align.map((align) => (align === undefined ? "start" : LOGICAL[align])),
      };
    case "code_block":
      return {
        ...block,
        python: isPython(block.language),
        runs: highlightCode(block.text, block.language),
      };
    case "list":
      return { ...block, items: block.items.map((item) => item.map(withRuns)) };
    case "quote":
      return { ...block, children: block.children.map(withRuns) };
    case "paragraph":
    case "heading":
      return block;
    default: {
      const unreachable: never = block;
      return unreachable;
    }
  }
}

export function renderMarkdown(markdown: string): LessonDocument {
  return { blocks: parseMarkdown(markdown).map(withRuns) };
}
