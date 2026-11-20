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

const FENCE = /^ {0,3}(`{3,}|~{3,})[ \t]*([A-Za-z0-9_+#.-]{0,30})[ \t]*$/;
const HEADING = /^ {0,3}(#{1,6})(?:[ \t]+(.*?))?[ \t]*#*[ \t]*$/;
const QUOTE = /^ {0,3}> ?(.*)$/;
const LIST_ITEM = /^( {0,3})([-*+]|(\d{1,9})[.)])([ \t]+(.*))?$/;
const TABLE_DELIMITER = /^ {0,3}\|?[ \t]*:?-+:?[ \t]*(\|[ \t]*:?-+:?[ \t]*)*\|?[ \t]*$/;
const THEMATIC_BREAK = /^ {0,3}([-*_])([ \t]*\1){2,}[ \t]*$/;
const HTML_BLOCK = /^ {0,3}<(?:!--|\/?[A-Za-z][A-Za-z0-9-]*(?:[\s/>]|$)|![A-Za-z]|\?)/;
const BLANK = /^[ \t]*$/;

/** Elements whose content is dropped with them, not kept as text. */
const DROPPED_WITH_CONTENT =
  /^(?:script|style|iframe|textarea|title|noscript|template|xmp|svg|math|object)$/i;

/** Parses lesson instructions. Text past the lesson limit is not read. */
export function parseMarkdown(markdown: string): Block[] {
  const lines = markdown.slice(0, MARKDOWN_LIMIT).replace(/\r\n?/g, "\n").split("\n");
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

    const fence = FENCE.exec(line);
    if (fence !== null) {
      const marker = fence[1] ?? "```";
      const language = fence[2] === "" ? undefined : fence[2];
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

    const heading = HEADING.exec(line);
    if (heading !== null) {
      const level = heading[1]?.length ?? 0;
      const children = inlines(heading[2] ?? "", depth);
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

    if (HTML_BLOCK.test(line)) {
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
    if (line.includes("|") && next !== undefined && TABLE_DELIMITER.test(next)) {
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
        FENCE.test(current) ||
        HEADING.test(current) ||
        QUOTE.test(current) ||
        LIST_ITEM.test(current) ||
        HTML_BLOCK.test(current) ||
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
        FENCE.test(current) ||
        HEADING.test(current) ||
        QUOTE.test(current) ||
        HTML_BLOCK.test(current) ||
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
  if (head.length !== delimiter.length) return undefined;
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
    rows.push(head.map((_, column) => inlines(row[column] ?? "", depth)));
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

/** Whether `href` is an `https` address, and so a link that may be kept. */
export function isAllowedHref(href: string): boolean {
  if (!href.startsWith("https://")) return false;
  try {
    return new URL(href).protocol === "https:";
  } catch {
    return false;
  }
}

const ESCAPABLE = /[\\`*_{}[\]()#+\-.!|<>~]/;
const HTML_TAG = /^<(\/?)([A-Za-z][A-Za-z0-9-]*)(?:\s[^<>]*)?\/?>/;
const HTML_COMMENT = /^<!--[\s\S]*?-->/;
const AUTOLINK = /^<[A-Za-z][A-Za-z0-9+.-]{1,31}:[^\s<>]*>/;
const WORD = /[\p{L}\p{N}]/u;

function inlines(text: string, depth: number): Inline[] {
  const out: Inline[] = [];
  let buffer = "";
  const flush = () => {
    if (buffer !== "") {
      const last = out[out.length - 1];
      if (last?.kind === "text") last.text += buffer;
      else out.push({ kind: "text", text: buffer });
      buffer = "";
    }
  };
  const push = (node: Inline) => {
    flush();
    if (node.kind === "text") {
      buffer = node.text;
      return;
    }
    out.push(node);
  };

  let index = 0;
  while (index < text.length) {
    const character = text[index] ?? "";
    const rest = text.slice(index);

    if (character === "\\" && ESCAPABLE.test(text[index + 1] ?? "")) {
      buffer += text[index + 1];
      index += 2;
      continue;
    }

    if (character === "`") {
      const run = /^`+/.exec(rest)?.[0] ?? "`";
      const close = text.indexOf(run, index + run.length);
      if (close !== -1) {
        let code = text.slice(index + run.length, close).replace(/\n/g, " ");
        if (code.startsWith(" ") && code.endsWith(" ") && code.trim() !== "")
          code = code.slice(1, -1);
        push({ kind: "code", text: code });
        index = close + run.length;
        continue;
      }
      buffer += run;
      index += run.length;
      continue;
    }

    if (character === "<") {
      const comment = HTML_COMMENT.exec(rest);
      if (comment !== null) {
        index += comment[0].length;
        continue;
      }
      // An autolink names a scheme; raw HTML is dropped, and so is an
      // autolink, since a link needs text the author wrote.
      const autolink = AUTOLINK.exec(rest);
      if (autolink !== null) {
        const href = autolink[0].slice(1, -1);
        if (isAllowedHref(href))
          push({ kind: "link", href, children: [{ kind: "text", text: href }] });
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
        const children =
          depth < MAX_DEPTH
            ? inlines(parsed.label, depth + 1)
            : [{ kind: "text" as const, text: parsed.label }];
        if (isAllowedHref(parsed.href)) push({ kind: "link", href: parsed.href, children });
        else for (const child of children) push(child);
        index = parsed.end;
        continue;
      }
    }

    if (character === "*" || character === "_") {
      const strongMarker = character.repeat(2);
      if (rest.startsWith(strongMarker)) {
        const close = closing(text, index, strongMarker);
        if (close !== undefined) {
          const inner = text.slice(index + 2, close);
          push(
            depth < MAX_DEPTH
              ? { kind: "strong", children: inlines(inner, depth + 1) }
              : { kind: "text", text: inner },
          );
          index = close + 2;
          continue;
        }
      }
      const close = closing(text, index, character);
      if (close !== undefined) {
        const inner = text.slice(index + 1, close);
        push(
          depth < MAX_DEPTH
            ? { kind: "emphasis", children: inlines(inner, depth + 1) }
            : { kind: "text", text: inner },
        );
        index = close + 1;
        continue;
      }
    }

    buffer += character;
    index += 1;
  }
  flush();
  return out;
}

/**
 * Where the emphasis opened at `start` by `marker` closes, if it does. It
 * opens before a non-space and closes after one; `_` also needs no letter or
 * digit outside it, so `snake_case_name` stays as written.
 */
function closing(text: string, start: number, marker: string): number | undefined {
  const after = text[start + marker.length] ?? "";
  const before = text[start - 1] ?? "";
  if (after === "" || /\s/.test(after)) return undefined;
  if (marker[0] === "_" && WORD.test(before)) return undefined;
  let index = start + marker.length + 1;
  while (index <= text.length - marker.length) {
    if (text[index] === "\\") {
      index += 2;
      continue;
    }
    if (text[index] === "`") {
      const run = /^`+/.exec(text.slice(index))?.[0] ?? "`";
      const close = text.indexOf(run, index + run.length);
      if (close !== -1) {
        index = close + run.length;
        continue;
      }
    }
    if (text.startsWith(marker, index)) {
      const previous = text[index - 1] ?? "";
      const next = text[index + marker.length] ?? "";
      const doubled = marker.length === 1 && next === marker;
      if (!/\s/.test(previous) && !doubled && !(marker[0] === "_" && WORD.test(next))) {
        return index;
      }
    }
    index += 1;
  }
  return undefined;
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
