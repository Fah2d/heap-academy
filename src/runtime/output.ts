import { OUTPUT_LIMIT, type OutputStream } from "./protocol.ts";

// Output batching and the output cap (FR-RUN-03, architecture section 5.2).
// Python writes from inside a running program, when the worker's event loop
// cannot run a timer, so a batch is sent from a write once the interval has
// passed, and the rest when the run ends.

export const OUTPUT_INTERVAL_MS = 50;

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
};

/** The first `count` characters of `text`, never splitting a surrogate pair. */
function head(text: string, count: number): string {
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
function characterCount(text: string): number {
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
}: OutputOptions): OutputCollector {
  let pending: OutputChunk[] = [];
  let written = 0;
  let truncated = false;
  let lastSent = now();

  function flush(): void {
    for (const chunk of pending) send(chunk);
    pending = [];
    lastSent = now();
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
      if (now() - lastSent >= intervalMs) flush();
      return true;
    },
    flush,
    get truncated() {
      return truncated;
    },
  };
}
