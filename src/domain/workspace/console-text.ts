// What the console may show of a program's output (T-07): React renders it as
// text, and this removes what a terminal would act on. Escape sequences
// (colours, cursor moves, window titles) and control characters other than
// the line break and the tab are dropped, so a program cannot redraw the
// transcript or hide text in it. A carriage return before a line break is a
// Windows line end and becomes the break; any other carriage return is dropped.

const ESC = 0x1b;
const BEL = 0x07;
const TAB = 0x09;
const LINE_FEED = 0x0a;
const CARRIAGE_RETURN = 0x0d;
const CSI_8BIT = 0x9b;

function isControl(code: number): boolean {
  return code < 0x20 || (code >= 0x7f && code <= 0x9f);
}

/** Where a control sequence's parameters end: the final byte of `@` to `~`, included. */
function endOfControlSequence(text: string, from: number): number {
  let at = from;
  while (at < text.length) {
    const code = text.charCodeAt(at);
    at += 1;
    if (code >= 0x40 && code <= 0x7e) return at;
    if (code < 0x20 || code > 0x3f) return at - 1;
  }
  return at;
}

/** Where an operating system command ends: after BEL or ESC \, or at the end. */
function endOfOsc(text: string, from: number): number {
  let at = from;
  while (at < text.length) {
    const code = text.charCodeAt(at);
    if (code === BEL) return at + 1;
    if (code === ESC) return text.charCodeAt(at + 1) === 0x5c ? at + 2 : at;
    at += 1;
  }
  return at;
}

export function consoleText(text: string): string {
  let out = "";
  let at = 0;
  while (at < text.length) {
    const code = text.charCodeAt(at);
    if (code === ESC) {
      const next = text.charCodeAt(at + 1);
      if (next === 0x5b) at = endOfControlSequence(text, at + 2);
      else if (next === 0x5d) at = endOfOsc(text, at + 2);
      else at += next >= 0x40 && next <= 0x5f ? 2 : 1;
      continue;
    }
    if (code === CSI_8BIT) {
      at = endOfControlSequence(text, at + 1);
      continue;
    }
    if (code === CARRIAGE_RETURN) {
      if (text.charCodeAt(at + 1) !== LINE_FEED) at += 1;
      else {
        out += "\n";
        at += 2;
      }
      continue;
    }
    if (isControl(code) && code !== TAB && code !== LINE_FEED) {
      at += 1;
      continue;
    }
    out += text[at] ?? "";
    at += 1;
  }
  return out;
}

/** The number of lines a transcript shows: a last line without a break counts. */
export function lineCount(text: string): number {
  if (text === "") return 0;
  const breaks = text.split("\n").length - 1;
  return text.endsWith("\n") ? breaks : breaks + 1;
}
