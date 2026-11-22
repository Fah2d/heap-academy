import { describe, expect, it } from "vitest";
import { MALICIOUS } from "./malicious-fixtures";
import { forAll, textFrom } from "../../../scripts/testing/property";
import {
  allowedHref,
  type Block,
  type Inline,
  MARKDOWN_LIMIT,
  MAX_DEPTH,
  MAX_TABLE_COLUMNS,
  parseMarkdown,
} from "./parse";

// The allowlist (docs/spec/04-content-system.md section 5) and the malicious
// fixtures of T-06. Every node in the tree is one of the allowed kinds by
// type; these tests check what the parser keeps, what it drops, and that no
// payload survives as anything but inert text.

const BLOCK_KINDS = new Set(["paragraph", "heading", "code_block", "list", "quote", "table"]);
const INLINE_KINDS = new Set(["text", "code", "emphasis", "strong", "link"]);

/** Every inline node in the tree, with every link's address. */
function walk(tree: Block[]): { inlines: Inline[]; blocks: Block[] } {
  const inlines: Inline[] = [];
  const blocks: Block[] = [];
  const visitInline = (node: Inline) => {
    inlines.push(node);
    if (node.kind === "emphasis" || node.kind === "strong" || node.kind === "link") {
      node.children.forEach(visitInline);
    }
  };
  const visitBlock = (block: Block) => {
    blocks.push(block);
    switch (block.kind) {
      case "paragraph":
      case "heading":
        block.children.forEach(visitInline);
        return;
      case "code_block":
        return;
      case "list":
        block.items.forEach((item) => item.forEach(visitBlock));
        return;
      case "quote":
        block.children.forEach(visitBlock);
        return;
      case "table":
        block.head.forEach((cell) => cell.forEach(visitInline));
        block.rows.forEach((row) => row.forEach((cell) => cell.forEach(visitInline)));
        return;
      default: {
        const unreachable: never = block;
        return unreachable;
      }
    }
  };
  tree.forEach(visitBlock);
  return { inlines, blocks };
}

/** All the text a reader would see outside code, joined. */
function visibleText(tree: Block[]): string {
  return walk(tree)
    .inlines.filter((node): node is Extract<Inline, { kind: "text" }> => node.kind === "text")
    .map((node) => node.text)
    .join("");
}

function links(tree: Block[]): string[] {
  return walk(tree).inlines.flatMap((node) => (node.kind === "link" ? [node.href] : []));
}

const text = (value: string): Inline => ({ kind: "text", text: value });

/** A link the parser kept holds an address already in its checked, normal form. */
const isKept = (href: string): boolean => allowedHref(href) === href;

describe("the Markdown allowlist", () => {
  it("[NFR-SEC-07] keeps paragraphs, emphasis, strong emphasis, inline code and https links", () => {
    expect(
      parseMarkdown(
        "Use *care*, **always**, `print()` and [the docs](https://docs.python.org/3/).",
      ),
    ).toEqual([
      {
        kind: "paragraph",
        children: [
          text("Use "),
          { kind: "emphasis", children: [text("care")] },
          text(", "),
          { kind: "strong", children: [text("always")] },
          text(", "),
          { kind: "code", text: "print()" },
          text(" and "),
          { kind: "link", href: "https://docs.python.org/3/", children: [text("the docs")] },
          text("."),
        ],
      },
    ]);
  });

  it("[NFR-SEC-07] keeps headings of level two and three; other levels become paragraphs", () => {
    expect(parseMarkdown("## Two\n\n### Three\n\n# One\n\n#### Four")).toEqual([
      { kind: "heading", level: 2, children: [text("Two")] },
      { kind: "heading", level: 3, children: [text("Three")] },
      { kind: "paragraph", children: [text("One")] },
      { kind: "paragraph", children: [text("Four")] },
    ]);
  });

  it("[NFR-SEC-07] a heading drops a closing run of # only after a space", () => {
    expect(parseMarkdown("## Python and C#\n\n### Title ###")).toEqual([
      { kind: "heading", level: 2, children: [text("Python and C#")] },
      { kind: "heading", level: 3, children: [text("Title")] },
    ]);
  });

  it("[NFR-SEC-07] keeps fenced code blocks, with or without a language, exactly as written", () => {
    expect(parseMarkdown("```python\nif x < 1:\n    print('<b>')\n```\n\n~~~\nplain\n~~~")).toEqual(
      [
        { kind: "code_block", language: "python", text: "if x < 1:\n    print('<b>')" },
        { kind: "code_block", language: undefined, text: "plain" },
      ],
    );
  });

  it("[NFR-SEC-07] a fence with an info string takes its first word as the language", () => {
    expect(parseMarkdown('```python title="x"\nprint(1)\n```\n\nAfter')).toEqual([
      { kind: "code_block", language: "python", text: "print(1)" },
      { kind: "paragraph", children: [text("After")] },
    ]);
    expect(parseMarkdown("```<script>\nx\n```")).toEqual([
      { kind: "code_block", language: undefined, text: "x" },
    ]);
    expect(parseMarkdown("``` a`b\nx")).toEqual([
      { kind: "paragraph", children: [text("``` a`b\nx")] },
    ]);
  });

  it("[NFR-SEC-07] an unclosed fence runs to the end", () => {
    expect(parseMarkdown("```\nopen")).toEqual([
      { kind: "code_block", language: undefined, text: "open" },
    ]);
  });

  it("[NFR-SEC-07] keeps lists, ordered with their start, and lists inside items", () => {
    expect(parseMarkdown("- one\n- two\n  - inner\n\n3. three\n4. four")).toEqual([
      {
        kind: "list",
        ordered: false,
        start: 1,
        items: [
          [{ kind: "paragraph", children: [text("one")] }],
          [
            { kind: "paragraph", children: [text("two")] },
            {
              kind: "list",
              ordered: false,
              start: 1,
              items: [[{ kind: "paragraph", children: [text("inner")] }]],
            },
          ],
        ],
      },
      {
        kind: "list",
        ordered: true,
        start: 3,
        items: [
          [{ kind: "paragraph", children: [text("three")] }],
          [{ kind: "paragraph", children: [text("four")] }],
        ],
      },
    ]);
  });

  it("[NFR-SEC-07] keeps block quotes, with blocks inside", () => {
    expect(parseMarkdown("> Note\n>\n> - a")).toEqual([
      {
        kind: "quote",
        children: [
          { kind: "paragraph", children: [text("Note")] },
          {
            kind: "list",
            ordered: false,
            start: 1,
            items: [[{ kind: "paragraph", children: [text("a")] }]],
          },
        ],
      },
    ]);
  });

  it("[NFR-SEC-07] keeps tables with their alignment, an escaped pipe, and a short row", () => {
    expect(parseMarkdown("| Name | Value |\n|:-----|------:|\n| `a\\|b` | **1** |\n| c |")).toEqual(
      [
        {
          kind: "table",
          align: ["left", "right"],
          head: [[text("Name")], [text("Value")]],
          rows: [
            [[{ kind: "code", text: "a|b" }], [{ kind: "strong", children: [text("1")] }]],
            [[text("c")]],
          ],
        },
      ],
    );
  });

  it("[NFR-SEC-07] leaves snake_case names, arithmetic and lone markers as written", () => {
    expect(visibleText(parseMarkdown("my_var_name = 2 * 3 * 4 and a_b_c"))).toBe(
      "my_var_name = 2 * 3 * 4 and a_b_c",
    );
    expect(visibleText(parseMarkdown("\\*not emphasis\\* and \\`not code\\`"))).toBe(
      "*not emphasis* and `not code`",
    );
  });

  it("[NFR-SEC-07] a star run opens and closes only a run of its own length", () => {
    expect(visibleText(parseMarkdown("Use *args and **kwargs in a call."))).toBe(
      "Use *args and **kwargs in a call.",
    );
    expect(walk(parseMarkdown("Use *args and **kwargs in a call.")).inlines).toHaveLength(1);
    expect(parseMarkdown("*a **b** c*")).toEqual([
      {
        kind: "paragraph",
        children: [
          {
            kind: "emphasis",
            children: [text("a "), { kind: "strong", children: [text("b")] }, text(" c")],
          },
        ],
      },
    ]);
    expect(parseMarkdown("***both***")).toEqual([
      {
        kind: "paragraph",
        children: [{ kind: "strong", children: [{ kind: "emphasis", children: [text("both")] }] }],
      },
    ]);
  });

  it("[NFR-SEC-07] a line that starts with an inline tag keeps its paragraph", () => {
    expect(
      parseMarkdown("Type your name.\n<name> is what you typed.\nThis line stays.\n\nNext."),
    ).toEqual([
      {
        kind: "paragraph",
        children: [text("Type your name.\n is what you typed.\nThis line stays.")],
      },
      { kind: "paragraph", children: [text("Next.")] },
    ]);
    expect(parseMarkdown("<kbd>Enter</kbd> runs the code, and this stays.")).toEqual([
      { kind: "paragraph", children: [text("Enter runs the code, and this stays.")] },
    ]);
  });

  it("[NFR-SEC-07] a line holding only a tag, a comment, or a script-like element drops its block", () => {
    expect(parseMarkdown("<div>\nhidden\n</div>\n\nShown")).toEqual([
      { kind: "paragraph", children: [text("Shown")] },
    ]);
    expect(parseMarkdown("<!--\nnote\n-->\nShown")).toEqual([
      { kind: "paragraph", children: [text("Shown")] },
    ]);
    expect(parseMarkdown("Text\n<script>\nalert(1)\n</script>\nMore")).toEqual([
      { kind: "paragraph", children: [text("Text")] },
      { kind: "paragraph", children: [text("More")] },
    ]);
  });

  it("[NFR-SEC-07] only a list starting at 1 interrupts a paragraph", () => {
    expect(parseMarkdown("In the year\n2024. we started.")).toEqual([
      { kind: "paragraph", children: [text("In the year\n2024. we started.")] },
    ]);
    expect(parseMarkdown("Steps:\n1. one")[1]?.kind).toBe("list");
  });

  it("[NFR-SEC-07] any ASCII punctuation can be escaped", () => {
    expect(visibleText(parseMarkdown('a \\= b \\" c \\$ d \\a'))).toBe('a = b " c $ d \\a');
  });

  it("[NFR-SEC-07] a code span keeps markers and tags as text", () => {
    expect(parseMarkdown("`<script>**x**</script>`")).toEqual([
      { kind: "paragraph", children: [{ kind: "code", text: "<script>**x**</script>" }] },
    ]);
  });
});

describe("malicious lessons", () => {
  // For these fixtures nothing tag-like is left in the text. That is a check
  // on these inputs, not the guarantee: dropping markup can join the text on
  // either side into something that looks like a tag (see below), so the
  // guarantee is the closed set of node kinds, checked https addresses, and
  // the renderer showing every text as text, never as HTML.
  it.each(MALICIOUS)("[T-06] [NFR-SEC-07] neutralizes %s", (_name, markdown) => {
    const tree = parseMarkdown(markdown);
    const { inlines, blocks } = walk(tree);
    for (const block of blocks) expect(BLOCK_KINDS.has(block.kind)).toBe(true);
    for (const node of inlines) expect(INLINE_KINDS.has(node.kind)).toBe(true);
    for (const href of links(tree)) expect(isKept(href)).toBe(true);
    const visible = visibleText(tree);
    expect(visible).not.toMatch(/<\/?[A-Za-z]/);
    expect(visible).not.toMatch(/on\w+\s*=/i);
    expect(visible).not.toContain("alert(1)</");
    expect(links(tree).join(" ")).not.toMatch(/javascript:|data:|vbscript:/i);
  });

  it("[T-06] drops a script element's content, not only its tags", () => {
    expect(visibleText(parseMarkdown("Hello <script>alert(1)</script> world"))).toBe(
      "Hello  world",
    );
    expect(parseMarkdown("<script>\nalert(1)\n</script>\n\nAfter")).toEqual([
      { kind: "paragraph", children: [text("After")] },
    ]);
  });

  it("[T-06] keeps the text of a link it refuses, and drops an image with its text", () => {
    expect(parseMarkdown("[click](javascript:alert(1))")).toEqual([
      { kind: "paragraph", children: [text("click")] },
    ]);
    expect(parseMarkdown("a ![alt text](https://example.com/x.png) b")).toEqual([
      { kind: "paragraph", children: [text("a  b")] },
    ]);
  });

  it("[T-06] a comment is dropped whole, inline and as a block", () => {
    expect(visibleText(parseMarkdown("before <!-- <script>alert(1)</script> --> after"))).toBe(
      "before  after",
    );
  });

  it("[T-06] text joined across dropped markup stays one text node and never a link", () => {
    expect(parseMarkdown("<scr<!-- -->ipt>x")).toEqual([
      { kind: "paragraph", children: [text("<script>x")] },
    ]);
    expect(parseMarkdown("<scr<b>ipt>alert(1)</scr<b>ipt>")).toEqual([
      { kind: "paragraph", children: [text("<script>alert(1)</script>")] },
    ]);
    expect(links(parseMarkdown("[x](java<!-- -->script:alert(1))"))).toEqual([]);
  });

  it("[T-06] a link label holds no link", () => {
    expect(
      parseMarkdown("[<https://inner.example> and [b](https://b.example)](https://outer.example)"),
    ).toEqual([
      {
        kind: "paragraph",
        children: [
          text("["),
          {
            kind: "link",
            href: "https://inner.example/",
            children: [text("https://inner.example")],
          },
          text(" and "),
          { kind: "link", href: "https://b.example/", children: [text("b")] },
          text("](https://outer.example)"),
        ],
      },
    ]);
    const [paragraph] = parseMarkdown("[<https://inner.example>](https://outer.example)");
    expect(paragraph).toEqual({
      kind: "paragraph",
      children: [
        {
          kind: "link",
          href: "https://outer.example/",
          children: [text("https://inner.example")],
        },
      ],
    });
  });

  it("[T-06] keeps an https autolink, with its address as its text", () => {
    expect(parseMarkdown("See <https://docs.python.org/3/>.")).toEqual([
      {
        kind: "paragraph",
        children: [
          text("See "),
          {
            kind: "link",
            href: "https://docs.python.org/3/",
            children: [text("https://docs.python.org/3/")],
          },
          text("."),
        ],
      },
    ]);
  });

  it("[T-06] text that only looks like HTML outside a tag stays: a < b and 3 > 2", () => {
    expect(visibleText(parseMarkdown("if a < b and 3 > 2:"))).toBe("if a < b and 3 > 2:");
  });

  it("[T-06] any input gives only allowed kinds and https links, and never throws", () => {
    const alphabet = [
      "a",
      " ",
      "\n",
      "*",
      "_",
      "`",
      "[",
      "]",
      "(",
      ")",
      "<",
      ">",
      "!",
      "#",
      "|",
      "-",
      ":",
      "\\",
      "1.",
      "> ",
      "```",
      "https://x.y",
      "javascript:",
      "<script>",
      "</script>",
      "onerror=",
    ];
    forAll(textFrom(alphabet, 80), (markdown) => {
      const tree = parseMarkdown(markdown);
      const { inlines, blocks } = walk(tree);
      expect(blocks.every((block) => BLOCK_KINDS.has(block.kind))).toBe(true);
      expect(inlines.every((node) => INLINE_KINDS.has(node.kind))).toBe(true);
      expect(links(tree).every(isKept)).toBe(true);
    });
  });
});

describe("limits", () => {
  it("[NFR-SEC-07] nesting deeper than the limit is kept as text, without deep recursion", () => {
    const deep = parseMarkdown(">".repeat(200) + " deep");
    let depth = 0;
    let node: Block | undefined = deep[0];
    while (node?.kind === "quote") {
      depth += 1;
      node = node.children[0];
    }
    expect(depth).toBe(MAX_DEPTH);
    expect(node?.kind).toBe("paragraph");
    const stars = parseMarkdown(`${"*".repeat(500)}x${"*".repeat(500)}`);
    expect(stars).toHaveLength(1);
  });

  it("[NFR-SEC-07] lists and strong emphasis nest no deeper than the limit", () => {
    const lists = parseMarkdown(`${"- ".repeat(50)}deep`);
    let listDepth = 0;
    let block: Block | undefined = lists[0];
    while (block?.kind === "list") {
      listDepth += 1;
      block = block.items[0]?.[0];
    }
    expect(listDepth).toBe(MAX_DEPTH + 1);
    expect(block?.kind).toBe("paragraph");

    const strong = parseMarkdown(`${"**a ".repeat(50)}x${" b**".repeat(50)}`);
    let strongDepth = 0;
    let node: Inline | undefined =
      strong[0]?.kind === "paragraph" ? strong[0].children[0] : undefined;
    while (node?.kind === "strong") {
      strongDepth += 1;
      node = node.children.find((child) => child.kind === "strong") ?? node.children[0];
    }
    expect(strongDepth).toBe(MAX_DEPTH);
  });

  // Each of these once took seconds to minutes (catastrophic backtracking);
  // the test fails by its timeout if one comes back.
  const PATHOLOGICAL: [string, string][] = [
    ["a heading of mixed spaces and tabs", `## a${" \t".repeat(9_000)}x`],
    ["a fence of mixed spaces and tabs", `\`\`\`${" \t".repeat(9_000)}x`],
    ["a delimiter row of mixed spaces and tabs", `|a|\n|-|${" \t".repeat(9_000)}x`],
    ["a list item of mixed spaces and tabs", `-${" \t".repeat(9_000)}x`],
    ["a quote of mixed spaces and tabs", `>${" \t".repeat(9_000)}x`],
  ];
  it.each(PATHOLOGICAL)("[T-14] [NFR-SEC-07] %s parses at once", (_name, markdown) => {
    expect(parseMarkdown(markdown)).toHaveLength(1);
  });

  it("[NFR-SEC-07] the lesson limit counts characters, and never splits one", () => {
    const emoji = "\u{1F600}".repeat(15_000);
    expect(visibleText(parseMarkdown(emoji))).toBe(emoji);
    const cut = visibleText(parseMarkdown(`${"a".repeat(MARKDOWN_LIMIT - 1)}\u{1F600}\u{1F600}`));
    expect(cut.endsWith("a\u{1F600}")).toBe(true);
    expect([...cut]).toHaveLength(MARKDOWN_LIMIT);
  });

  it("[NFR-SEC-07] a table wider than the limit stays text", () => {
    const columns = MAX_TABLE_COLUMNS + 1;
    const tree = parseMarkdown(
      `${"|a".repeat(columns)}|\n${"|-".repeat(columns)}|\n${"|b".repeat(columns)}|`,
    );
    expect(walk(tree).blocks.map((block) => block.kind)).toEqual(["paragraph"]);
    const widest = parseMarkdown(
      `${"|a".repeat(MAX_TABLE_COLUMNS)}|\n${"|-".repeat(MAX_TABLE_COLUMNS)}|`,
    );
    expect(widest[0]?.kind).toBe("table");
  });

  it("[NFR-SEC-07] a table row keeps only the cells it has, up to the header's width", () => {
    expect(parseMarkdown("| a | b |\n|---|---|\n| 1 |\n| 1 | 2 | 3 | 4 |")).toEqual([
      {
        kind: "table",
        align: [undefined, undefined],
        head: [[text("a")], [text("b")]],
        rows: [[[text("1")]], [[text("1")], [text("2")]]],
      },
    ]);
  });

  // The tree's size is bounded by the input's: the widest table, many short
  // rows, deep nesting and dense markup at the lesson limit each give a tree
  // whose JSON is at most this many times the input.
  const SIZE_FACTOR = 40;
  const fill = (unit: string) => unit.repeat(Math.floor(MARKDOWN_LIMIT / unit.length));
  const head = `${"|a".repeat(MAX_TABLE_COLUMNS)}|\n${"|-".repeat(MAX_TABLE_COLUMNS)}|\n`;
  const SHAPES: [string, string][] = [
    ["a table of empty rows", head + fill("|\n")],
    ["a table of full empty rows", head + fill(`${"|".repeat(MAX_TABLE_COLUMNS + 1)}\n`)],
    ["a 2,499-column table", `${"|a".repeat(2499)}|\n${"|-".repeat(2499)}|\n${fill("|\n")}`],
    ["list items", fill("- a\n")],
    ["nested list items", fill("- - - - - - - - - a\n")],
    ["quotes", fill(">a\n\n")],
    ["nested quotes", fill(">>>>>>>>>a\n\n")],
    ["emphasis", fill("*a*")],
    ["nested emphasis", fill("***a***")],
    ["code spans", fill("`a`")],
    ["links", fill("[a](https://x.y)")],
    ["headings", fill("## a\n")],
  ];
  it.each(SHAPES)(
    "[NFR-SEC-07] %s at the lesson limit give a tree of bounded size",
    (_name, markdown) => {
      const size = JSON.stringify(parseMarkdown(markdown)).length;
      expect(size).toBeLessThanOrEqual(SIZE_FACTOR * Math.min(markdown.length, MARKDOWN_LIMIT));
    },
  );

  it("[NFR-SEC-07] reads at most the lesson limit", () => {
    const tree = parseMarkdown(`${"a".repeat(20_000)}TAIL`);
    expect(visibleText(tree)).not.toContain("TAIL");
  });

  it("[NFR-SEC-07] https links only, kept in the form the address parser gives", () => {
    expect(allowedHref("https://example.com/a?b=c#d")).toBe("https://example.com/a?b=c#d");
    expect(allowedHref("https://Example.COM")).toBe("https://example.com/");
    expect(allowedHref("https://\\evil.example")).toBe("https://evil.example/");
    expect(parseMarkdown("[a](https://\\evil.example)")).toEqual([
      {
        kind: "paragraph",
        children: [{ kind: "link", href: "https://evil.example/", children: [text("a")] }],
      },
    ]);
  });

  it("[NFR-SEC-07] refuses other schemes, malformed addresses and addresses with credentials", () => {
    const refused = [
      "http://x.y",
      "HTTPS://x.y",
      "HtTpS://x.y",
      "https:/x",
      "https:evil",
      "https:/evil",
      "https:\\\\evil",
      "https:\t//evil",
      "\0https://x.y",
      "https://ev\0il",
      "https://evil\u2028",
      "\u200bhttps://x.y",
      "https://a\u00a0b",
      "https://evil\u007f",
      "https%3A//x.y",
      "https&#58;//x.y",
      "\\https://x.y",
      "https://",
      "javascript:x",
      "",
      "https://trusted.example@evil.example/",
      "https://user:pass@x.y/",
      "https://javascript:alert(1)@evil",
    ];
    for (const href of refused) expect(allowedHref(href), JSON.stringify(href)).toBeUndefined();
    expect(links(parseMarkdown("[a](https://trusted.example@evil.example/)"))).toEqual([]);
    expect(links(parseMarkdown("<https://a b>"))).toEqual([]);
  });
});
