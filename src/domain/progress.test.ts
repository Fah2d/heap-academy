import { describe, expect, it } from "vitest";
import { forAll, type Generator, tuple } from "../../scripts/testing/property";
import type { LessonId } from "./ids";
import {
  applyAccount,
  type Completion,
  type DeviceCompletion,
  mergeCompletions,
  unsynced,
} from "./progress";

// Property tests over seeded lists that share a few lessons, so most lists
// have conflicts, with times that collide often enough to reach the tie rule.

const LESSONS = [
  "00000000-0000-4000-8000-000000000001",
  "00000000-0000-4000-8000-000000000002",
  "00000000-0000-4000-8000-000000000003",
  "00000000-0000-4000-8000-000000000004",
  "00000000-0000-4000-8000-000000000005",
] as LessonId[];

const completion: Generator<Completion> = (random) => ({
  lessonId: random.pick(LESSONS),
  completedAt: 1_763_600_000_000 + random.int(0, 5) * 60_000,
  code: random.pick(["print(1)", "print(2)", "x = 1", ""]),
});

const list: Generator<Completion[]> = (random) =>
  Array.from({ length: random.int(0, 8) }, () => completion(random));

const deviceList: Generator<DeviceCompletion[]> = (random) =>
  list(random).map((entry) => ({ ...entry, synced: random.int(0, 1) === 1 }));

const three: Generator<[Completion[], Completion[], Completion[]]> = (random) => [
  list(random),
  list(random),
  list(random),
];

const at = (lessonIndex: number, completedAt: number, code = "print(1)"): Completion => ({
  lessonId: LESSONS[lessonIndex] as LessonId,
  completedAt,
  code,
});

describe("merging completions", () => {
  it("[FR-PRG-03] merging twice changes nothing", () => {
    forAll(tuple(list, list), ([device, account]) => {
      const once = mergeCompletions(device, account);
      expect(mergeCompletions(once, account)).toEqual(once);
      expect(mergeCompletions(once, device)).toEqual(once);
      expect(mergeCompletions(once)).toEqual(once);
    });
  });

  it("[FR-PRG-03] the order of the lists does not matter", () => {
    forAll(tuple(list, list), ([a, b]) => {
      expect(mergeCompletions(a, b)).toEqual(mergeCompletions(b, a));
    });
  });

  it("[FR-PRG-03] merging in steps gives the same as merging at once", () => {
    forAll(three, ([a, b, c]) => {
      const atOnce = mergeCompletions(a, b, c);
      expect(mergeCompletions(mergeCompletions(a, b), c)).toEqual(atOnce);
      expect(mergeCompletions(a, mergeCompletions(b, c))).toEqual(atOnce);
    });
  });

  it("[FR-PRG-03] nothing is duplicated or lost: one completion per lesson, for every lesson in either list", () => {
    forAll(tuple(list, list), ([a, b]) => {
      const merged = mergeCompletions(a, b);
      const lessons = merged.map((entry) => entry.lessonId);
      expect(new Set(lessons).size).toBe(lessons.length);
      expect(new Set(lessons)).toEqual(new Set([...a, ...b].map((entry) => entry.lessonId)));
    });
  });

  it("[FR-PRG-03] each lesson keeps its first completion, which is one of the inputs", () => {
    forAll(tuple(list, list), ([a, b]) => {
      for (const kept of mergeCompletions(a, b)) {
        const candidates = [...a, ...b].filter((entry) => entry.lessonId === kept.lessonId);
        expect(candidates).toContainEqual(kept);
        for (const other of candidates) {
          expect(kept.completedAt).toBeLessThanOrEqual(other.completedAt);
        }
      }
    });
  });

  it("[FR-PRG-03] the earlier completion wins, and at the same time the smaller code wins", () => {
    expect(mergeCompletions([at(0, 200, "a")], [at(0, 100, "b")])).toEqual([at(0, 100, "b")]);
    expect(mergeCompletions([at(0, 100, "b")], [at(0, 100, "a")])).toEqual([at(0, 100, "a")]);
  });

  it("[FR-PRG-03] lists the result in lesson order and copies nothing but the completion", () => {
    const extra = { ...at(1, 5), synced: true } as DeviceCompletion;
    expect(mergeCompletions([extra, at(0, 9)])).toEqual([at(0, 9), at(1, 5)]);
    expect(mergeCompletions()).toEqual([]);
  });
});

describe("applying the account's list", () => {
  it("[FR-PRG-02] [FR-PRG-03] applying the same account list twice changes nothing", () => {
    forAll(tuple(deviceList, list), ([device, account]) => {
      const once = applyAccount(device, account);
      expect(applyAccount(once, account)).toEqual(once);
    });
  });

  it("[FR-PRG-02] the account's completion stands for every lesson it has, synced; the device's others wait, unsynced", () => {
    forAll(tuple(deviceList, list), ([device, account]) => {
      const applied = applyAccount(device, account);
      const fromAccount = mergeCompletions(account);
      const stored = new Set(fromAccount.map((entry) => entry.lessonId));
      expect(
        applied.filter((entry) => entry.synced).map(({ synced: _, ...entry }) => entry),
      ).toEqual(fromAccount);
      for (const entry of applied.filter((item) => !item.synced)) {
        expect(stored.has(entry.lessonId)).toBe(false);
      }
      const lessons = new Set(applied.map((entry) => entry.lessonId));
      expect(lessons).toEqual(new Set([...device, ...account].map((entry) => entry.lessonId)));
      expect(lessons.size).toBe(applied.length);
    });
  });

  it("[FR-PRG-06] a completion the server has not stored stays on the device and is sent again", () => {
    forAll(tuple(deviceList, list), ([device, account]) => {
      const pending = unsynced(applyAccount(device, account));
      const stored = new Set(account.map((entry) => entry.lessonId));
      for (const entry of device) {
        if (!stored.has(entry.lessonId)) {
          expect(pending.map((item) => item.lessonId)).toContain(entry.lessonId);
        }
      }
      expect(pending.every((entry) => !stored.has(entry.lessonId))).toBe(true);
    });
  });

  it("[FR-PRG-02] an account completion replaces the device's, even an earlier one", () => {
    const device: DeviceCompletion[] = [{ ...at(0, 100, "guest"), synced: false }];
    expect(applyAccount(device, [at(0, 500, "account")])).toEqual([
      { ...at(0, 500, "account"), synced: true },
    ]);
  });

  it("[FR-PRG-06] sends only what is not synced, one per lesson", () => {
    expect(
      unsynced([
        { ...at(0, 2), synced: false },
        { ...at(0, 1), synced: false },
        { ...at(1, 1), synced: true },
      ]),
    ).toEqual([at(0, 1)]);
  });
});
