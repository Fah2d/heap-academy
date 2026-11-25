// @vitest-environment jsdom
import { act, cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { renderMarkdown } from "@/content/markdown";
import { MALICIOUS } from "@/content/markdown/malicious-fixtures";
import { lessonContent as words } from "@/messages/lesson";
import { COPIED_MS, CopyCodeButton } from "./copy-code-button";
import { LessonContent } from "./lesson-content";

vi.mock("server-only", () => ({}));

afterEach(cleanup);

const show = (markdown: string) =>
  render(<LessonContent document={renderMarkdown(markdown)} />).container;

describe("LessonContent [NFR-SEC-07]", () => {
  it("renders each allowed construct as its element", () => {
    const container = show(
      [
        "## Ask",
        "### Then answer",
        "Some *emphasis*, **strong** and `code`.",
        "- one\n- two",
        "3. three\n4. four",
        "> quoted",
        "| a | b | c |\n|:--|:-:|--:|\n| 1 | 2 | 3 |",
        "[docs](https://docs.python.org/3/)",
      ].join("\n\n"),
    );
    expect(screen.getByRole("heading", { level: 2, name: "Ask" })).toBeTruthy();
    expect(screen.getByRole("heading", { level: 3, name: "Then answer" })).toBeTruthy();
    expect(container.querySelector("em")?.textContent).toBe("emphasis");
    expect(container.querySelector("strong")?.textContent).toBe("strong");
    expect(container.querySelector("p code")?.textContent).toBe("code");
    expect(container.querySelectorAll("ul > li")).toHaveLength(2);
    expect(container.querySelector("ol")?.getAttribute("start")).toBe("3");
    expect(container.querySelector("blockquote")?.textContent).toBe("quoted");
    const cells = [...container.querySelectorAll("td")].map((cell) => cell.className);
    expect(cells[0]).toContain("text-start");
    expect(cells[1]).toContain("text-center");
    expect(cells[2]).toContain("text-end");
    expect(screen.getAllByRole("columnheader")).toHaveLength(3);
  });

  it("[T-06] opens every link in a new tab with no opener and no referrer, and says so", () => {
    show("[docs](https://docs.python.org/3/)");
    const link = screen.getByRole("link");
    expect(link.textContent).toBe(`docs ${words.opensInNewTab}`);
    expect(link.getAttribute("href")).toBe("https://docs.python.org/3/");
    expect(link.getAttribute("target")).toBe("_blank");
    expect(link.getAttribute("rel")).toBe("noopener noreferrer");
  });

  it("highlights a Python block by class and keeps the code exact", () => {
    const code = 'name = input("Name? ")\nprint(f"Hello, {name}")  # greet';
    const container = show("```python\n" + code + "\n```");
    const block = screen.getByRole("group", { name: words.codeBlock("Python") });
    expect(block.querySelector("pre code")?.textContent).toBe(code);
    expect(container.querySelector(".syntax-builtin")?.textContent).toBe("input");
    expect(container.querySelector(".syntax-string")?.textContent).toBe('"Name? "');
    expect(container.querySelector(".syntax-comment")?.textContent).toBe("# greet");
  });

  it("names a Python block by the language's name, however its fence spells it", () => {
    show("```py\nx = 1\n```");
    expect(screen.getByRole("group", { name: words.codeBlock("Python") })).toBeTruthy();
  });

  it("[NFR-A11Y-03] names the scrolling box of a table it lets the keyboard reach", () => {
    show("| a | b |\n|---|---|\n| 1 | 2 |");
    const region = screen.getByRole("region", { name: words.table });
    expect(region.getAttribute("tabindex")).toBe("0");
    expect(region.querySelector("table")).toBeTruthy();
  });

  it("starts its headings at a lower level inside another page's section, looking the same", () => {
    render(
      <LessonContent document={renderMarkdown("## Ask\n\n### Then answer")} topHeadingLevel={4} />,
    );
    const top = screen.getByRole("heading", { level: 4, name: "Ask" });
    const next = screen.getByRole("heading", { level: 5, name: "Then answer" });
    expect(top.className).toContain("text-lg");
    expect(next.className).toContain("text-base");
    expect(screen.queryByRole("heading", { level: 2 })).toBeNull();
  });

  it("names a block with no language as code, unhighlighted", () => {
    const container = show("```\n<b>not bold</b>\n```");
    expect(screen.getByRole("group", { name: words.codeBlock(undefined) })).toBeTruthy();
    expect(container.querySelector("pre code")?.textContent).toBe("<b>not bold</b>");
    expect(container.querySelector("pre b")).toBeNull();
    expect(container.querySelector("[class^='syntax-']")).toBeNull();
  });

  it.each(MALICIOUS)("[T-06] renders %s inert", (_name, markdown) => {
    const container = show(markdown);
    const allowed = new Set([
      "DIV",
      "P",
      "H2",
      "H3",
      "EM",
      "STRONG",
      "CODE",
      "PRE",
      "SPAN",
      "A",
      "UL",
      "OL",
      "LI",
      "BLOCKQUOTE",
      "TABLE",
      "THEAD",
      "TBODY",
      "TR",
      "TH",
      "TD",
      "BUTTON",
      "svg",
      "path",
    ]);
    for (const element of container.querySelectorAll("*")) {
      expect(allowed, element.tagName).toContain(element.tagName);
      for (const attribute of element.attributes) {
        expect(attribute.name.startsWith("on"), attribute.name).toBe(false);
        expect(attribute.name).not.toBe("style");
      }
    }
    for (const link of container.querySelectorAll("a")) {
      expect(link.getAttribute("href")).toMatch(/^https:\/\//);
      expect(link.getAttribute("rel")).toBe("noopener noreferrer");
    }
  });
});

describe("CopyCodeButton", () => {
  it("copies the block's code exactly and says so, then reads Copy code again", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const writeText = vi.fn(() => Promise.resolve());
    render(<CopyCodeButton code={'print("hi")\n'} writeText={writeText} />);
    await userEvent.click(screen.getByRole("button", { name: words.copyCode }));
    expect(writeText).toHaveBeenCalledWith('print("hi")\n');
    expect(await screen.findByRole("button", { name: words.copied })).toBeTruthy();
    await act(() => vi.advanceTimersByTimeAsync(COPIED_MS));
    expect(screen.getByRole("button", { name: words.copyCode })).toBeTruthy();
    vi.useRealTimers();
  });

  it("says the copy failed when the browser has no clipboard at all", async () => {
    const writeText = vi.fn(() => {
      throw new TypeError("navigator.clipboard is undefined");
    });
    render(<CopyCodeButton code="x" writeText={writeText} />);
    await userEvent.click(screen.getByRole("button", { name: words.copyCode }));
    expect((await screen.findByRole("status")).textContent).toBe(words.copyFailed);
  });

  it("says when the browser refuses the copy", async () => {
    const writeText = vi.fn(() => Promise.reject(new Error("denied")));
    render(<CopyCodeButton code="x" writeText={writeText} />);
    await userEvent.click(screen.getByRole("button", { name: words.copyCode }));
    expect((await screen.findByRole("status")).textContent).toBe(words.copyFailed);
  });
});
