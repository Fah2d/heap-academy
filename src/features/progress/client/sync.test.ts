import { describe, expect, it } from "vitest";
import { parseLessonId, type LessonId } from "@/domain/ids";
import type { Completion } from "@/domain/progress";
import { createProgressStore, memoryBackend } from "./device-store";
import { RETRY_FIRST_MS, RETRY_LAST_MS, startProgressSync, type SyncPorts } from "./sync";

const lesson = (n: number): LessonId => {
  const id = parseLessonId(`00000000-0000-4000-8000-${String(n).padStart(12, "0")}`);
  if (id === undefined) throw new Error("bad test id");
  return id;
};
const pass = (n: number): Completion => ({ lessonId: lesson(n), completedAt: n, code: `c${n}` });

type Merge = SyncPorts["mergeProgress"];
type Record = SyncPorts["recordCompletion"];

function harness(options: { merge?: Merge; record?: Record } = {}) {
  const account = new Map<LessonId, Completion>();
  const timers: { callback: () => void; milliseconds: number; live: boolean }[] = [];
  let visible = false;
  let listener: () => void = () => {};
  let stopped = false;
  const sent: Completion[][] = [];
  const ports: SyncPorts = {
    mergeProgress:
      options.merge ??
      (async ({ completions }) => {
        sent.push(completions);
        for (const completion of completions) {
          if (!account.has(completion.lessonId)) account.set(completion.lessonId, completion);
        }
        return { ok: true, value: { completions: [...account.values()], rejected: [] } };
      }),
    recordCompletion:
      options.record ??
      (async (completion) => {
        account.set(completion.lessonId, completion);
        return { ok: true, value: null };
      }),
    isVisible: () => visible,
    onVisible: (next) => {
      listener = next;
      return () => {
        stopped = true;
      };
    },
    setTimer: (callback, milliseconds) => {
      const timer = { callback, milliseconds, live: true };
      timers.push(timer);
      return timer;
    },
    clearTimer: (timer) => {
      (timer as { live: boolean }).live = false;
    },
  };
  const store = createProgressStore(memoryBackend());
  return {
    store,
    ports,
    account,
    timers,
    sent,
    show: () => {
      visible = true;
      listener();
    },
    isStopped: () => stopped,
  };
}

const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

describe("[FR-PRG-03] sync on start and when the tab shows", () => {
  it("sends the device's completions on start and marks them synced", async () => {
    const h = harness();
    await h.store.record(pass(1));
    const sync = startProgressSync(h.store, h.ports);
    expect(await sync.sync()).toBe(true);
    expect(h.sent[0]).toEqual([pass(1)]);
    expect((await h.store.list()).every((c) => c.synced)).toBe(true);
    expect(sync.state()).toBe("idle");
  });

  it("syncs again when the tab becomes visible, and not when it hides", async () => {
    const h = harness();
    const sync = startProgressSync(h.store, h.ports);
    await settle();
    const before = h.sent.length;
    h.show();
    await settle();
    expect(h.sent.length).toBe(before + 1);
    sync.stop();
  });

  it("takes the account's list: a completion from another device appears", async () => {
    const h = harness();
    h.account.set(lesson(7), pass(7));
    const sync = startProgressSync(h.store, h.ports);
    await sync.sync();
    expect(await h.store.list()).toEqual([{ ...pass(7), synced: true }]);
  });

  it("one sync at a time, and a pass recorded during it is sent by the next", async () => {
    let release: () => void = () => {};
    let calls = 0;
    const h = harness({
      merge: async ({ completions }) => {
        calls += 1;
        if (calls === 1) await new Promise<void>((resolve) => (release = resolve));
        return { ok: true, value: { completions, rejected: [] } };
      },
    });
    const sync = startProgressSync(h.store, h.ports);
    await settle();
    await h.store.record(pass(2));
    const second = sync.sync();
    release();
    expect(await second).toBe(true);
    expect(calls).toBe(2);
    expect(await h.store.pending()).toEqual([]);
  });
});

describe("[FR-PRG-06] [NFR-REL-01] a completion that cannot reach the server is retried", () => {
  it("keeps the pass on the device when the call fails, then stores it on retry", async () => {
    let down = true;
    const h = harness({
      merge: async ({ completions }) => {
        if (down) throw new Error("offline");
        return { ok: true, value: { completions, rejected: [] } };
      },
      record: async () => {
        throw new Error("offline");
      },
    });
    const sync = startProgressSync(h.store, h.ports);
    await settle();
    await sync.complete(pass(1));
    expect(await h.store.pending()).toEqual([pass(1)]);
    expect(sync.state()).toBe("waiting");
    down = false;
    const timer = h.timers.filter((t) => t.live).at(-1);
    timer?.callback();
    await settle();
    expect(await h.store.pending()).toEqual([]);
    expect(sync.state()).toBe("idle");
  });

  it("waits longer after each failure, up to a limit, and starts over after success", async () => {
    let down = true;
    const h = harness({
      merge: async ({ completions }) =>
        down
          ? { ok: false, error: "unavailable" }
          : { ok: true, value: { completions, rejected: [] } },
    });
    const sync = startProgressSync(h.store, h.ports);
    await settle();
    for (let i = 0; i < 8; i += 1) {
      h.timers
        .filter((t) => t.live)
        .at(-1)
        ?.callback();
      await settle();
    }
    const waits = h.timers.map((t) => t.milliseconds);
    expect(waits[0]).toBe(RETRY_FIRST_MS);
    expect(waits[1]).toBe(RETRY_FIRST_MS * 2);
    expect(Math.max(...waits)).toBe(RETRY_LAST_MS);
    down = false;
    h.timers
      .filter((t) => t.live)
      .at(-1)
      ?.callback();
    await settle();
    expect(sync.state()).toBe("idle");
    down = true;
    await sync.sync();
    expect(h.timers.at(-1)?.milliseconds).toBe(RETRY_FIRST_MS);
  });

  it("marks a pass synced once recordCompletion stores it", async () => {
    const h = harness();
    const sync = startProgressSync(h.store, h.ports);
    await settle();
    await sync.complete(pass(3));
    expect(await h.store.list()).toEqual([{ ...pass(3), synced: true }]);
  });

  it("drops a lesson the database says is not available, and does not retry it", async () => {
    const h = harness({ record: async () => ({ ok: false, error: "lesson_unavailable" }) });
    const sync = startProgressSync(h.store, h.ports);
    await settle();
    const timers = h.timers.length;
    await sync.complete(pass(4));
    expect(await h.store.list()).toEqual([]);
    expect(h.timers.length).toBe(timers);
  });

  it("drops the lessons a sync names as refused", async () => {
    const h = harness({
      merge: async () => ({ ok: true, value: { completions: [], rejected: [lesson(5)] } }),
    });
    await h.store.record(pass(5));
    const sync = startProgressSync(h.store, h.ports);
    await sync.sync();
    expect(await h.store.list()).toEqual([]);
  });
});

describe("stopping", () => {
  it("stops listening, clears the wait, and sends nothing more", async () => {
    const h = harness({ merge: async () => ({ ok: false, error: "unavailable" }) });
    const sync = startProgressSync(h.store, h.ports);
    await settle();
    sync.stop();
    expect(h.isStopped()).toBe(true);
    expect(h.timers.every((t) => !t.live)).toBe(true);
    expect(await sync.sync()).toBe(false);
  });
});
