import { describe, expect, it } from "vitest";
import { forAll, type Generator } from "../../scripts/testing/property";
import { localDay, parseTimeZone, streak, type TimeZone, totalXp } from "./streak";

// Day boundaries and daylight saving (FR-PRG-05). Zones chosen for their
// shifts: New York and London move an hour on different dates, Lord Howe
// moves half an hour, Santiago and Sydney are in the southern hemisphere,
// Kolkata has no daylight saving and a half-hour offset, Kiritimati is 14
// hours ahead of UTC, and Pago Pago 11 hours behind.

const ZONES = [
  "America/New_York",
  "Europe/London",
  "Australia/Lord_Howe",
  "America/Santiago",
  "Australia/Sydney",
  "Asia/Kolkata",
  "Pacific/Kiritimati",
  "Pacific/Pago_Pago",
  "UTC",
].map((zone) => {
  const parsed = parseTimeZone(zone);
  if (parsed === undefined) throw new Error(`unknown zone ${zone}`);
  return parsed;
});

const HOUR = 3_600_000;
const DAY = 24 * HOUR;

const hourIn = (instant: number, zone: TimeZone) =>
  Number(
    new Intl.DateTimeFormat("en-US", { timeZone: zone, hour: "numeric", hourCycle: "h23" }).format(
      new Date(instant),
    ),
  );

/**
 * An instant near local noon on a random date in 2026 and 2027, which spans
 * every zone's daylight saving changes. From there, adding whole days of 24
 * hours lands on the next calendar dates, since a local day is 23 to 25
 * hours long and the time of day stays between 10:00 and 14:00.
 */
const nearNoon: Generator<{ zone: TimeZone; base: number }> = (random) => {
  const zone = random.pick(ZONES);
  const start = Date.UTC(2026, 0, 1) + random.int(0, 700) * DAY + random.int(0, 23) * HOUR;
  const base = start + (12 - hourIn(start, zone)) * HOUR;
  return { zone, base };
};

/** A set of day offsets, the reference model's input. */
const offsets: Generator<number[]> = (random) => {
  const count = random.int(0, 25);
  return [...new Set(Array.from({ length: count }, () => random.int(0, 40)))];
};

/** The definition, on whole day numbers. */
function model(days: number[], today: number) {
  const sorted = [...new Set(days.filter((day) => day <= today))].sort((a, b) => a - b);
  let longest = 0;
  let run = 0;
  for (let index = 0; index < sorted.length; index += 1) {
    run = index > 0 && sorted[index] === (sorted[index - 1] ?? 0) + 1 ? run + 1 : 1;
    longest = Math.max(longest, run);
  }
  const last = sorted.at(-1);
  return { current: last !== undefined && today - last <= 1 ? run : 0, longest };
}

describe("local days", () => {
  it("[FR-PRG-05] the base instants really are near local noon", () => {
    forAll(nearNoon, ({ zone, base }) => {
      const hour = hourIn(base, zone);
      expect(hour).toBeGreaterThanOrEqual(11);
      expect(hour).toBeLessThanOrEqual(13);
    });
  });

  it("[FR-PRG-05] 24 hours after local noon is always the next local day, across daylight saving", () => {
    forAll(nearNoon, ({ zone, base }) => {
      for (let day = 1; day <= 40; day += 1) {
        expect(localDay(base + day * DAY, zone) - localDay(base, zone)).toBe(day);
      }
    });
  });

  it("[FR-PRG-05] a minute before and a minute after local midnight are consecutive days", () => {
    // 2026-03-08 New York springs forward at 02:00; 2026-11-01 it falls back.
    const newYork = parseTimeZone("America/New_York") as TimeZone;
    const beforeSpring = Date.UTC(2026, 2, 8, 4, 59); // 23:59 on 7 March, local
    expect(localDay(beforeSpring + 2 * 60_000, newYork) - localDay(beforeSpring, newYork)).toBe(1);
    const beforeFall = Date.UTC(2026, 10, 1, 3, 59); // 23:59 on 31 October, local
    expect(localDay(beforeFall + 2 * 60_000, newYork) - localDay(beforeFall, newYork)).toBe(1);
    // Lord Howe moves half an hour; Kolkata is UTC+05:30 all year.
    const kolkata = parseTimeZone("Asia/Kolkata") as TimeZone;
    expect(localDay(Date.UTC(2026, 5, 1, 18, 29), kolkata)).toBe(
      localDay(Date.UTC(2026, 5, 1, 0, 0), kolkata),
    );
    expect(localDay(Date.UTC(2026, 5, 1, 18, 31), kolkata)).toBe(
      localDay(Date.UTC(2026, 5, 1, 0, 0), kolkata) + 1,
    );
  });

  it("[FR-PRG-05] the same instant can be two different days in two zones", () => {
    const instant = Date.UTC(2026, 5, 1, 12, 0);
    const ahead = parseTimeZone("Pacific/Kiritimati") as TimeZone;
    const behind = parseTimeZone("Pacific/Pago_Pago") as TimeZone;
    expect(localDay(instant, ahead) - localDay(instant, behind)).toBe(1);
  });

  it("[FR-PRG-05] refuses a time zone the platform does not know", () => {
    for (const value of ["Mars/Olympus", "", "UTC+3", 3, null, undefined]) {
      expect(parseTimeZone(value)).toBeUndefined();
    }
    expect(parseTimeZone("Europe/London")).toBe("Europe/London");
  });
});

describe("streak", () => {
  it("[FR-PRG-05] matches the definition for any set of days, in any zone, across daylight saving", () => {
    forAll(
      (random) => ({
        ...nearNoon(random),
        days: offsets(random),
        today: random.int(0, 45),
        jitter: Array.from({ length: 40 }, () => random.int(-2, 2) * HOUR),
      }),
      ({ zone, base, days, today, jitter }) => {
        const completedAt = days.map((day) => base + day * DAY + (jitter[day] ?? 0));
        const now = base + today * DAY + 2 * HOUR;
        expect(streak(completedAt, now, zone)).toEqual(model(days, today));
      },
    );
  });

  it("[FR-PRG-05] the order of the completions and repeats on one day change nothing", () => {
    forAll(
      (random) => ({ ...nearNoon(random), days: offsets(random) }),
      ({ zone, base, days }) => {
        const completedAt = days.map((day) => base + day * DAY);
        const now = base + 41 * DAY;
        const expected = streak(completedAt, now, zone);
        expect(streak([...completedAt].reverse(), now, zone)).toEqual(expected);
        expect(streak([...completedAt, ...completedAt.map((t) => t + HOUR)], now, zone)).toEqual(
          expected,
        );
      },
    );
  });

  it("[FR-PRG-05] current is never more than longest", () => {
    forAll(
      (random) => ({ ...nearNoon(random), days: offsets(random), today: random.int(0, 45) }),
      ({ zone, base, days, today }) => {
        const result = streak(
          days.map((day) => base + day * DAY),
          base + today * DAY,
          zone,
        );
        expect(result.current).toBeLessThanOrEqual(result.longest);
        expect(result.current).toBeGreaterThanOrEqual(0);
      },
    );
  });

  it("[FR-PRG-05] a streak ending yesterday still counts; one ending the day before does not", () => {
    const london = parseTimeZone("Europe/London") as TimeZone;
    const noon = Date.UTC(2026, 5, 10, 11, 0); // 12:00 in London (BST)
    const days = [noon - 2 * DAY, noon - DAY, noon];
    expect(streak(days, noon + DAY, london)).toEqual({ current: 3, longest: 3 });
    expect(streak(days, noon + 2 * DAY, london)).toEqual({ current: 0, longest: 3 });
  });

  it("[FR-PRG-05] a completion just before local midnight and one just after are a two day streak", () => {
    const newYork = parseTimeZone("America/New_York") as TimeZone;
    const late = Date.UTC(2026, 10, 1, 3, 58); // 23:58 on 31 October, local
    expect(streak([late, late + 4 * 60_000], late + HOUR, newYork)).toEqual({
      current: 2,
      longest: 2,
    });
  });

  it("[FR-PRG-05] a completion later than now is not counted, nor is a time that is not a number", () => {
    const utc = parseTimeZone("UTC") as TimeZone;
    const now = Date.UTC(2026, 5, 10, 12, 0);
    expect(streak([now + DAY, Number.NaN, Number.POSITIVE_INFINITY], now, utc)).toEqual({
      current: 0,
      longest: 0,
    });
  });
});

describe("XP", () => {
  it("[FR-PRG-04] is the sum of the XP of the completions", () => {
    forAll(
      (random) => {
        const draw = () =>
          Array.from({ length: random.int(0, 15) }, () => ({ xp: random.int(5, 50) }));
        return [draw(), draw()] as const;
      },
      ([a, b]) => {
        expect(totalXp([...a, ...b])).toBe(totalXp(a) + totalXp(b));
        expect(totalXp([...a].reverse())).toBe(totalXp(a));
      },
    );
    expect(totalXp([])).toBe(0);
    expect(totalXp([{ xp: 10 }, { xp: 25 }, { xp: 5 }])).toBe(40);
  });
});
