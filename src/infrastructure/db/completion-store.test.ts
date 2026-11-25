import { describe, expect, it, vi } from "vitest";
import { supabaseCompletionStore } from "./completion-store";

vi.mock("server-only", () => ({}));

const lesson = "00000000-0000-4000-8000-000000000001";

function fakeDb(answer: { error?: { code?: string }; data?: unknown[] }) {
  const seen: { upsert?: unknown; options?: unknown; eq?: [string, string]; columns?: string } = {};
  const db = {
    from: (table: string) => {
      expect(table).toBe("completions");
      return {
        upsert: async (rows: unknown, options: unknown) => {
          seen.upsert = rows;
          seen.options = options;
          return { error: answer.error ?? null };
        },
        select: (columns: string) => ({
          eq: async (column: string, value: string) => {
            seen.columns = columns;
            seen.eq = [column, value];
            return answer.error
              ? { data: null, error: answer.error }
              : { data: answer.data ?? [], error: null };
          },
        }),
      };
    },
  };
  return { db: db as never, seen };
}

describe("[FR-PRG-03] [T-08] [T-10] the completion store", () => {
  it("inserts with do-nothing-on-conflict and sets the caller as the owner", async () => {
    const { db, seen } = fakeDb({});
    const outcome = await supabaseCompletionStore(db).insert("u1", [
      { lessonId: lesson as never, completedAt: 1_700_000_000_000, code: "x" },
    ]);
    expect(outcome).toBe("stored");
    expect(seen.upsert).toEqual([
      { user_id: "u1", lesson_id: lesson, completed_at: "2023-11-14T22:13:20.000Z", code: "x" },
    ]);
    expect(seen.options).toEqual({ onConflict: "user_id,lesson_id", ignoreDuplicates: true });
  });

  it("sends nothing for an empty list", async () => {
    const { db, seen } = fakeDb({});
    expect(await supabaseCompletionStore(db).insert("u1", [])).toBe("stored");
    expect(seen.upsert).toBeUndefined();
  });

  it.each(["42501", "P0001"])("maps database refusal %s to refused", async (code) => {
    const { db } = fakeDb({ error: { code } });
    const outcome = await supabaseCompletionStore(db).insert("u1", [
      { lessonId: lesson as never, completedAt: 1, code: "" },
    ]);
    expect(outcome).toBe("refused");
  });

  it("maps any other error to unavailable", async () => {
    const { db } = fakeDb({ error: { code: "08006" } });
    const outcome = await supabaseCompletionStore(db).insert("u1", [
      { lessonId: lesson as never, completedAt: 1, code: "" },
    ]);
    expect(outcome).toBe("unavailable");
  });

  it("lists the caller's rows as completions and skips a malformed row", async () => {
    const { db, seen } = fakeDb({
      data: [
        { lesson_id: lesson, completed_at: "2023-11-14T22:13:20.000Z", code: "x" },
        { lesson_id: "NOT-A-UUID", completed_at: "2023-11-14T22:13:20.000Z", code: "y" },
        { lesson_id: lesson, completed_at: "not a date", code: "z" },
      ],
    });
    expect(await supabaseCompletionStore(db).list("u1")).toEqual([
      { lessonId: lesson, completedAt: 1_700_000_000_000, code: "x" },
    ]);
    expect(seen.eq).toEqual(["user_id", "u1"]);
  });

  it("answers null when the list cannot be read", async () => {
    const { db } = fakeDb({ error: { code: "08006" } });
    expect(await supabaseCompletionStore(db).list("u1")).toBeNull();
  });
});

describe("[FR-PRG-02] [T-08] the account's completed lesson IDs", () => {
  it("reads only the lesson ID of the caller's rows and skips a malformed one", async () => {
    const { db, seen } = fakeDb({ data: [{ lesson_id: lesson }, { lesson_id: "NOT-A-UUID" }] });
    expect(await supabaseCompletionStore(db).lessonIds("u1")).toEqual([lesson]);
    expect(seen.eq).toEqual(["user_id", "u1"]);
    expect(seen.columns).toBe("lesson_id");
  });

  it("answers null when they cannot be read", async () => {
    const { db } = fakeDb({ error: { code: "08006" } });
    expect(await supabaseCompletionStore(db).lessonIds("u1")).toBeNull();
  });
});
