import { describe, expect, it } from "vitest";
import { consoleText, lineCount } from "./console-text";

// The console shows a program's output as text a terminal cannot act on (T-07).

const ESC = "\u001b";

describe("consoleText [T-07]", () => {
  it("keeps ordinary text, line breaks and tabs", () => {
    expect(consoleText("Hello, Ada\n\tindented\n")).toBe("Hello, Ada\n\tindented\n");
  });

  it("keeps markup as plain characters, for React to render as text", () => {
    const payload = '<img src=x onerror="alert(1)"><script>alert(2)</script>';
    expect(consoleText(payload)).toBe(payload);
  });

  it("drops colour and cursor sequences", () => {
    expect(consoleText(`${ESC}[31mred${ESC}[0m plain`)).toBe("red plain");
    expect(consoleText(`a${ESC}[2J${ESC}[1;1Hb`)).toBe("ab");
    expect(consoleText(`x${ESC}[?25ly`)).toBe("xy");
  });

  it("drops a window title, ended by BEL or by ESC backslash, or left open", () => {
    expect(consoleText(`${ESC}]0;Fake title\u0007after`)).toBe("after");
    expect(consoleText(`${ESC}]2;title${ESC}\\after`)).toBe("after");
    expect(consoleText(`before${ESC}]0;never ends`)).toBe("before");
    expect(consoleText(`a${ESC}]0;t${ESC}[31mb`)).toBe("ab");
  });

  it("drops other escape pairs, a lone escape, and the 8-bit sequence introducer", () => {
    expect(consoleText(`a${ESC}Mb`)).toBe("ab");
    expect(consoleText(`a${ESC}`)).toBe("a");
    expect(consoleText(`a${ESC}zb`)).toBe("azb");
    expect(consoleText("a\u009b31mb")).toBe("ab");
  });

  it("ends a control sequence at a byte that cannot belong to it", () => {
    expect(consoleText(`a${ESC}[12\nb`)).toBe("a\nb");
    expect(consoleText(`a${ESC}[12`)).toBe("a");
  });

  it("turns a Windows line end into a break and drops any other carriage return", () => {
    expect(consoleText("one\r\ntwo\r\n")).toBe("one\ntwo\n");
    expect(consoleText("10%\r50%\r100%\n")).toBe("10%50%100%\n");
  });

  it("drops the other control characters, DEL and the C1 range", () => {
    expect(consoleText("a\u0000b\u0007c\u0008d\u000be\u000cf\u007fg\u0085h")).toBe("abcdefgh");
  });

  it("keeps text outside the Basic Multilingual Plane whole", () => {
    expect(consoleText("snake 🐍\n")).toBe("snake 🐍\n");
  });
});

describe("lineCount", () => {
  it("counts lines, with a last line that has no break", () => {
    expect(lineCount("")).toBe(0);
    expect(lineCount("one")).toBe(1);
    expect(lineCount("one\n")).toBe(1);
    expect(lineCount("one\ntwo")).toBe(2);
    expect(lineCount("\n\n")).toBe(2);
  });
});
