import { describe, expect, it } from "vitest";
import { forAll, textFrom } from "../../../scripts/testing/property";
import { type Block, type Inline, isAllowedHref, MAX_DEPTH, parseMarkdown } from "./parse";

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

  it("[NFR-SEC-07] keeps fenced code blocks, with or without a language, exactly as written", () => {
    expect(parseMarkdown("```python\nif x < 1:\n    print('<b>')\n```\n\n~~~\nplain\n~~~")).toEqual(
      [
        { kind: "code_block", language: "python", text: "if x < 1:\n    print('<b>')" },
        { kind: "code_block", language: undefined, text: "plain" },
      ],
    );
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

  it("[NFR-SEC-07] keeps tables with their alignment, an escaped pipe, and missing cells", () => {
    expect(parseMarkdown("| Name | Value |\n|:-----|------:|\n| `a\\|b` | **1** |\n| c |")).toEqual(
      [
        {
          kind: "table",
          align: ["left", "right"],
          head: [[text("Name")], [text("Value")]],
          rows: [
            [[{ kind: "code", text: "a|b" }], [{ kind: "strong", children: [text("1")] }]],
            [[text("c")], []],
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

  it("[NFR-SEC-07] a code span keeps markers and tags as text", () => {
    expect(parseMarkdown("`<script>**x**</script>`")).toEqual([
      { kind: "paragraph", children: [{ kind: "code", text: "<script>**x**</script>" }] },
    ]);
  });
});

/** T-06: each payload must come out inert. */
const MALICIOUS: [string, string][] = [
  ["a script tag", "Hello <script>alert(1)</script> world"],
  ["a script block", "<script>\nalert(1)\n</script>\n\nAfter"],
  ["an event handler attribute", 'Look <img src="x" onerror="alert(1)"> here'],
  ["an svg with onload", "<svg onload=alert(1)><circle/></svg>"],
  ["an iframe", '<iframe src="https://evil.example"></iframe>'],
  ["a raw anchor", '<a href="javascript:alert(1)">click</a>'],
  ["a javascript: link", "[click](javascript:alert(1))"],
  ["a JAVASCRIPT: link in capitals", "[click](JAVASCRIPT:alert(1))"],
  ["a link with leading space", "[click]( javascript:alert(1))"],
  ["an entity-encoded scheme", "[click](&#106;avascript:alert(1))"],
  ["a data: link", "[click](data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==)"],
  ["a vbscript: link", "[click](vbscript:msgbox(1))"],
  ["an http link", "[plain](http://example.com)"],
  ["a protocol-relative link", "[pr](//evil.example)"],
  ["an autolink with javascript:", "<javascript:alert(1)>"],
  ["an image", "![alt text](https://example.com/x.png)"],
  ["an image with a javascript: source", "![x](javascript:alert(1))"],
  ["an HTML comment", "before <!-- <script>alert(1)</script> --> after"],
  ["a style element", "<style>body{display:none}</style>Text"],
  ["HTML nested in emphasis", "**<b onclick=alert(1)>bold</b>**"],
  ["HTML nested in a link label", "[<img src=x onerror=alert(1)>](https://example.com)"],
  ["HTML in a table cell", "| a |\n|---|\n| <script>alert(1)</script> |"],
  ["HTML in a list item", "- <div onmouseover=alert(1)>x</div>"],
  ["HTML in a quote", "> <object data=x></object>"],
  ["a reference-style link", "[x][1]\n\n[1]: javascript:alert(1)"],
  ["an unclosed script tag", "text <script>alert(1)"],
  ["a template element", "<template><script>alert(1)</script></template>"],
];

describe("malicious lessons", () => {
  it.each(MALICIOUS)("[T-06] [NFR-SEC-07] neutralizes %s", (_name, markdown) => {
    const tree = parseMarkdown(markdown);
    const { inlines, blocks } = walk(tree);
    for (const block of blocks) expect(BLOCK_KINDS.has(block.kind)).toBe(true);
    for (const node of inlines) expect(INLINE_KINDS.has(node.kind)).toBe(true);
    for (const href of links(tree)) expect(isAllowedHref(href)).toBe(true);
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
      expect(links(tree).every(isAllowedHref)).toBe(true);
      // An escaped "\<" is text the author asked for; React shows it as text.
      if (!markdown.includes("\\")) expect(visibleText(tree)).not.toMatch(/<script/i);
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

  it("[NFR-SEC-07] reads at most the lesson limit", () => {
    const tree = parseMarkdown(`${"a".repeat(20_000)}TAIL`);
    expect(visibleText(tree)).not.toContain("TAIL");
  });

  it("[NFR-SEC-07] https links only, checked as an address", () => {
    expect(isAllowedHref("https://example.com/a?b=c#d")).toBe(true);
    for (const href of ["http://x.y", "HTTPS://x.y", "https:/x", "https://", "javascript:x", ""]) {
      expect(isAllowedHref(href)).toBe(false);
    }
  });
});
