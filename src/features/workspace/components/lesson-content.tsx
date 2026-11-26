import type { CellAlign, DocumentBlock, Inline, LessonDocument, Run } from "@/content/markdown";
import { lessonContent as words } from "@/messages/lesson";
import { ExternalLink } from "@/ui";
import { CopyCodeButton } from "./copy-code-button";

// A lesson's instructions as elements (docs/spec/04-content-system.md section
// 5, NFR-SEC-07). The one component for the workspace and for the dashboard's
// live preview, so the preview cannot differ from what learners see. It takes
// the renderer's tree of plain values; every string becomes a text node, so
// React escapes it, and nothing here sets HTML.

const SYNTAX_CLASS: Record<NonNullable<Run["kind"]>, string> = {
  keyword: "syntax-keyword",
  string: "syntax-string",
  number: "syntax-number",
  function: "syntax-function",
  builtin: "syntax-builtin",
  comment: "syntax-comment",
};

const ALIGN_CLASS: Record<CellAlign, string> = {
  start: "text-start",
  center: "text-center",
  end: "text-end",
};

const cellClass = (base: string, align: CellAlign | undefined) =>
  `${base} ${ALIGN_CLASS[align ?? "start"]}`;

function Inlines({ nodes }: { nodes: readonly Inline[] }) {
  return nodes.map((node, index) => {
    switch (node.kind) {
      case "text":
        return node.text;
      case "code":
        return (
          <code key={index} className="rounded-control bg-surface-raised px-1 font-mono text-text">
            {node.text}
          </code>
        );
      case "emphasis":
        return (
          <em key={index}>
            <Inlines nodes={node.children} />
          </em>
        );
      case "strong":
        return (
          <strong key={index} className="font-semibold">
            <Inlines nodes={node.children} />
          </strong>
        );
      case "link":
        return (
          <ExternalLink key={index} href={node.href} newTabLabel={words.opensInNewTab}>
            <Inlines nodes={node.children} />
          </ExternalLink>
        );
      default: {
        const unreachable: never = node;
        return unreachable;
      }
    }
  });
}

function CodeBlock({ block }: { block: Extract<DocumentBlock, { kind: "code_block" }> }) {
  return (
    <div
      role="group"
      aria-label={words.codeBlock(block.python ? "Python" : block.language)}
      className="flex flex-col gap-2 rounded-panel border border-border bg-surface-editor p-3"
    >
      <pre className="code-surface overflow-x-auto" tabIndex={0}>
        <code>
          {block.runs.map((run, index) =>
            run.kind === undefined ? (
              run.text
            ) : (
              <span key={index} className={SYNTAX_CLASS[run.kind]}>
                {run.text}
              </span>
            ),
          )}
        </code>
      </pre>
      <div className="flex justify-end">
        <CopyCodeButton code={block.text} />
      </div>
    </div>
  );
}

type HeadingLevel = 2 | 3 | 4 | 5 | 6;

function Blocks({ blocks, top }: { blocks: readonly DocumentBlock[]; top: 2 | 3 | 4 }) {
  return blocks.map((block, index) => {
    switch (block.kind) {
      case "paragraph":
        return (
          <p key={index}>
            <Inlines nodes={block.children} />
          </p>
        );
      case "heading": {
        // The tag follows the page's outline; the look follows the lesson's.
        const Tag = `h${String(block.level - 2 + top) as `${HeadingLevel}`}` as const;
        return (
          <Tag
            key={index}
            className={
              block.level === 2
                ? "text-lg font-semibold text-text"
                : "text-base font-semibold text-text"
            }
          >
            <Inlines nodes={block.children} />
          </Tag>
        );
      }
      case "code_block":
        return <CodeBlock key={index} block={block} />;
      case "list": {
        const items = block.items.map((item, itemIndex) => (
          <li key={itemIndex} className="flex flex-col gap-2">
            <Blocks blocks={item} top={top} />
          </li>
        ));
        return block.ordered ? (
          <ol key={index} start={block.start} className="flex list-decimal flex-col gap-2 ps-6">
            {items}
          </ol>
        ) : (
          <ul key={index} className="flex list-disc flex-col gap-2 ps-6">
            {items}
          </ul>
        );
      }
      case "quote":
        return (
          <blockquote
            key={index}
            className="flex flex-col gap-3 border-s-(length:--marker-width) border-border-control ps-4 text-text-muted"
          >
            <Blocks blocks={block.children} top={top} />
          </blockquote>
        );
      case "table":
        return (
          <div
            key={index}
            role="region"
            aria-label={words.table}
            className="overflow-x-auto"
            tabIndex={0}
          >
            <table className="border-collapse text-base">
              <thead>
                <tr>
                  {block.head.map((cell, cellIndex) => (
                    <th
                      key={cellIndex}
                      scope="col"
                      className={cellClass(
                        "border-b border-border-control px-3 py-2 font-semibold",
                        block.align[cellIndex],
                      )}
                    >
                      <Inlines nodes={cell} />
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {block.rows.map((row, rowIndex) => (
                  <tr key={rowIndex}>
                    {row.map((cell, cellIndex) => (
                      <td
                        key={cellIndex}
                        className={cellClass(
                          "border-b border-border px-3 py-2",
                          block.align[cellIndex],
                        )}
                      >
                        <Inlines nodes={cell} />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
      default: {
        const unreachable: never = block;
        return unreachable;
      }
    }
  });
}

/**
 * The instructions, in the reading measure of DESIGN.md section 5. A lesson's
 * headings are levels 2 and 3; inside a section of another page, such as the
 * dashboard's preview under its own heading, `topHeadingLevel` moves them down
 * the outline without changing how they look.
 */
export function LessonContent({
  document,
  topHeadingLevel = 2,
}: {
  document: LessonDocument;
  topHeadingLevel?: 2 | 3 | 4;
}) {
  return (
    <div className="flex max-w-prose flex-col gap-4 text-prose text-text">
      <Blocks blocks={document.blocks} top={topHeadingLevel} />
    </div>
  );
}
