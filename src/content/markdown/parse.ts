// Lesson instructions, from Markdown to a tree of allowed nodes
// (docs/spec/04-content-system.md section 5; NFR-SEC-07, T-06).
//
// The allowlist is the type: a node is one of the kinds below and nothing
// else, and every piece of text is plain text, so no HTML string comes out of
// here for anything to inject. The one renderer turns this tree into
// elements; React escapes the text.
//
// Allowed: paragraphs, emphasis and strong emphasis, inline code, fenced code
// blocks with an optional language, lists, tables, headings of level two and
// three, block quotes, and `https` links. Dropped: raw HTML (tags, comments,
// and the content of script-like elements), images, and links of any other
// scheme, whose text stays as text. A heading of another level stays as a
// paragraph. This is the subset the spec allows, not all of CommonMark.

export type Inline =
  | { kind: "text"; text: string }
  | { kind: "code"; text: string }
  | { kind: "emphasis"; children: Inline[] }
  | { kind: "strong"; children: Inline[] }
  | { kind: "link"; href: string; children: Inline[] };

export type Alignment = "left" | "center" | "right" | undefined;

export type Block =
  | { kind: "paragraph"; children: Inline[] }
  | { kind: "heading"; level: 2 | 3; children: Inline[] }
  | { kind: "code_block"; language: string | undefined; text: string }
  | { kind: "list"; ordered: boolean; start: number; items: Block[][] }
  | { kind: "quote"; children: Block[] }
  | {
      kind: "table";
      align: Alignment[];
      head: Inline[][];
      rows: Inline[][][];
    };

/** Quotes and lists inside each other deeper than this are kept as text. */
export const MAX_DEPTH = 8;

/** The longest instructions a lesson has (section 1.3), and so the most this reads. */
export const MARKDOWN_LIMIT = 20_000;

/**
 * A table with more columns than this stays as text. Rows keep only the cells
 * they have, so the tree grows with the input, not with columns times rows.
 */
export const MAX_TABLE_COLUMNS = 20;

const FENCE = /^ {0,3}(`{3,}|~{3,})(.*)$/;
const LANGUAGE = /^[A-Za-z0-9_+#.-]{1,30}$/;
const HEADING = /^ {0,3}(#{1,6})(?:[ \t](.*))?$/;
const QUOTE = /^ {0,3}> ?(.*)$/;
const LIST_ITEM = /^( {0,3})([-*+]|(\d{1,9})[.)])([ \t]+(.*))?$/;
const DELIMITER_CELL = /^:?-+:?$/;
const THEMATIC_BREAK = /^ {0,3}([-*_])([ \t]*\1){2,}[ \t]*$/;
/** Raw HTML that starts a block, and may interrupt a paragraph: a comment, a declaration, or a script-like element. */
const HTML_BLOCK = /^ {0,3}<(?:!--|![A-Za-z]|\?|([A-Za-z][A-Za-z0-9-]*)(?:[\s/>]|$))/;
/** A line holding one tag and nothing else, which starts a block but cannot interrupt a paragraph. */
const TAG_LINE = /^ {0,3}<\/?[A-Za-z][A-Za-z0-9-]*(?:\s[^<>]*)?\/?>[ \t]*$/;
const BLANK = /^[ \t]*$/;

/** Elements whose content is dropped with them, not kept as text. */
const DROPPED_WITH_CONTENT =
  /^(?:script|style|iframe|textarea|title|noscript|template|xmp|svg|math|object)$/i;

/** An opening fence: its marker, and the first word of its info string if it names a language. */
function fence(line: string): { marker: string; language: string | undefined } | undefined {
  const match = FENCE.exec(line);
  if (match === null) return undefined;
  const marker = match[1] ?? "```";
  const info = match[2] ?? "";
  if (marker.startsWith("`") && info.includes("`")) return undefined;
  const word = info.trim().split(/[ \t]/)[0] ?? "";
  return { marker, language: LANGUAGE.test(word) ? word : undefined };
}

/** A heading's level and text, without the closing run of `#` the author may add. */
function heading(line: string): { level: number; text: string } | undefined {
  const match = HEADING.exec(line);
  if (match === null) return undefined;
  let text = (match[2] ?? "").trim();
  const closing = /(?:^|[ \t])#+$/.exec(text);
  if (closing !== null) text = text.slice(0, closing.index).trim();
  return { level: match[1]?.length ?? 0, text };
}

function isDelimiterRow(line: string): boolean {
  return line.includes("-") && cells(line).every((cell) => DELIMITER_CELL.test(cell));
}

/** The first `MARKDOWN_LIMIT` characters, counted as code points, the way the database counts them. */
function withinLimit(markdown: string): string {
  if (markdown.length <= MARKDOWN_LIMIT) return markdown;
  let count = 0;
  let index = 0;
  while (index < markdown.length && count < MARKDOWN_LIMIT) {
    index += (markdown.codePointAt(index) ?? 0) > 0xffff ? 2 : 1;
    count += 1;
  }
  return markdown.slice(0, index);
}

/** Whether `line` starts raw HTML that interrupts a paragraph. */
function interruptingHtml(line: string): boolean {
  const match = HTML_BLOCK.exec(line);
  if (match === null) return false;
  const name = match[1];
  return name === undefined || DROPPED_WITH_CONTENT.test(name);
}

/** A list item may interrupt a paragraph if it is a bullet or starts at 1. */
function interruptingItem(line: string): boolean {
  const match = LIST_ITEM.exec(line);
  return match !== null && (match[3] === undefined || Number(match[3]) === 1);
}

/** Parses lesson instructions. Text past the lesson limit is not read. */
export function parseMarkdown(markdown: string): Block[] {
  const lines = withinLimit(markdown).replace(/\r\n?/g, "\n").split("\n");
  return blocks(lines, 0);
}

function blocks(lines: string[], depth: number): Block[] {
  const out: Block[] = [];
  let index = 0;
  while (index < lines.length) {
    const line = lines[index] ?? "";
    if (BLANK.test(line)) {
      index += 1;
      continue;
    }

    const opening = fence(line);
    if (opening !== undefined) {
      const { marker, language } = opening;
      const body: string[] = [];
      index += 1;
      while (index < lines.length) {
        const current = lines[index] ?? "";
        const closing = /^ {0,3}(`{3,}|~{3,})[ \t]*$/.exec(current);
        if (
          closing !== null &&
          closing[1]?.[0] === marker[0] &&
          (closing[1]?.length ?? 0) >= marker.length
        ) {
          index += 1;
          break;
        }
        body.push(current);
        index += 1;
      }
      out.push({ kind: "code_block", language, text: body.join("\n") });
      continue;
    }

    const title = heading(line);
    if (title !== undefined) {
      const { level } = title;
      const children = inlines(title.text, depth);
      out.push(
        level === 2 || level === 3
          ? { kind: "heading", level, children }
          : { kind: "paragraph", children },
      );
      index += 1;
      continue;
    }

    if (THEMATIC_BREAK.test(line)) {
      index += 1;
      continue;
    }

    if (interruptingHtml(line) || TAG_LINE.test(line)) {
      index = skipHtmlBlock(lines, index);
      continue;
    }

    if (QUOTE.test(line)) {
      const inner: string[] = [];
      while (index < lines.length) {
        const match = QUOTE.exec(lines[index] ?? "");
        if (match === null) break;
        inner.push(match[1] ?? "");
        index += 1;
      }
      out.push(
        depth < MAX_DEPTH
          ? { kind: "quote", children: blocks(inner, depth + 1) }
          : { kind: "paragraph", children: inlines(inner.join("\n"), depth) },
      );
      continue;
    }

    const item = LIST_ITEM.exec(line);
    if (item !== null) {
      const parsed = list(lines, index, depth);
      out.push(parsed.block);
      index = parsed.next;
      continue;
    }

    const next = lines[index + 1];
    if (line.includes("|") && next !== undefined && isDelimiterRow(next)) {
      const parsed = table(lines, index, depth);
      if (parsed !== undefined) {
        out.push(parsed.block);
        index = parsed.next;
        continue;
      }
    }

    // A paragraph runs until a blank line or the start of another block.
    const paragraph: string[] = [line.trim()];
    index += 1;
    while (index < lines.length) {
      const current = lines[index] ?? "";
      if (
        BLANK.test(current) ||
        fence(current) !== undefined ||
        HEADING.test(current) ||
        QUOTE.test(current) ||
        interruptingItem(current) ||
        interruptingHtml(current) ||
        THEMATIC_BREAK.test(current)
      ) {
        break;
      }
      paragraph.push(current.trim());
      index += 1;
    }
    out.push({ kind: "paragraph", children: inlines(paragraph.join("\n"), depth) });
  }
  return out;
}

/** Raw HTML at the start of a line: dropped up to the next blank line, or past a script-like element's end. */
function skipHtmlBlock(lines: string[], start: number): number {
  const first = lines[start] ?? "";
  const opened = /^ {0,3}<([A-Za-z][A-Za-z0-9-]*)/.exec(first)?.[1];
  if (opened !== undefined && DROPPED_WITH_CONTENT.test(opened)) {
    const closing = new RegExp(`</${opened}\\s*>`, "i");
    let index = start;
    while (index < lines.length && !closing.test(lines[index] ?? "")) index += 1;
    return index + 1;
  }
  if (/^ {0,3}<!--/.test(first)) {
    let index = start;
    while (index < lines.length && !(lines[index] ?? "").includes("-->")) index += 1;
    return index + 1;
  }
  let index = start;
  while (index < lines.length && !BLANK.test(lines[index] ?? "")) index += 1;
  return index;
}

function list(lines: string[], start: number, depth: number): { block: Block; next: number } {
  const first = LIST_ITEM.exec(lines[start] ?? "");
  const ordered = first?.[3] !== undefined;
  const startNumber = ordered ? Number(first?.[3]) : 1;
  const bullet = first?.[2]?.slice(-1);
  const items: Block[][] = [];
  let index = start;
  while (index < lines.length) {
    const match = LIST_ITEM.exec(lines[index] ?? "");
    if (match === null || (match[3] !== undefined) !== ordered || match[2]?.slice(-1) !== bullet) {
      break;
    }
    // The item's content starts after the marker; lines indented past the
    // marker, and blank lines between them, belong to the item.
    const indent = (match[1]?.length ?? 0) + (match[2]?.length ?? 0) + 1;
    const content: string[] = [match[5] ?? ""];
    index += 1;
    while (index < lines.length) {
      const current = lines[index] ?? "";
      if (BLANK.test(current)) {
        const following = lines[index + 1];
        if (following !== undefined && leadingSpaces(following) >= indent) {
          content.push("");
          index += 1;
          continue;
        }
        break;
      }
      if (leadingSpaces(current) >= indent) {
        content.push(current.slice(indent));
        index += 1;
        continue;
      }
      // A line that starts nothing new continues the item's paragraph.
      if (
        LIST_ITEM.test(current) ||
        fence(current) !== undefined ||
        HEADING.test(current) ||
        QUOTE.test(current) ||
        interruptingHtml(current) ||
        THEMATIC_BREAK.test(current)
      ) {
        break;
      }
      content.push(current.trim());
      index += 1;
    }
    items.push(
      depth < MAX_DEPTH
        ? blocks(content, depth + 1)
        : [{ kind: "paragraph", children: inlines(content.join("\n"), depth) }],
    );
    while (index < lines.length && BLANK.test(lines[index] ?? "")) {
      const following = lines[index + 1];
      if (following === undefined || !LIST_ITEM.test(following)) break;
      index += 1;
    }
  }
  return { block: { kind: "list", ordered, start: startNumber, items }, next: index };
}

function leadingSpaces(line: string): number {
  return line.length - line.replace(/^ +/, "").length;
}

function cells(row: string): string[] {
  let text = row.trim();
  if (text.startsWith("|")) text = text.slice(1);
  if (text.endsWith("|") && !text.endsWith("\\|")) text = text.slice(0, -1);
  const out: string[] = [];
  let current = "";
  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    if (character === "\\" && text[index + 1] === "|") {
      current += "|";
      index += 1;
    } else if (character === "|") {
      out.push(current.trim());
      current = "";
    } else {
      current += character;
    }
  }
  out.push(current.trim());
  return out;
}

function table(
  lines: string[],
  start: number,
  depth: number,
): { block: Block; next: number } | undefined {
  const head = cells(lines[start] ?? "");
  const delimiter = cells(lines[start + 1] ?? "");
  if (head.length !== delimiter.length || head.length > MAX_TABLE_COLUMNS) return undefined;
  const align: Alignment[] = delimiter.map((cell) => {
    const left = cell.startsWith(":");
    const right = cell.endsWith(":");
    return left && right ? "center" : right ? "right" : left ? "left" : undefined;
  });
  const rows: Inline[][][] = [];
  let index = start + 2;
  while (index < lines.length) {
    const current = lines[index] ?? "";
    if (BLANK.test(current) || !current.includes("|")) break;
    const row = cells(current);
    rows.push(row.slice(0, head.length).map((cell) => inlines(cell, depth)));
    index += 1;
  }
  return {
    block: {
      kind: "table",
      align,
      head: head.map((cell) => inlines(cell, depth)),
      rows,
    },
    next: index,
  };
}

/**
 * The address a link keeps: an `https` address with no user name or password,
 * in the form the URL parser gives, which is what a browser will follow.
 * Anything else gives no link.
 */
export function allowedHref(href: string): string | undefined {
  if (!href.startsWith("https://")) return undefined;
  let url: URL;
  try {
    url = new URL(href);
  } catch {
    return undefined;
  }
  if (url.protocol !== "https:" || url.username !== "" || url.password !== "") return undefined;
  return url.href;
}

const ESCAPABLE = /[!-/:-@[-`{-~]/;
const HTML_TAG = /^<(\/?)([A-Za-z][A-Za-z0-9-]*)(?:\s[^<>]*)?\/?>/;
const AUTOLINK = /^<[A-Za-z][A-Za-z0-9+.-]{1,31}:[^\s<>]*>/;
const WORD = /[\p{L}\p{N}]/u;
const SPACE = /\s/;

/**
 * An emphasis run waiting for its closer: its marker, as written, and what
 * has been read since it. If no closer comes, the marker is kept as text.
 */
type Frame = { marker: string; children: Inline[] };

/**
 * Inline content. Emphasis is matched in one pass with a stack of open runs
 * (the CommonMark approach, simplified): a run of one, two or three `*` or
 * `_` closes the nearest open run of the same marker, and the runs opened
 * after that one are kept as text. A run opens before a non-space and
 * closes after one; `_` also needs no letter or digit outside it, so
 * `snake_case_name` stays as written. `inLink` is set inside a link's text,
 * where a link may not open.
 */
function inlines(text: string, depth: number, inLink = false): Inline[] {
  const root: Frame = { marker: "", children: [] };
  const frames: Frame[] = [root];
  // How many frames of each marker are open, so a closer with none to
  // match costs nothing and the pass stays linear.
  const open = new Map<string, number>();
  const lastCommentEnd = text.lastIndexOf("-->");

  const append = (target: Inline[], node: Inline) => {
    const last = target[target.length - 1];
    if (node.kind === "text" && last?.kind === "text") last.text += node.text;
    else target.push(node.kind === "text" ? { kind: "text", text: node.text } : node);
  };
  const push = (node: Inline) => {
    const top = frames[frames.length - 1] ?? root;
    if (node.kind === "text" && node.text === "") return;
    append(top.children, node);
  };
  /** Ends the top frame without a closer: its marker and content become its parent's. */
  const unwind = () => {
    const frame = frames.pop();
    if (frame === undefined || frame === root) return;
    open.set(frame.marker, (open.get(frame.marker) ?? 1) - 1);
    push({ kind: "text", text: frame.marker });
    for (const child of frame.children) push(child);
  };

  let index = 0;
  while (index < text.length) {
    const character = text[index] ?? "";

    if (character === "\\" && ESCAPABLE.test(text[index + 1] ?? "")) {
      push({ kind: "text", text: text[index + 1] ?? "" });
      index += 2;
      continue;
    }

    if (character === "`") {
      const run = /^`+/.exec(text.slice(index))?.[0] ?? "`";
      const close = text.indexOf(run, index + run.length);
      if (close !== -1) {
        let code = text.slice(index + run.length, close).replace(/\n/g, " ");
        if (code.startsWith(" ") && code.endsWith(" ") && code.trim() !== "")
          code = code.slice(1, -1);
        push({ kind: "code", text: code });
        index = close + run.length;
        continue;
      }
      push({ kind: "text", text: run });
      index += run.length;
      continue;
    }

    if (character === "<") {
      const rest = text.slice(index);
      if (rest.startsWith("<!--")) {
        const end = lastCommentEnd >= index + 4 ? text.indexOf("-->", index + 4) : -1;
        if (end !== -1) {
          index = end + 3;
          continue;
        }
      }
      // An https autolink is kept as a link whose text is its address; one
      // with any other scheme is dropped. Inside a link's text it is text.
      const autolink = AUTOLINK.exec(rest);
      if (autolink !== null) {
        const written = autolink[0].slice(1, -1);
        const href = allowedHref(written);
        if (href !== undefined) {
          push(
            inLink
              ? { kind: "text", text: written }
              : { kind: "link", href, children: [{ kind: "text", text: written }] },
          );
        }
        index += autolink[0].length;
        continue;
      }
      const tag = HTML_TAG.exec(rest);
      if (tag !== null) {
        index += tag[0].length;
        const name = tag[2] ?? "";
        if (tag[1] === "" && DROPPED_WITH_CONTENT.test(name)) {
          const closing = new RegExp(`</${name}\\s*>`, "i").exec(text.slice(index));
          index = closing === null ? text.length : index + closing.index + closing[0].length;
        }
        continue;
      }
    }

    if (character === "!" && text[index + 1] === "[") {
      const image = link(text, index + 1);
      if (image !== undefined) {
        // Images are not allowed; neither the image nor its text is kept.
        index = image.end;
        continue;
      }
    }

    if (character === "[") {
      const parsed = link(text, index);
      if (parsed !== undefined) {
        const level = depth + frames.length;
        const children =
          level < MAX_DEPTH
            ? inlines(parsed.label, level, true)
            : [{ kind: "text" as const, text: parsed.label }];
        const href = allowedHref(parsed.href);
        if (href !== undefined && !inLink) push({ kind: "link", href, children });
        else for (const child of children) push(child);
        index = parsed.end;
        continue;
      }
    }

    if (character === "*" || character === "_") {
      let end = index;
      while (text[end] === character) end += 1;
      const marker = text.slice(index, end);
      const before = text[index - 1] ?? " ";
      const after = text[end] ?? " ";
      const underscore = character === "_";
      const canClose =
        marker.length <= 3 && !SPACE.test(before) && !(underscore && WORD.test(after));
      const canOpen =
        marker.length <= 3 && !SPACE.test(after) && !(underscore && WORD.test(before));
      index = end;

      if (canClose && (open.get(marker) ?? 0) > 0) {
        while ((frames[frames.length - 1] ?? root).marker !== marker) unwind();
        const frame = frames.pop() ?? root;
        open.set(marker, (open.get(marker) ?? 1) - 1);
        const children = frame.children;
        push(
          marker.length === 1
            ? { kind: "emphasis", children }
            : marker.length === 2
              ? { kind: "strong", children }
              : { kind: "strong", children: [{ kind: "emphasis", children }] },
        );
        continue;
      }
      if (canOpen && depth + frames.length <= MAX_DEPTH) {
        frames.push({ marker, children: [] });
        open.set(marker, (open.get(marker) ?? 0) + 1);
        continue;
      }
      push({ kind: "text", text: marker });
      continue;
    }

    let plain = index + 1;
    while (plain < text.length && !/[\\`<![*_]/.test(text[plain] ?? "")) plain += 1;
    push({ kind: "text", text: text.slice(index, plain) });
    index = plain;
  }
  while (frames.length > 1) unwind();
  return root.children;
}

/**
 * A `[label](href)` at `start`, with no nested brackets in the label. The
 * address may hold balanced parentheses one level deep, so a refused
 * `javascript:alert(1)` is still read as one link and dropped whole.
 */
function link(
  text: string,
  start: number,
): { label: string; href: string; end: number } | undefined {
  const match =
    /^\[([^[\]\n]*)\]\(\s*<?((?:[^\s()<>]|\([^\s()<>]*\))*)>?(?:\s+"[^"\n]*")?\s*\)/.exec(
      text.slice(start),
    );
  if (match === null) return undefined;
  return { label: match[1] ?? "", href: match[2] ?? "", end: start + match[0].length };
}
