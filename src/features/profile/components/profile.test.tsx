// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { profile as words } from "@/messages/profile";
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
vi.mock("../server/actions", () => ({ updateProfile: vi.fn(async () => ({ ok: true })) }));

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
    render(<ProfileView summary={summary} />);
    expect(screen.getByRole("heading", { level: 1, name: words.heading })).toBeTruthy();
    for (const text of ["Sam", "35 XP", "1 day", "4 days"]) {
      expect(screen.getByText(text)).toBeTruthy();
    }
    expect(screen.queryByText(words.empty)).toBeNull();
  });

  it("says what to do on a new account", () => {
    render(<ProfileView summary={{ ...summary, xp: 0, lessons: 0 }} />);
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
    const update = vi.fn(async () => ({ ok: true }));
    render(<TimeZoneReporter stored="Nowhere/Never" updateProfile={update} />);
    expect(update).toHaveBeenCalledWith({ timeZone: zone });
    await waitFor(() => expect(mocks.refresh).toHaveBeenCalledOnce());
  });

  it("is not sent when it is the stored one", () => {
    const update = vi.fn(async () => ({ ok: true }));
    render(<TimeZoneReporter stored={zone} updateProfile={update} />);
    expect(update).not.toHaveBeenCalled();
  });

  it.each([
    ["is refused", async () => ({ ok: false })],
    ["fails", async () => Promise.reject(new Error("offline"))],
  ])("changes nothing on screen when the change %s", async (_name, answer) => {
    const update = vi.fn(answer);
    render(<TimeZoneReporter stored="Nowhere/Never" updateProfile={update} />);
    await Promise.resolve();
    await Promise.resolve();
    expect(mocks.refresh).not.toHaveBeenCalled();
  });
});
