import { OUTPUT_LIMIT, type OutputStream } from "./protocol.ts";

// Output batching and the output cap (FR-RUN-03, architecture section 5.2).
// Python writes from inside a running program, when the worker's event loop
// cannot run a timer, so every decision to send is made inside a write.
//
// A write is sent at once while fewer than OUTPUT_BURST sends have gone out
// in the current 50 ms window, so a program that prints a few lines and then
// computes shows them while it computes. Past that, as in a print flood,
// writes are held and sent together by the first write of the next window,
// or when the run ends. What a flood writes in its last window before a long
// silence therefore waits for the end of the run.

export const OUTPUT_INTERVAL_MS = 50;
/** Sends allowed in one window before writes are held. */
export const OUTPUT_BURST = 8;

export type OutputChunk = { stream: OutputStream; text: string };

export type OutputCollector = {
  /**
   * Adds text the program wrote. Returns false once the cap is reached: the
   * text past the cap is dropped, and the program should be stopped.
   */
  write: (stream: OutputStream, text: string) => boolean;
  /** Sends whatever is waiting. Called when the run ends. */
  flush: () => void;
  /** Whether any text was dropped because of the cap. */
  readonly truncated: boolean;
};

export type OutputOptions = {
  send: (chunk: OutputChunk) => void;
  now: () => number;
  limit?: number;
  intervalMs?: number;
  burst?: number;
};

/** The first `count` characters of `text`, never splitting a surrogate pair. */
export function head(text: string, count: number): string {
  let end = 0;
  let characters = 0;
  while (end < text.length && characters < count) {
    const code = text.charCodeAt(end);
    end += code >= 0xd800 && code <= 0xdbff && end + 1 < text.length ? 2 : 1;
    characters += 1;
  }
  return text.slice(0, end);
}

/** Characters as a reader counts them: a surrogate pair is one. */
export function characterCount(text: string): number {
  let count = 0;
  for (let index = 0; index < text.length; index += 1) {
    const code = text.charCodeAt(index);
    if (code >= 0xd800 && code <= 0xdbff && index + 1 < text.length) index += 1;
    count += 1;
  }
  return count;
}

export function createOutputCollector({
  send,
  now,
  limit = OUTPUT_LIMIT,
  intervalMs = OUTPUT_INTERVAL_MS,
  burst = OUTPUT_BURST,
}: OutputOptions): OutputCollector {
  let pending: OutputChunk[] = [];
  let written = 0;
  let truncated = false;
  let windowStart = Number.NEGATIVE_INFINITY;
  let sendsInWindow = 0;

  function flush(): void {
    for (const chunk of pending) send(chunk);
    pending = [];
  }

  /** Sends now if this window still allows it; otherwise the text waits. */
  function sendIfAllowed(): void {
    const time = now();
    if (time - windowStart >= intervalMs) {
      windowStart = time;
      sendsInWindow = 0;
    }
    if (sendsInWindow >= burst) return;
    sendsInWindow += 1;
    flush();
  }

  function append(stream: OutputStream, text: string): void {
    if (text === "") return;
    const last = pending[pending.length - 1];
    if (last !== undefined && last.stream === stream) last.text += text;
    else pending.push({ stream, text });
  }

  return {
    write(stream, text) {
      if (truncated) return false;
      const room = limit - written;
      const size = characterCount(text);
      if (size > room) {
        append(stream, head(text, room));
        written = limit;
        truncated = true;
        flush();
        return false;
      }
      append(stream, text);
      written += size;
      sendIfAllowed();
      return true;
    },
    flush,
    get truncated() {
      return truncated;
    },
  };
}
