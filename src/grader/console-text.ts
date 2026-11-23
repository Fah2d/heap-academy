// Program output as the interface may show it (docs/spec/06-security-privacy.md
// T-07): terminal escape sequences, control characters and the characters
// that reorder text are removed, so printed text cannot clear, recolor or
// disguise what is around it, and invisible characters are removed, so what
// is shown, and what Fill from solution copies, is what a reader sees. Line
// breaks and tabs stay, and so do the zero-width joiner and non-joiner, which
// Persian, Indic and emoji text need. React already renders the rest as text.

export type ConsoleText = {
  text: string;
  /** Something was removed, so `text` is not what the program printed. */
  removed: boolean;
};

const ESC = 0x1b;
const BEL = 0x07;
const KEPT = new Set([0x09, 0x0a, 0x0d]);

/**
 * C0 controls but tab, line feed and carriage return; DEL and C1; bidirectional
 * marks, embeddings, overrides and isolates; the soft hyphen, zero-width space,
 * word joiner, invisible operators, byte order mark, and line and paragraph
 * separators.
 */
function isControl(code: number): boolean {
  if (code < 0x20) return !KEPT.has(code);
  return (
    (code >= 0x7f && code <= 0x9f) ||
    code === 0x00ad ||
    code === 0x061c ||
    code === 0x200b ||
    code === 0x200e ||
    code === 0x200f ||
    (code >= 0x202a && code <= 0x202e) ||
    code === 0x2028 ||
    code === 0x2029 ||
    (code >= 0x2060 && code <= 0x2064) ||
    (code >= 0x2066 && code <= 0x2069) ||
    code === 0xfeff
  );
}

/** Where the escape sequence starting at `start` (an ESC) ends, exclusive. */
function escapeEnd(printed: string, start: number): number {
  const kind = printed.charCodeAt(start + 1);
  // CSI: ESC [, parameter bytes 0x30-0x3f, intermediate bytes 0x20-0x2f, one final byte 0x40-0x7e.
  if (kind === 0x5b) {
    let at = start + 2;
    while (at < printed.length && inRange(printed.charCodeAt(at), 0x30, 0x3f)) at += 1;
    while (at < printed.length && inRange(printed.charCodeAt(at), 0x20, 0x2f)) at += 1;
    return at < printed.length && inRange(printed.charCodeAt(at), 0x40, 0x7e) ? at + 1 : at;
  }
  // OSC: ESC ], ended by BEL or by ESC \.
  if (kind === 0x5d) {
    let at = start + 2;
    while (at < printed.length) {
      const code = printed.charCodeAt(at);
      if (code === BEL) return at + 1;
      if (code === ESC) return printed.charCodeAt(at + 1) === 0x5c ? at + 2 : at;
      at += 1;
    }
    return at;
  }
  // Any other escape: ESC and the character after it.
  return Math.min(start + 2, printed.length);
}

const inRange = (code: number, low: number, high: number) => code >= low && code <= high;

export function consoleText(printed: string): ConsoleText {
  let text = "";
  let at = 0;
  while (at < printed.length) {
    const code = printed.charCodeAt(at);
    if (code === ESC) {
      at = escapeEnd(printed, at);
    } else {
      if (!isControl(code)) text += printed[at] ?? "";
      at += 1;
    }
  }
  return { text, removed: text !== printed };
}
