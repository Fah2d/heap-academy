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
          return {
            neq: (other: string, unwanted: string) => {
              seen.filters.push([table, `not ${other}`, unwanted]);
              return { select: () => Promise.resolve(answers.update) };
            },
          };
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
      completions: ok([
        {
          lesson_id: "6f1f6f4e-3b6a-4d0a-9a3e-2f5b1c9d8e70",
          xp: 10,
          completed_at: "2023-11-14T22:13:20+00:00",
        },
      ]),
    });
    expect(await supabaseProfileStore(db).read("u1")).toEqual({
      displayName: "Sam",
      timeZone: "UTC",
      completions: [
        {
          lessonId: "6f1f6f4e-3b6a-4d0a-9a3e-2f5b1c9d8e70",
          xp: 10,
          completedAt: 1_700_000_000_000,
        },
      ],
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

  it("changes only the time zone, only on the caller's row, only when it differs", async () => {
    const { db, seen } = fakeDb({ update: ok([{ user_id: "u1" }]) });
    expect(await supabaseProfileStore(db).setTimeZone("u1", "Europe/London")).toBe("changed");
    expect(seen.update).toEqual({ time_zone: "Europe/London" });
    expect(seen.filters).toEqual([
      ["profiles", "user_id", "u1"],
      ["profiles", "not time_zone", "Europe/London"],
    ]);
  });

  it.each([
    ["unavailable", failed],
    ["unchanged", ok([])],
  ])("answers %s", async (outcome, update) => {
    expect(await supabaseProfileStore(fakeDb({ update }).db).setTimeZone("u1", "UTC")).toBe(
      outcome,
    );
  });
});

describe("[FR-PRF-02] the profile store's display name", () => {
  it("writes only the caller's own row, and only when the name differs", async () => {
    const { db, seen } = fakeDb({ update: ok([{ user_id: "u1" }]) });
    expect(await supabaseProfileStore(db).setDisplayName("u1", "Alex")).toBe("changed");
    expect(seen.update).toEqual({ display_name: "Alex" });
    expect(seen.filters).toEqual([
      ["profiles", "user_id", "u1"],
      ["profiles", "not display_name", "Alex"],
    ]);
  });

  it.each([
    [ok([]), "unchanged"],
    [failed, "unavailable"],
  ])("answers %j as %s", async (update, outcome) => {
    const { db } = fakeDb({ update });
    expect(await supabaseProfileStore(db).setDisplayName("u1", "Alex")).toBe(outcome);
  });
});
