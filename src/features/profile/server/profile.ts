import "server-only";
import { z } from "zod";
import { courseStanding } from "@/domain/course-progress";
import { parseDisplayName } from "@/domain/display-name";
import { parseTimeZone, streak, totalXp, type TimeZone } from "@/domain/streak";
import type { UseCaseResult } from "@/infrastructure/actions/define-action";
import type { ProfileStore } from "@/infrastructure/db/profile-store";

// What the profile shows, derived on every read (FR-PRF-01, FR-PRG-04,
// FR-PRG-05), and the changes of time zone and display name (FR-PRF-02).

export type ProfileSummary = {
  displayName: string;
  /** The stored zone, which the page compares with the browser's. */
  timeZone: string;
  xp: number;
  lessons: number;
  completedLessonIds: string[];
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
    completedLessonIds: record.completions.map((completion) => completion.lessonId),
    currentStreak: current,
    longestStreak: longest,
  };
}

export type CourseProgressRow = {
  slug: string;
  title: string;
  completed: number;
  total: number;
};

/**
 * The courses the learner has completed a lesson in, in the order given
 * (FR-PRF-01). Only published lessons are counted; XP from an archived lesson
 * stays in the total.
 */
export function progressByCourse(
  courses: readonly { slug: string; title: string; lessons: readonly { id: string }[] }[],
  completedLessonIds: readonly string[],
): CourseProgressRow[] {
  const completedIds = new Set(completedLessonIds);
  return courses.flatMap(({ slug, title, lessons }) => {
    const { completed, total } = courseStanding(lessons, completedIds);
    return completed === 0 ? [] : [{ slug, title, completed, total }];
  });
}

// The time zone column holds 1 to 64 characters, and only a named zone is stored.
const timeZoneInput = z
  .string()
  .max(64)
  .transform((value, context) => {
    const zone = parseTimeZone(value);
    if (zone !== undefined && zone.length <= 64) return zone;
    context.addIssue({ code: "custom", message: "not a time zone" });
    return z.NEVER;
  });

const displayNameInput = z.string().transform((value, context) => {
  const name = parseDisplayName(value);
  if (name.ok) return name.value;
  context.addIssue({ code: "custom", message: name.problem });
  return z.NEVER;
});

export const updateProfileInput = z
  .strictObject({
    timeZone: timeZoneInput.optional(),
    displayName: displayNameInput.optional(),
  })
  .refine((input) => input.timeZone !== undefined || input.displayName !== undefined);
export const MAX_PROFILE_BYTES = 512;

export type UpdateProfileFailure = "unavailable";

export async function updateProfile(
  userId: string,
  input: z.infer<typeof updateProfileInput>,
  store: ProfileStore,
): Promise<UseCaseResult<{ changed: boolean }, UpdateProfileFailure>> {
  const outcomes = [];
  if (input.timeZone !== undefined) {
    outcomes.push(await store.setTimeZone(userId, input.timeZone));
  }
  if (input.displayName !== undefined) {
    outcomes.push(await store.setDisplayName(userId, input.displayName));
  }
  if (outcomes.includes("unavailable")) return { ok: false, error: "unavailable" };
  return { ok: true, value: { changed: outcomes.includes("changed") } };
}
