import "server-only";
import type { Completion } from "@/domain/progress";
import { parseLessonId } from "@/domain/ids";
import type { SessionClient } from "./session-client";

// The completions table as the progress use cases see it (docs/spec/02-
// architecture.md sections 8 and 10). Every call runs with the caller's own
// session, so row level security decides: a row for another user, or for a
// lesson that is not published, is refused by the database (T-08, T-10).
// A completion is only ever inserted, and never changed or replaced.

export type InsertOutcome = "stored" | "refused" | "unavailable";

export type CompletionStore = {
  /**
   * Stores each completion that is not stored yet. A lesson the account
   * already has is left as it is. One refused row refuses the whole call.
   */
  insert: (userId: string, completions: readonly Completion[]) => Promise<InsertOutcome>;
  /** The account's full list, or null when the database cannot say. */
  list: (userId: string) => Promise<Completion[] | null>;
};

type Db = Pick<SessionClient, "from">;

// 42501: a row level security refusal. P0001 'lesson_not_found': the
// completion trigger could not see the lesson.
const REFUSED = new Set(["42501", "P0001"]);

export function supabaseCompletionStore(db: Db): CompletionStore {
  return {
    async insert(userId, completions) {
      if (completions.length === 0) return "stored";
      const { error } = await db.from("completions").upsert(
        completions.map((completion) => ({
          user_id: userId,
          lesson_id: completion.lessonId,
          completed_at: new Date(completion.completedAt).toISOString(),
          code: completion.code,
        })),
        { onConflict: "user_id,lesson_id", ignoreDuplicates: true },
      );
      if (error === null) return "stored";
      return error.code !== undefined && REFUSED.has(error.code) ? "refused" : "unavailable";
    },

    async list(userId) {
      const { data, error } = await db
        .from("completions")
        .select("lesson_id, completed_at, code")
        .eq("user_id", userId);
      if (error !== null || data === null) return null;
      const list: Completion[] = [];
      for (const row of data) {
        const lessonId = parseLessonId(row.lesson_id);
        const completedAt = Date.parse(row.completed_at);
        if (lessonId !== undefined && Number.isFinite(completedAt)) {
          list.push({ lessonId, completedAt, code: row.code });
        }
      }
      return list;
    },
  };
}
