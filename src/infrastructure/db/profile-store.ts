import "server-only";
import { z } from "zod";
import type { SessionClient } from "./session-client";

// The caller's profile and the lesson, XP and time of each completion (FR-PRF-01;
// docs/spec/02-architecture.md section 8). Every call runs with the caller's
// own session, so row level security decides what is read and changed.

export type ProfileRecord = {
  displayName: string;
  timeZone: string;
  completions: { lessonId: string; xp: number; completedAt: number }[];
};

export type ProfileStore = {
  /** The caller's profile, or null when the database cannot give it. */
  read: (userId: string) => Promise<ProfileRecord | null>;
  /** Stores the time zone on the caller's own row, if it differs from the stored one. */
  setTimeZone: (userId: string, timeZone: string) => Promise<ChangeOutcome>;
  /** Stores the display name on the caller's own row, if it differs. */
  setDisplayName: (userId: string, displayName: string) => Promise<ChangeOutcome>;
};

export type ChangeOutcome = "changed" | "unchanged" | "unavailable";

type Db = Pick<SessionClient, "from">;

const profileRow = z.object({ display_name: z.string(), time_zone: z.string() });
const completionRows = z.array(
  z.object({
    lesson_id: z.uuid(),
    xp: z.number().int(),
    completed_at: z.iso.datetime({ offset: true }),
  }),
);

export function supabaseProfileStore(db: Db): ProfileStore {
  /** Writes one column of the caller's own row; no row comes back when it already holds the value. */
  async function set(
    userId: string,
    column: "time_zone" | "display_name",
    value: string,
  ): Promise<ChangeOutcome> {
    const { data, error } = await db
      .from("profiles")
      .update(column === "time_zone" ? { time_zone: value } : { display_name: value })
      .eq("user_id", userId)
      .neq(column, value)
      .select("user_id");
    if (error !== null || data === null) return "unavailable";
    return data.length === 0 ? "unchanged" : "changed";
  }

  return {
    async read(userId) {
      const [profile, completions] = await Promise.all([
        db.from("profiles").select("display_name, time_zone").eq("user_id", userId).maybeSingle(),
        db.from("completions").select("lesson_id, xp, completed_at").eq("user_id", userId),
      ]);
      if (profile.error !== null || completions.error !== null) return null;
      const row = profileRow.safeParse(profile.data);
      const rows = completionRows.safeParse(completions.data);
      if (!row.success || !rows.success) return null;
      return {
        displayName: row.data.display_name,
        timeZone: row.data.time_zone,
        completions: rows.data.map((completion) => ({
          lessonId: completion.lesson_id,
          xp: completion.xp,
          completedAt: Date.parse(completion.completed_at),
        })),
      };
    },

    setTimeZone: (userId, timeZone) => set(userId, "time_zone", timeZone),
    setDisplayName: (userId, displayName) => set(userId, "display_name", displayName),
  };
}
