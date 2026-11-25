import { describe, expect, it, vi } from "vitest";
import type { LessonId } from "@/domain/ids";
import type { Completion } from "@/domain/progress";
import type { CompletionStore, InsertOutcome } from "@/infrastructure/db/completion-store";
import {
  mergeProgress,
  mergeProgressInput,
  recordCompletion,
  recordCompletionInput,
} from "./progress";

vi.mock("server-only", () => ({}));

const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}` as LessonId;
const done = (n: number, completedAt = 1000 * n, code = "print(1)"): Completion => ({
  lessonId: id(n),
  completedAt,
  code,
});

/** A store that keeps rows like the table: one per lesson, the first insert stays. */
function fakeStore(options: { refuse?: number[]; down?: "insert" | "list" } = {}) {
  const rows = new Map<string, Completion>();
  const calls: Completion[][] = [];
  const store: CompletionStore = {
    async insert(userId, completions) {
      calls.push([...completions]);
      if (options.down === "insert") return "unavailable" as InsertOutcome;
      if (completions.some((c) => options.refuse?.includes(Number(c.lessonId.slice(-12))))) {
        return "refused";
      }
      for (const c of completions)
        if (!rows.has(`${userId}:${c.lessonId}`)) rows.set(`${userId}:${c.lessonId}`, c);
      return "stored";
    },
    async list(userId) {
      if (options.down === "list") return null;
      return [...rows].filter(([key]) => key.startsWith(`${userId}:`)).map(([, c]) => c);
    },
    lessonIds: () => Promise.reject(new Error("the use cases do not read lesson IDs")),
  };
  return { store, rows, calls };
}

describe("[FR-PRG-02] [T-08] recordCompletion", () => {
  it("stores the completion for the caller", async () => {
    const { store, rows } = fakeStore();
    const result = await recordCompletion("user-a", done(1), store);
    expect(result).toEqual({ ok: true, value: null });
    expect([...rows.keys()]).toEqual([`user-a:${id(1)}`]);
  });

  it("[FR-PRG-03] storing the same completion twice changes nothing", async () => {
    const { store, rows } = fakeStore();
    await recordCompletion("user-a", done(1, 5), store);
    await recordCompletion("user-a", done(1, 9, "other"), store);
    expect([...rows.values()]).toEqual([done(1, 5)]);
  });

  it("[T-10] a refused lesson is lesson_unavailable, not a crash", async () => {
    const { store } = fakeStore({ refuse: [1] });
    expect(await recordCompletion("user-a", done(1), store)).toEqual({
      ok: false,
      error: "lesson_unavailable",
    });
  });

  it("[FR-PRG-06] a database that cannot answer is unavailable, so the device retries", async () => {
    const { store } = fakeStore({ down: "insert" });
    expect(await recordCompletion("user-a", done(1), store)).toEqual({
      ok: false,
      error: "unavailable",
    });
  });
});

describe("[FR-PRG-03] mergeProgress", () => {
  it("stores what the device sends and returns the account's full list", async () => {
    const { store } = fakeStore();
    await recordCompletion("user-a", done(3), store);
    const result = await mergeProgress("user-a", { completions: [done(1), done(2)] }, store);
    expect(result).toEqual({
      ok: true,
      value: { completions: [done(1), done(2), done(3)], rejected: [] },
    });
  });

  it("merging twice changes nothing", async () => {
    const { store } = fakeStore();
    const first = await mergeProgress("user-a", { completions: [done(2), done(1)] }, store);
    const second = await mergeProgress("user-a", { completions: [done(2), done(1)] }, store);
    expect(second).toEqual(first);
  });

  it("[T-08] returns only the caller's own completions", async () => {
    const { store } = fakeStore();
    await recordCompletion("user-b", done(9), store);
    const result = await mergeProgress("user-a", { completions: [done(1)] }, store);
    expect(result).toEqual({ ok: true, value: { completions: [done(1)], rejected: [] } });
  });

  it("[T-10] a refused lesson is named and the others are stored", async () => {
    const { store } = fakeStore({ refuse: [2] });
    const result = await mergeProgress(
      "user-a",
      { completions: [done(1), done(2), done(3)] },
      store,
    );
    expect(result).toEqual({
      ok: true,
      value: { completions: [done(1), done(3)], rejected: [id(2)] },
    });
  });

  it("sends one completion per lesson", async () => {
    const { store, calls } = fakeStore();
    await mergeProgress("user-a", { completions: [done(1, 9), done(1, 3)] }, store);
    expect(calls[0]).toEqual([done(1, 3)]);
  });

  it("[FR-PRG-06] an unavailable database is unavailable, on insert and on list", async () => {
    for (const down of ["insert", "list"] as const) {
      const { store } = fakeStore({ down });
      expect(await mergeProgress("user-a", { completions: [done(1)] }, store)).toEqual({
        ok: false,
        error: "unavailable",
      });
    }
  });
});

describe("[T-08] [T-10] inputs", () => {
  const valid = { lessonId: id(1), completedAt: 1, code: "x" };

  it("accepts a lower-case lesson ID, a time and code", () => {
    expect(recordCompletionInput.safeParse(valid).success).toBe(true);
  });

  it.each([
    ["a user ID field", { ...valid, userId: id(2) }],
    ["an xp field", { ...valid, xp: 50 }],
    ["an upper-case ID", { ...valid, lessonId: "0000000A-0000-4000-8000-00000000000A" }],
    ["a missing ID", { completedAt: 1, code: "x" }],
    ["a negative time", { ...valid, completedAt: -1 }],
    ["a time past the limit", { ...valid, completedAt: 1e13 }],
    ["a fractional time", { ...valid, completedAt: 1.5 }],
    ["code over 20000 characters", { ...valid, code: "x".repeat(20_001) }],
  ])("refuses %s", (_name, input) => {
    expect(recordCompletionInput.safeParse(input).success).toBe(false);
  });

  it("refuses more than 100 completions in one sync", () => {
    expect(mergeProgressInput.safeParse({ completions: Array(100).fill(valid) }).success).toBe(
      true,
    );
    expect(mergeProgressInput.safeParse({ completions: Array(101).fill(valid) }).success).toBe(
      false,
    );
  });
});
