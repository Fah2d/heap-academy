import { describe, expect, it } from "vitest";
import { forAll, textFrom } from "../../scripts/testing/property.ts";
import { consoleText } from "./console-text.ts";

const ESC = "\u001b";

describe("consoleText", () => {
  it("[T-07] removes terminal escape sequences", () => {
    expect(consoleText(`${ESC}[2J${ESC}[31mred${ESC}[0m`)).toEqual({ text: "red", removed: true });
    expect(consoleText(`${ESC}]0;title\u0007after`)).toEqual({ text: "after", removed: true });
    expect(consoleText(`${ESC}]8;;https://x.test${ESC}\\link`)).toEqual({
      text: "link",
      removed: true,
    });
    expect(consoleText(`a${ESC}Mb`)).toEqual({ text: "ab", removed: true });
  });

  it("[T-07] removes control characters and the characters that reorder text", () => {
    expect(consoleText("a\u0000b\u0007c\u007fd\u0085e")).toEqual({ text: "abcde", removed: true });
    expect(consoleText("abc‮exe.txt⁦⁩‏؜")).toEqual({
      text: "abcexe.txt",
      removed: true,
    });
  });

  it("[T-07] keeps line breaks, tabs and ordinary text, markup included", () => {
    const text = "Hello, Ada!\n\tindented\r\n<img src=x onerror=alert(1)> é 😀";
    expect(consoleText(text)).toEqual({ text, removed: false });
    expect(consoleText("")).toEqual({ text: "", removed: false });
  });

  it("[T-07] leaves nothing to remove a second time", () => {
    const anyText = textFrom(["a", "\n", "\t", ESC, "[", "2", "J", "]", "\u0007", "‮", "é"]);
    forAll(anyText, (text) => {
      const once = consoleText(text);
      const twice = consoleText(once.text);
      return !twice.removed && twice.text === once.text && once.removed === (once.text !== text);
    });
  });
});
