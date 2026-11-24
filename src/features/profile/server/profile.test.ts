import { describe, expect, it, vi } from "vitest";
import type { ProfileStore } from "@/infrastructure/db/profile-store";
import { profileSummary, updateProfile, updateProfileInput } from "./profile";

vi.mock("server-only", () => ({}));

const at = (text: string) => Date.parse(text);

function store(overrides: Partial<ProfileStore>): ProfileStore {
  const changed = async () => "changed" as const;
  return { read: async () => null, setTimeZone: changed, setDisplayName: changed, ...overrides };
}

const record = (timeZone: string, times: string[]) =>
  store({
    read: async () => ({
      displayName: "Sam",
      timeZone,
      completions: times.map((time) => ({ xp: 10, completedAt: at(time) })),
    }),
  });

describe("[FR-PRF-01] [FR-PRG-04] [FR-PRG-05] the profile summary", () => {
  const times = ["2026-03-01T22:30:00Z", "2026-03-02T22:30:00Z"];
  const now = at("2026-03-03T12:00:00Z");

  it("sums XP and counts the streak in the stored zone", async () => {
    expect(await profileSummary("u1", record("UTC", times), now)).toEqual({
      displayName: "Sam",
      timeZone: "UTC",
      xp: 20,
      lessons: 2,
      currentStreak: 2,
      longestStreak: 2,
    });
  });

  it("uses the learner's days, not the server's", async () => {
    // In Riyadh both passes fall a day later: 2 and 3 March, and 3 March is today.
    const later = at("2026-03-04T12:00:00Z");
    expect((await profileSummary("u1", record("UTC", times), later))?.currentStreak).toBe(0);
    expect((await profileSummary("u1", record("Asia/Riyadh", times), later))?.currentStreak).toBe(
      2,
    );
  });

  it("counts in UTC when the stored zone is not one", async () => {
    expect((await profileSummary("u1", record("Nowhere/Never", times), now))?.currentStreak).toBe(
      2,
    );
  });

  it("is all zeros for a new account", async () => {
    expect(await profileSummary("u1", record("UTC", []), now)).toMatchObject({
      xp: 0,
      lessons: 0,
      currentStreak: 0,
      longestStreak: 0,
    });
  });

  it("is null when the profile cannot be read", async () => {
    expect(await profileSummary("u1", store({}), now)).toBeNull();
  });
});

describe("[FR-PRF-02] the time zone change", () => {
  it("takes a named zone", () => {
    expect(updateProfileInput.parse({ timeZone: "europe/london" })).toEqual({
      timeZone: "Europe/London",
    });
  });

  it.each(["+03:00", "Nowhere/Never", "", "x".repeat(65)])("refuses %j", (timeZone) => {
    expect(updateProfileInput.safeParse({ timeZone }).success).toBe(false);
  });

  it("refuses any other field", () => {
    expect(updateProfileInput.safeParse({ timeZone: "UTC", userId: "u2" }).success).toBe(false);
  });

  it("stores it for the caller, and says when it could not", async () => {
    const setTimeZone = vi.fn(async () => "changed" as const);
    const input = updateProfileInput.parse({ timeZone: "UTC" });
    expect(await updateProfile("u1", input, store({ setTimeZone }))).toEqual({
      ok: true,
      value: { changed: true },
    });
    expect(setTimeZone).toHaveBeenCalledWith("u1", "UTC");
    expect(
      await updateProfile("u1", input, store({ setTimeZone: async () => "unavailable" })),
    ).toEqual({ ok: false, error: "unavailable" });
    expect(
      await updateProfile("u1", input, store({ setTimeZone: async () => "unchanged" })),
    ).toEqual({ ok: true, value: { changed: false } });
  });
});

describe("[FR-PRF-02] the display name change", () => {
  it("takes a name, trimmed", () => {
    expect(updateProfileInput.parse({ displayName: " Sam " })).toEqual({ displayName: "Sam" });
  });

  it.each(["", "x".repeat(41), "a\nb"])("refuses %j", (displayName) => {
    expect(updateProfileInput.safeParse({ displayName }).success).toBe(false);
  });

  it("refuses an empty change", () => {
    expect(updateProfileInput.safeParse({}).success).toBe(false);
  });

  it("stores only the name, and says when it could not", async () => {
    const setDisplayName = vi.fn(async () => "changed" as const);
    const setTimeZone = vi.fn(async () => "changed" as const);
    const input = updateProfileInput.parse({ displayName: "Sam" });
    expect(await updateProfile("u1", input, store({ setDisplayName, setTimeZone }))).toEqual({
      ok: true,
      value: { changed: true },
    });
    expect(setDisplayName).toHaveBeenCalledWith("u1", "Sam");
    expect(setTimeZone).not.toHaveBeenCalled();
    expect(
      await updateProfile("u1", input, store({ setDisplayName: async () => "unavailable" })),
    ).toEqual({ ok: false, error: "unavailable" });
  });
});
