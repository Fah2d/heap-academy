import { describe, expect, it } from "vitest";
import type { LessonId } from "@/domain/ids";
import type { Completion, DeviceCompletion } from "@/domain/progress";
import { createMemoryStore } from "./store";
import { createSyncer, type MergeCall, syncOnce } from "./sync";

const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}` as LessonId;
const local = (n: number, synced = false): DeviceCompletion => ({
  lessonId: id(n),
  completedAt: 1000 * n,
  code: "print(1)",
  synced,
});
const account = (n: number): Completion => ({
  lessonId: id(n),
  completedAt: 1000 * n,
  code: "acc",
});

/** A server that keeps one row per lesson, the first insert. */
function server(rejected: number[] = []) {
  const rows = new Map<string, Completion>();
  const sent: Completion[][] = [];
  const merge: MergeCall = async ({ completions }) => {
    sent.push(completions);
    for (const c of completions) {
      if (rejected.includes(Number(c.lessonId.slice(-12)))) continue;
      if (!rows.has(c.lessonId)) rows.set(c.lessonId, c);
    }
    return {
      ok: true,
      value: { completions: [...rows.values()], rejected: rejected.map(id) },
    };
  };
  return { merge, rows, sent };
}

describe("syncOnce [FR-PRG-03] [T-08]", () => {
  it("sends the unsynced entries and marks them synced", async () => {
    const store = createMemoryStore([local(1), local(2, true)]);
    const s = server();
    const outcome = await syncOnce(store, s.merge);
    expect(outcome).toEqual({ status: "synced", rejected: [] });
    expect(s.sent[0]!.map((c) => c.lessonId)).toEqual([id(1)]);
    expect((await store.list()).every((e) => e.synced || e.lessonId === id(2))).toBe(true);
    expect((await store.list()).find((e) => e.lessonId === id(1))?.synced).toBe(true);
  });

  it("merging twice changes nothing", async () => {
    const store = createMemoryStore([local(1), local(3)]);
    const s = server();
    await syncOnce(store, s.merge);
    const once = await store.list();
    await syncOnce(store, s.merge);
    expect(await store.list()).toEqual(once);
    expect(s.sent[1]).toEqual([]);
  });

  it("takes the account's completion where both have the lesson", async () => {
    const store = createMemoryStore([local(1)]);
    const s = server();
    s.rows.set(id(1), account(1));
    await syncOnce(store, s.merge);
    expect(await store.list()).toEqual([{ ...account(1), synced: true }]);
  });

  it("drops a lesson the database refused", async () => {
    const store = createMemoryStore([local(1), local(2)]);
    const s = server([2]);
    const outcome = await syncOnce(store, s.merge);
    expect(outcome).toEqual({ status: "synced", rejected: [id(2)] });
    expect((await store.list()).map((e) => e.lessonId)).toEqual([id(1)]);
  });

  it("keeps every unsynced entry when the call fails [FR-PRG-06]", async () => {
    const store = createMemoryStore([local(1)]);
    expect(await syncOnce(store, async () => ({ ok: false, error: "unavailable" }))).toEqual({
      status: "failed",
    });
    expect(await syncOnce(store, () => Promise.reject(new Error("offline")))).toEqual({
      status: "failed",
    });
    expect(await store.list()).toEqual([local(1)]);
  });

  it("reports signed out and keeps the entries", async () => {
    const store = createMemoryStore([local(1)]);
    const outcome = await syncOnce(store, async () => ({ ok: false, error: "not_signed_in" }));
    expect(outcome).toEqual({ status: "signed_out" });
    expect(await store.list()).toEqual([local(1)]);
  });

  it("keeps a completion stored while the call was in flight", async () => {
    const store = createMemoryStore([local(1)]);
    const s = server();
    const outcome = await syncOnce(store, async (input) => {
      await store.add(local(5));
      return s.merge(input);
    });
    expect(outcome.status).toBe("synced");
    const kept = await store.list();
    expect(kept.find((e) => e.lessonId === id(5))?.synced).toBe(false);
    expect(kept.find((e) => e.lessonId === id(1))?.synced).toBe(true);
  });

  it("retries a failed write on the next run until it is stored", async () => {
    const store = createMemoryStore([local(1)]);
    const s = server();
    let down = true;
    const flaky: MergeCall = (input) =>
      down ? Promise.resolve({ ok: false, error: "unavailable" }) : s.merge(input);
    await syncOnce(store, flaky);
    expect((await store.list())[0]!.synced).toBe(false);
    down = false;
    await syncOnce(store, flaky);
    expect((await store.list())[0]!.synced).toBe(true);
    expect(s.rows.has(id(1))).toBe(true);
  });
});

describe("createSyncer", () => {
  it("shares one run between overlapping calls", async () => {
    const store = createMemoryStore([local(1)]);
    const s = server();
    const syncer = createSyncer(store, s.merge);
    const [a, b] = await Promise.all([syncer.run(), syncer.run()]);
    expect(a).toBe(b);
    expect(s.sent).toHaveLength(1);
    await syncer.run();
    expect(s.sent).toHaveLength(2);
  });
});
