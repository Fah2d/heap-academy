// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { invitation as words } from "@/messages/sign-in";
import { SaveProgressInvitation } from "./save-progress-invitation";

// The invitation to save progress (FR-AUTH-07; 03-experience.md section 6.6):
// inline, dismissible, and once hidden it stays hidden for the session.

const place = vi.hoisted(() => ({ pathname: "/learn/python-basics/hello", query: "" }));
vi.mock("next/navigation", () => ({
  usePathname: () => place.pathname,
  useSearchParams: () => new URLSearchParams(place.query),
}));

const KEY = "heap-academy.invitation-hidden";

/** The card inside a host that can take focus, as the workspace places it. */
function show() {
  return render(
    <div>
      <button type="button">Before</button>
      <div tabIndex={-1} data-testid="host">
        <SaveProgressInvitation />
      </div>
    </div>,
  );
}

beforeEach(() => {
  window.sessionStorage.clear();
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("SaveProgressInvitation", () => {
  it("[FR-PRG-01] says progress is on this device only, and offers sign-in back to this lesson", () => {
    show();
    const card = screen.getByRole("region", { name: words.label });
    expect(card.textContent).toContain(words.body);
    const link = screen.getByRole("link", { name: words.signIn });
    expect(link.getAttribute("href")).toBe(
      `/sign-in?${new URLSearchParams({ returnTo: "/learn/python-basics/hello" }).toString()}`,
    );
    expect(screen.getByRole("button", { name: words.dismiss })).toBeTruthy();
  });

  it("[FR-AUTH-07] hides when dismissed, moves focus to its host, and stays hidden this session", async () => {
    show();
    await userEvent.click(screen.getByRole("button", { name: words.dismiss }));
    expect(screen.queryByRole("region", { name: words.label })).toBeNull();
    expect(document.activeElement).toBe(screen.getByTestId("host"));
    expect(window.sessionStorage.getItem(KEY)).toBe("1");
    cleanup();
    show();
    expect(screen.queryByRole("region", { name: words.label })).toBeNull();
  });

  it("[FR-AUTH-07] still hides for this page when the browser refuses session storage", async () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("SecurityError");
    });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("SecurityError");
    });
    show();
    expect(screen.getByRole("region", { name: words.label })).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: words.dismiss }));
    expect(screen.queryByRole("region", { name: words.label })).toBeNull();
  });
});
