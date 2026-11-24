import { describe, expect, it } from "vitest";
import { createOutputCollector, OUTPUT_BURST, type OutputChunk } from "./output.ts";

function collector(limit = 10) {
  let time = 0;
  const sent: OutputChunk[] = [];
  const output = createOutputCollector({
    send: (chunk) => sent.push({ ...chunk }),
    now: () => time,
    limit,
  });
  return {
    output,
    sent,
    advance: (ms: number) => {
      time += ms;
    },
  };
}

describe("output collector", () => {
  it("[FR-RUN-01] sends a write at once, so a program that prints and then computes shows it", () => {
    const { output, sent, advance } = collector(1000);
    advance(5);
    output.write("stdout", "first\n");
    // The program now computes for 2 s and writes nothing.
    advance(2_000);
    expect(sent).toEqual([{ stream: "stdout", text: "first\n" }]);
  });

  it("[FR-RUN-01] sends a few quick lines each at once", () => {
    const { output, sent } = collector(1000);
    for (let index = 0; index < OUTPUT_BURST; index += 1) output.write("stdout", String(index));
    expect(sent).toHaveLength(OUTPUT_BURST);
  });

  it("[FR-RUN-03] past the burst, holds writes until the next 50 ms window, then sends them as one", () => {
    const { output, sent, advance } = collector(1000);
    for (let index = 0; index < OUTPUT_BURST; index += 1) output.write("stdout", "x");
    output.write("stdout", "a");
    output.write("stdout", "b");
    expect(sent).toHaveLength(OUTPUT_BURST);
    advance(49);
    output.write("stdout", "c");
    expect(sent).toHaveLength(OUTPUT_BURST);
    advance(1);
    output.write("stdout", "d");
    expect(sent.at(-1)).toEqual({ stream: "stdout", text: "abcd" });
  });

  it("[FR-RUN-03] keeps the order of the two streams", () => {
    const { output, sent } = collector(1000);
    output.write("stdout", "1");
    output.write("stderr", "2");
    output.write("stdout", "3");
    output.flush();
    expect(sent).toEqual([
      { stream: "stdout", text: "1" },
      { stream: "stderr", text: "2" },
      { stream: "stdout", text: "3" },
    ]);
  });

  it("[FR-RUN-03] stops at the cap, says so, and refuses what follows", () => {
    const { output, sent } = collector(10);
    expect(output.write("stdout", "123456")).toBe(true);
    expect(output.write("stdout", "7890abc")).toBe(false);
    expect(output.truncated).toBe(true);
    expect(output.write("stderr", "more")).toBe(false);
    output.flush();
    expect(sent.map((chunk) => chunk.text).join("")).toBe("1234567890");
  });

  it("[FR-RUN-03] counts a character outside the basic plane once and never splits it", () => {
    const { output, sent } = collector(3);
    output.write("stdout", "a😀b😀");
    output.flush();
    expect(sent).toEqual([{ stream: "stdout", text: "a😀b" }]);
  });

  it("[FR-RUN-03] a flood stays bounded: memory held is the cap, not the flood", () => {
    const { output, sent } = collector(64_000);
    for (let index = 0; index < 100_000; index += 1) output.write("stdout", "flood\n");
    output.flush();
    expect(sent.reduce((total, chunk) => total + chunk.text.length, 0)).toBe(64_000);
    // With no time passing, the flood is the burst and then one held batch.
    expect(sent.length).toBeLessThanOrEqual(OUTPUT_BURST + 1);
  });
});
