import { describe, expect, it, vi } from "vitest";
import { supabaseProfileStore } from "./profile-store";

vi.mock("server-only", () => ({}));

type Answer = { data: unknown; error: { code: string } | null };

function fakeDb(answers: { profile?: Answer; completions?: Answer; update?: Answer }) {
  const seen: { filters: [string, string, string][]; update?: unknown } = { filters: [] };
  const db = {
    from: (table: string) => ({
      select: () => ({
        eq: (column: string, value: string) => {
          seen.filters.push([table, column, value]);
          if (table === "completions") return Promise.resolve(answers.completions);
          return { maybeSingle: () => Promise.resolve(answers.profile) };
        },
      }),
      update: (values: unknown) => ({
        eq: (column: string, value: string) => {
          seen.update = values;
          seen.filters.push([table, column, value]);
          return { select: () => Promise.resolve(answers.update) };
        },
      }),
    }),
  };
  return { db: db as never, seen };
}

const ok = (data: unknown): Answer => ({ data, error: null });
const failed: Answer = { data: null, error: { code: "08006" } };
const profile = ok({ display_name: "Sam", time_zone: "UTC" });

describe("[FR-PRF-01] the profile store", () => {
  it("reads the caller's own rows", async () => {
    const { db, seen } = fakeDb({
      profile,
      completions: ok([{ xp: 10, completed_at: "2023-11-14T22:13:20+00:00" }]),
    });
    expect(await supabaseProfileStore(db).read("u1")).toEqual({
      displayName: "Sam",
      timeZone: "UTC",
      completions: [{ xp: 10, completedAt: 1_700_000_000_000 }],
    });
    expect(seen.filters).toEqual([
      ["profiles", "user_id", "u1"],
      ["completions", "user_id", "u1"],
    ]);
  });

  it.each([
    ["the profile read fails", { profile: failed, completions: ok([]) }],
    ["there is no profile row", { profile: ok(null), completions: ok([]) }],
    ["the completions read fails", { profile, completions: failed }],
    ["a row is malformed", { profile, completions: ok([{ xp: "10", completed_at: "x" }]) }],
  ])("answers null when %s", async (_name, answers) => {
    expect(await supabaseProfileStore(fakeDb(answers).db).read("u1")).toBeNull();
  });

  it("changes only the time zone, only on the caller's row", async () => {
    const { db, seen } = fakeDb({ update: ok([{ user_id: "u1" }]) });
    expect(await supabaseProfileStore(db).setTimeZone("u1", "Europe/London")).toBe(true);
    expect(seen.update).toEqual({ time_zone: "Europe/London" });
    expect(seen.filters).toEqual([["profiles", "user_id", "u1"]]);
  });

  it.each([
    ["the database fails", failed],
    ["no row changed", ok([])],
  ])("reports a change that did not happen when %s", async (_name, update) => {
    expect(await supabaseProfileStore(fakeDb({ update }).db).setTimeZone("u1", "UTC")).toBe(false);
  });
});
