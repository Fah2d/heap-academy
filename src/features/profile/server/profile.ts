import "server-only";
import { z } from "zod";
import { parseTimeZone, streak, totalXp, type TimeZone } from "@/domain/streak";
import type { UseCaseResult } from "@/infrastructure/actions/define-action";
import type { ProfileStore } from "@/infrastructure/db/profile-store";

// What the profile shows, derived on every read (FR-PRF-01, FR-PRG-04,
// FR-PRG-05), and the change of time zone the browser reports (FR-PRF-02).

export type ProfileSummary = {
  displayName: string;
  /** The stored zone, which the page compares with the browser's. */
  timeZone: string;
  xp: number;
  lessons: number;
  currentStreak: number;
  longestStreak: number;
};

/** The caller's profile, or null when it cannot be read. */
export async function profileSummary(
  userId: string,
  store: ProfileStore,
  now: number = Date.now(),
): Promise<ProfileSummary | null> {
  const record = await store.read(userId);
  if (record === null) return null;
  // A stored zone this server does not know counts days in UTC, the column's default.
  const zone = parseTimeZone(record.timeZone) ?? ("UTC" as TimeZone);
  const { current, longest } = streak(
    record.completions.map((completion) => completion.completedAt),
    now,
    zone,
  );
  return {
    displayName: record.displayName,
    timeZone: record.timeZone,
    xp: totalXp(record.completions),
    lessons: record.completions.length,
    currentStreak: current,
    longestStreak: longest,
  };
}

// The column holds 1 to 64 characters, and only a named zone is stored.
export const updateProfileInput = z.strictObject({
  timeZone: z
    .string()
    .max(64)
    .transform((value, context) => {
      const zone = parseTimeZone(value);
      if (zone !== undefined && zone.length <= 64) return zone;
      context.addIssue({ code: "custom", message: "not a time zone" });
      return z.NEVER;
    }),
});
export const MAX_PROFILE_BYTES = 512;

export type UpdateProfileFailure = "unavailable";

export async function updateProfile(
  userId: string,
  input: z.infer<typeof updateProfileInput>,
  store: ProfileStore,
): Promise<UseCaseResult<null, UpdateProfileFailure>> {
  if (await store.setTimeZone(userId, input.timeZone)) return { ok: true, value: null };
  return { ok: false, error: "unavailable" };
}
