// Streak and XP (FR-PRG-04, FR-PRG-05, ADR-0012; architecture section 8.1).
// Derived every time, never stored, and the same functions serve guests and
// accounts. Pure: the clock and the time zone are parameters.
//
// A local day is found with the platform's time zone formatting for an IANA
// zone, never with offset arithmetic (architecture section 14), so daylight
// saving days of 23 or 25 hours, and zones with half-hour shifts, count as
// one day each.

declare const timeZoneBrand: unique symbol;

/** An IANA time zone the platform knows, in its canonical spelling, such as `Europe/London`. */
export type TimeZone = string & { readonly [timeZoneBrand]: true };

/** Keyed by canonical zone, so the map holds at most one entry per zone the platform knows. */
const formatters = new Map<TimeZone, Intl.DateTimeFormat>();

function formatterFor(timeZone: TimeZone): Intl.DateTimeFormat {
  let formatter = formatters.get(timeZone);
  if (formatter === undefined) {
    formatter = new Intl.DateTimeFormat("en-US", {
      timeZone,
      calendar: "gregory",
      numberingSystem: "latn",
      year: "numeric",
      month: "numeric",
      day: "numeric",
    });
    formatters.set(timeZone, formatter);
  }
  return formatter;
}

/**
 * The time zone, in the platform's canonical spelling, if the platform knows
 * it as a named zone. A fixed offset such as `+03:00` is not one: it never
 * follows daylight saving.
 */
export function parseTimeZone(value: unknown): TimeZone | undefined {
  if (typeof value !== "string" || !/^[A-Za-z]/.test(value)) return undefined;
  let canonical: string;
  try {
    canonical = new Intl.DateTimeFormat("en-US", { timeZone: value }).resolvedOptions().timeZone;
  } catch {
    return undefined;
  }
  return canonical as TimeZone;
}

const DAY_MS = 86_400_000;

/** The largest distance from the epoch a `Date` can hold, in milliseconds. */
const DATE_RANGE_MS = 8.64e15;

/**
 * The local calendar day of an instant, as a count of days since 1970-01-01.
 * The count is of calendar dates, not of 24-hour spans, so consecutive dates
 * differ by exactly one whatever the clocks did in between.
 */
export function localDay(instant: number, timeZone: TimeZone): number {
  const parts = formatterFor(timeZone).formatToParts(new Date(instant));
  const part = (type: "year" | "month" | "day") =>
    Number(parts.find((entry) => entry.type === type)?.value);
  return Math.round(Date.UTC(part("year"), part("month") - 1, part("day")) / DAY_MS);
}

export type Streak = {
  /** Consecutive days with a completion, ending today or yesterday; otherwise 0. */
  current: number;
  /** The most consecutive days with a completion, ever. */
  longest: number;
};

/**
 * The learner's streak from the times of their completions (milliseconds
 * since the epoch), in their time zone, at `now`. A completion later than
 * `now` counts as made at `now`, as the database stores it (architecture
 * section 8.3), so a device clock a little behind the server's loses
 * nothing. A time outside the range of a date is not counted.
 */
export function streak(completedAt: readonly number[], now: number, timeZone: TimeZone): Streak {
  const today = localDay(now, timeZone);
  const days = [
    ...new Set(
      completedAt
        .filter((instant) => Math.abs(instant) <= DATE_RANGE_MS)
        .map((instant) => localDay(Math.min(instant, now), timeZone)),
    ),
  ].sort((a, b) => a - b);

  let longest = 0;
  let run = 0;
  let previous: number | undefined;
  for (const day of days) {
    run = previous !== undefined && day === previous + 1 ? run + 1 : 1;
    longest = Math.max(longest, run);
    previous = day;
  }
  const last = days.at(-1);
  const current = last !== undefined && today - last <= 1 ? run : 0;
  return { current, longest };
}

/** XP: the sum of the XP of each completion (FR-PRG-04). */
export function totalXp(completions: readonly { xp: number }[]): number {
  return completions.reduce((sum, completion) => sum + completion.xp, 0);
}
