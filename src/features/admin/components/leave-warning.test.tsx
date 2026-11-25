// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useLeaveWarning } from "./leave-warning";

// Leaving an editor with unsaved changes asks first (FR-ADM-10): closing or
// reloading the tab, a link inside the page, and Back.

afterEach(cleanup);

function Editor({ unsaved, confirm }: { unsaved: boolean; confirm: (text: string) => boolean }) {
  const { release } = useLeaveWarning(unsaved, "Leave?", confirm);
  return (
    <div>
      <button type="button" onClick={release}>
        Release
      </button>
      <a href="/admin">All courses</a>
      <a href="#details">Details</a>
      <a href="/admin" target="_blank">
        Elsewhere
      </a>
    </div>
  );
}

function clickLink(name: string) {
  const link = [...document.querySelectorAll("a")].find((a) => a.textContent === name);
  if (link === undefined) throw new Error(`no link ${name}`);
  const event = new MouseEvent("click", { bubbles: true, cancelable: true, button: 0 });
  link.dispatchEvent(event);
  return event.defaultPrevented;
}

function unload() {
  const event = new Event("beforeunload", { cancelable: true });
  window.dispatchEvent(event);
  return event.defaultPrevented;
}

beforeEach(() => {
  window.history.replaceState({ router: "state" }, "", "/admin/courses/1");
});

describe("useLeaveWarning [FR-ADM-10]", () => {
  it("asks nothing while there is nothing unsaved", () => {
    const confirm = vi.fn(() => false);
    render(<Editor unsaved={false} confirm={confirm} />);
    expect(clickLink("All courses")).toBe(false);
    expect(unload()).toBe(false);
    expect(confirm).not.toHaveBeenCalled();
  });

  it("holds a link back when the owner chooses to stay, and lets it go when they leave", () => {
    const confirm = vi.fn(() => false);
    const { rerender } = render(<Editor unsaved confirm={confirm} />);
    expect(clickLink("All courses")).toBe(true);
    expect(confirm).toHaveBeenCalledWith("Leave?");
    const leave = vi.fn(() => true);
    rerender(<Editor unsaved confirm={leave} />);
    // jsdom does not navigate; the click is simply not held back.
    expect(clickLink("All courses")).toBe(false);
  });

  it("does not ask for a link to a place on the page or one that opens a new tab", () => {
    const confirm = vi.fn(() => false);
    render(<Editor unsaved confirm={confirm} />);
    expect(clickLink("Details")).toBe(false);
    expect(clickLink("Elsewhere")).toBe(false);
    expect(confirm).not.toHaveBeenCalled();
  });

  it("asks the browser to confirm closing or reloading the tab", () => {
    render(<Editor unsaved confirm={() => false} />);
    expect(unload()).toBe(true);
  });

  it("adds a guard entry to the history that keeps the router's state", () => {
    const before = window.history.length;
    render(<Editor unsaved confirm={() => false} />);
    expect(window.history.length).toBe(before + 1);
    expect(window.history.state).toMatchObject({ router: "state", "heap-unsaved-guard": true });
  });

  it("puts the guard entry back when Back is pressed and the owner stays", () => {
    const confirm = vi.fn(() => false);
    render(<Editor unsaved confirm={confirm} />);
    const pushed = vi.spyOn(window.history, "pushState");
    window.dispatchEvent(new PopStateEvent("popstate", { state: { router: "state" } }));
    expect(confirm).toHaveBeenCalledWith("Leave?");
    expect(pushed).toHaveBeenCalledTimes(1);
    pushed.mockRestore();
  });

  it("goes back for real when the owner chooses to leave on Back", () => {
    render(<Editor unsaved confirm={() => true} />);
    const back = vi.spyOn(window.history, "back").mockImplementation(() => undefined);
    window.dispatchEvent(new PopStateEvent("popstate", { state: { router: "state" } }));
    expect(back).toHaveBeenCalledTimes(1);
    back.mockRestore();
  });

  it("lets the page go with no question once released, for a create that opens the editor", () => {
    const confirm = vi.fn(() => false);
    render(<Editor unsaved confirm={confirm} />);
    screen.getByRole("button", { name: "Release" }).click();
    expect(unload()).toBe(false);
    expect(clickLink("All courses")).toBe(false);
    expect(confirm).not.toHaveBeenCalled();
  });

  it("takes the guard entry back out when the changes are saved", () => {
    const back = vi.spyOn(window.history, "back").mockImplementation(() => undefined);
    const { rerender } = render(<Editor unsaved confirm={() => false} />);
    rerender(<Editor unsaved={false} confirm={() => false} />);
    expect(back).toHaveBeenCalledTimes(1);
    expect(unload()).toBe(false);
    back.mockRestore();
  });
});
