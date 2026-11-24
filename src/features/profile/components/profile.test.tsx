// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import userEvent from "@testing-library/user-event";
import { profile as words } from "@/messages/profile";
import { DisplayName } from "./display-name";
import { ProfilePage } from "./profile-page";
import { ProfileView } from "./profile-view";
import { TimeZoneReporter } from "./time-zone-reporter";

const mocks = vi.hoisted(() => ({
  refresh: vi.fn(),
  redirect: vi.fn((to: string) => {
    throw new Error(`redirect:${to}`);
  }),
  pageIdentity: vi.fn(),
  read: vi.fn(),
}));
vi.mock("server-only", () => ({}));
vi.mock("next/navigation", () => ({
  redirect: mocks.redirect,
  useRouter: () => ({ refresh: mocks.refresh }),
}));
vi.mock("@/infrastructure/auth/page-identity", () => ({ pageIdentity: mocks.pageIdentity }));
vi.mock("@/infrastructure/db/session-client", () => ({ createSessionClient: async () => ({}) }));
vi.mock("@/infrastructure/db/profile-store", () => ({
  supabaseProfileStore: () => ({ read: mocks.read }),
}));
vi.mock("../server/actions", () => ({ updateProfile: vi.fn() }));

beforeEach(() => vi.clearAllMocks());
afterEach(cleanup);

const summary = {
  displayName: "Sam",
  timeZone: "UTC",
  xp: 35,
  lessons: 2,
  currentStreak: 1,
  longestStreak: 4,
};

describe("[FR-PRF-01] the profile", () => {
  it("shows the name, XP, and both streaks", () => {
    render(<ProfileView summary={summary} updateProfile={vi.fn()} />);
    expect(screen.getByRole("heading", { level: 1, name: words.heading })).toBeTruthy();
    for (const text of ["Sam", "35 XP", "1 day", "4 days"]) {
      expect(screen.getByText(text)).toBeTruthy();
    }
    expect(screen.queryByText(words.empty)).toBeNull();
  });

  it("says what to do on a new account", () => {
    render(<ProfileView summary={{ ...summary, xp: 0, lessons: 0 }} updateProfile={vi.fn()} />);
    expect(screen.getByText(words.empty)).toBeTruthy();
    expect(screen.getByRole("link", { name: words.coursesLink }).getAttribute("href")).toBe(
      "/courses",
    );
  });

  it("sends a visitor to sign in and back, reading nothing", async () => {
    mocks.pageIdentity.mockResolvedValue(null);
    await expect(ProfilePage()).rejects.toThrow("redirect:/sign-in?returnTo=%2Fprofile");
    expect(mocks.read).not.toHaveBeenCalled();
  });

  it("fails to the error page when the profile cannot be read", async () => {
    mocks.pageIdentity.mockResolvedValue({ userId: "u1" });
    mocks.read.mockResolvedValue(null);
    await expect(ProfilePage()).rejects.toThrow("profile: could not be read");
    expect(mocks.read).toHaveBeenCalledWith("u1");
  });
});

describe("[FR-PRF-02] the browser's time zone", () => {
  const zone = new Intl.DateTimeFormat().resolvedOptions().timeZone;

  it("is sent when it differs, and the page is rendered again", async () => {
    const update = vi.fn(async () => ({ ok: true as const, value: { changed: true } }));
    render(<TimeZoneReporter stored="Nowhere/Never" updateProfile={update} />);
    expect(update).toHaveBeenCalledWith({ timeZone: zone });
    await waitFor(() => expect(mocks.refresh).toHaveBeenCalledOnce());
  });

  it("is not sent when it is the stored one", () => {
    const update = vi.fn(async () => ({ ok: true as const, value: { changed: true } }));
    render(<TimeZoneReporter stored={zone} updateProfile={update} />);
    expect(update).not.toHaveBeenCalled();
  });

  it.each([
    ["is refused", async () => ({ ok: false as const })],
    ["finds the same zone", async () => ({ ok: true as const, value: { changed: false } })],
    ["fails", async () => Promise.reject(new Error("offline"))],
  ])("changes nothing on screen when the change %s", async (_name, answer) => {
    const update = vi.fn(answer);
    render(<TimeZoneReporter stored="Nowhere/Never" updateProfile={update} />);
    await Promise.resolve();
    await Promise.resolve();
    expect(mocks.refresh).not.toHaveBeenCalled();
  });

  it("is sent once, though a new render passes a new action", () => {
    const answer = async () => ({ ok: true as const, value: { changed: false } });
    const first = vi.fn(answer);
    const second = vi.fn(answer);
    const view = render(<TimeZoneReporter stored="Asia/Calcutta" updateProfile={first} />);
    view.rerender(<TimeZoneReporter stored="Asia/Calcutta" updateProfile={second} />);
    expect(first).toHaveBeenCalledOnce();
    expect(second).not.toHaveBeenCalled();
  });
});

describe("[FR-PRF-02] changing the display name", () => {
  async function edit(
    text: string,
    answer: () => Promise<{ ok: true } | { ok: false; error: string }>,
  ) {
    const user = userEvent.setup();
    const update = vi.fn(answer);
    render(<DisplayName name="Sam" updateProfile={update} />);
    await user.click(screen.getByRole("button", { name: words.changeName }));
    const field = screen.getByRole("textbox", { name: words.nameLabel });
    await user.clear(field);
    if (text !== "") await user.type(field, text);
    await user.click(screen.getByRole("button", { name: words.saveName }));
    return update;
  }

  it("sends the trimmed name, closes, and returns focus", async () => {
    const update = await edit("  Alex  ", async () => ({ ok: true }));
    expect(update).toHaveBeenCalledWith({ displayName: "Alex" });
    await waitFor(() => expect(mocks.refresh).toHaveBeenCalledOnce());
    const open = await screen.findByRole("button", { name: words.changeName });
    expect(document.activeElement).toBe(open);
    expect(screen.getByText("Alex")).toBeTruthy();
  });

  it("says why an empty name is wrong and sends nothing", async () => {
    const update = await edit("", async () => ({ ok: true }));
    expect(screen.getByText(words.nameProblem.empty)).toBeTruthy();
    expect(update).not.toHaveBeenCalled();
  });

  it.each([
    ["is refused", async () => ({ ok: false as const, error: "unavailable" }), words.saveFailed],
    ["cannot be sent", async () => Promise.reject(new Error("offline")), words.saveFailed],
    [
      "has no sign-in",
      async () => ({ ok: false as const, error: "not_signed_in" }),
      words.signedOut,
    ],
  ])("keeps the form and says so when the change %s", async (_name, answer, sentence) => {
    await edit("Alex", answer);
    expect(await screen.findByText(sentence)).toBeTruthy();
    expect(screen.getByRole("textbox", { name: words.nameLabel })).toHaveProperty("value", "Alex");
    expect(mocks.refresh).not.toHaveBeenCalled();
  });

  it("keeps the stored name on Cancel", async () => {
    const user = userEvent.setup();
    const update = vi.fn();
    render(<DisplayName name="Sam" updateProfile={update} />);
    await user.click(screen.getByRole("button", { name: words.changeName }));
    await user.click(screen.getByRole("button", { name: words.cancel }));
    expect(screen.getByText("Sam")).toBeTruthy();
    expect(update).not.toHaveBeenCalled();
  });
});

describe("[T-07] a display name holding markup", () => {
  const payload = '<img src=x onerror="alert(1)">';

  it("is shown and edited as text, never as markup", async () => {
    const user = userEvent.setup();
    const { container } = render(
      <ProfileView summary={{ ...summary, displayName: payload }} updateProfile={vi.fn()} />,
    );
    expect(screen.getByText(payload)).toBeTruthy();
    expect(container.querySelector("img, script")).toBeNull();
    await user.click(screen.getByRole("button", { name: words.changeName }));
    expect(screen.getByRole("textbox", { name: words.nameLabel })).toHaveProperty("value", payload);
    expect(container.querySelector("img, script")).toBeNull();
  });
});
