import { describe, expect, it } from "vitest";
import { parseLessonId } from "@/domain/ids";
import type { Completion } from "@/domain/progress";
import { createProgressStore, memoryBackend, parseDeviceList } from "./device-store";

const lesson = (n: number) => {
  const id = parseLessonId(`00000000-0000-4000-8000-${String(n).padStart(12, "0")}`);
  if (id === undefined) throw new Error("bad test id");
  return id;
};
const pass = (n: number, completedAt = 1000 + n, code = `print(${n})`): Completion => ({
  lessonId: lesson(n),
  completedAt,
  code,
});

describe("[FR-PRG-01] [FR-PRG-06] the device store", () => {
  it("keeps a pass on the device, unsynced, and lists it", async () => {
    const store = createProgressStore(memoryBackend());
    await store.record(pass(1));
    expect(await store.list()).toEqual([{ ...pass(1), synced: false }]);
    expect(await store.pending()).toEqual([pass(1)]);
  });

  it("leaves a lesson it already has as it is", async () => {
    const store = createProgressStore(memoryBackend());
    await store.record(pass(1, 500, "first"));
    await store.record(pass(1, 100, "second"));
    expect(await store.list()).toEqual([{ ...pass(1, 500, "first"), synced: false }]);
  });

  it("two passes written at once are both kept", async () => {
    const store = createProgressStore(memoryBackend());
    await Promise.all([store.record(pass(2)), store.record(pass(1))]);
    expect((await store.list()).map((c) => c.lessonId)).toEqual([lesson(1), lesson(2)]);
  });

  it("marks one lesson synced, and sends it no more", async () => {
    const store = createProgressStore(memoryBackend());
    await store.record(pass(1));
    await store.record(pass(2));
    await store.markSynced(lesson(1));
    expect(await store.pending()).toEqual([pass(2)]);
  });

  it("settles with the account's list: the account's entry wins, others wait", async () => {
    const store = createProgressStore(memoryBackend());
    await store.record(pass(1, 900, "mine"));
    await store.record(pass(2));
    await store.settle([pass(1, 100, "theirs")], []);
    expect(await store.list()).toEqual([
      { ...pass(1, 100, "theirs"), synced: true },
      { ...pass(2), synced: false },
    ]);
  });

  it("drops a lesson the database refused, and a lesson on request", async () => {
    const store = createProgressStore(memoryBackend());
    await store.record(pass(1));
    await store.record(pass(2));
    await store.record(pass(3));
    await store.settle([], [lesson(1)]);
    await store.drop([lesson(2)]);
    expect((await store.list()).map((c) => c.lessonId)).toEqual([lesson(3)]);
  });

  it("reports memory as not durable", () => {
    expect(createProgressStore(memoryBackend()).durable).toBe(false);
  });
});

describe("[FR-PRG-01] reading what storage holds", () => {
  it("reads a list that is not one as empty", () => {
    expect(parseDeviceList(undefined)).toEqual([]);
    expect(parseDeviceList("x")).toEqual([]);
    expect(parseDeviceList({})).toEqual([]);
  });

  it("leaves out an entry that is not a completion", () => {
    const good = { ...pass(1), synced: true };
    expect(
      parseDeviceList([
        good,
        { ...good, lessonId: "ABC" },
        { ...good, completedAt: "1" },
        { ...good, synced: "yes" },
        null,
        7,
      ]),
    ).toEqual([good]);
  });

  it("keeps one entry per lesson, the synced one first", () => {
    const unsynced = { ...pass(1, 5, "a"), synced: false };
    const synced = { ...pass(1, 9, "b"), synced: true };
    expect(parseDeviceList([unsynced, synced])).toEqual([synced]);
    expect(parseDeviceList([synced, unsynced])).toEqual([synced]);
  });
});
