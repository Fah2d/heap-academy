// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { workspace as words } from "@/messages/workspace";
import { useState } from "react";
import { Hints } from "./hints";
import { LessonNav } from "./lesson-nav";
import { PythonStatus } from "./python-status";

afterEach(() => {
  cleanup();
});

/** The workspace keeps the count; this holds it as the workspace does. */
function CountedHints({ hints }: { hints: readonly string[] }) {
  const [shown, setShown] = useState(0);
  return (
    <Hints
      hints={hints}
      shown={shown}
      onShow={() => {
        setShown((current) => current + 1);
      }}
    />
  );
}

describe("[FR-WSP-17] Python's status", () => {
  it("shows real download progress while Python starts", () => {
    render(
      <PythonStatus
        runtime={{ name: "loading", pending: null }}
        progress={{ loadedBytes: 2_700_000, totalBytes: 5_500_000 }}
        onRetry={() => undefined}
      />,
    );
    expect(screen.getByRole("progressbar", { name: words.starting })).toBeTruthy();
    expect(screen.getByText(words.progress(2_700_000, 5_500_000))).toBeTruthy();
  });

  it("offers Retry when Python failed to start, and says it", async () => {
    const onRetry = vi.fn();
    render(<PythonStatus runtime={{ name: "failed" }} progress={undefined} onRetry={onRetry} />);
    expect(screen.getByRole("status").textContent).toBe(words.failed);
    await userEvent.click(screen.getByRole("button", { name: words.retry }));
    expect(onRetry).toHaveBeenCalledOnce();
  });

  it("says it is restarting, and shows nothing once Python is ready", () => {
    const { rerender, container } = render(
      <PythonStatus
        runtime={{ name: "restarting", pending: null, reason: "stopped" }}
        progress={undefined}
        onRetry={() => undefined}
      />,
    );
    expect(screen.getByRole("status").textContent).toBe(words.restarting);
    rerender(
      <PythonStatus runtime={{ name: "ready" }} progress={undefined} onRetry={() => undefined} />,
    );
    expect(screen.getByRole("status").textContent).toBe("");
    expect(container.textContent).toBe("");
  });
});

describe("[FR-WSP-22] hints", () => {
  it("shows no hint control for a lesson without hints", () => {
    const { container } = render(<CountedHints hints={[]} />);
    expect(container.textContent).toBe("");
  });

  it("shows one hint at a time, on request, and moves focus to it", async () => {
    render(<CountedHints hints={["First hint", "Second hint"]} />);
    expect(screen.queryByText("First hint")).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: words.showHint }));
    expect(screen.getByText("First hint")).toBeTruthy();
    expect(screen.queryByText("Second hint")).toBeNull();
    expect(document.activeElement?.tagName).toBe("H3");
  });
});

describe("[FR-WSP-11] previous and next", () => {
  it("links across chapters, and shows an end of the course as a disabled link", () => {
    render(
      <LessonNav
        course="python-basics"
        neighbours={{ previous: null, next: { slug: "add", title: "Add two numbers" } }}
        passed={false}
      />,
    );
    const ended = screen.getByRole("link", { name: words.noPrevious });
    expect(ended.getAttribute("aria-disabled")).toBe("true");
    expect(ended.hasAttribute("href")).toBe(false);
    expect(
      screen
        .getByRole("link", { name: words.neighbour(words.next, "Add two numbers") })
        .getAttribute("href"),
    ).toBe("/learn/python-basics/add");
  });
});
