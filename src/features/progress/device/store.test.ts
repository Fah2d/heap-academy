import { describe, expect, it } from "vitest";
import type { LessonId } from "@/domain/ids";
import type { DeviceCompletion } from "@/domain/progress";
import { openDeviceStore } from "./indexeddb";
import { createMemoryStore } from "./store";

const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}` as LessonId;
const entry = (n: number, synced = false, code = "print(1)"): DeviceCompletion => ({
  lessonId: id(n),
  completedAt: 1000 * n,
  code,
  synced,
});

describe("memory store [FR-PRG-01]", () => {
  it("reports that it is memory", () => {
    expect(createMemoryStore().kind).toBe("memory");
  });

  it("keeps a completion once when a lesson is passed twice", async () => {
    const store = createMemoryStore();
    await store.add(entry(1, false, "first"));
    await store.add(entry(1, false, "second"));
    expect(await store.list()).toEqual([entry(1, false, "first")]);
  });

  it("replaces every entry in one step and clears", async () => {
    const store = createMemoryStore([entry(1), entry(2)]);
    await store.replaceAll([entry(3, true)]);
    expect(await store.list()).toEqual([entry(3, true)]);
    await store.clear();
    expect(await store.list()).toEqual([]);
  });

  it("does not let a caller change what it holds", async () => {
    const store = createMemoryStore([entry(1)]);
    (await store.list())[0]!.synced = true;
    expect((await store.list())[0]!.synced).toBe(false);
  });
});

describe("openDeviceStore [NFR-REL-01]", () => {
  it("falls back to memory when IndexedDB is missing", async () => {
    expect((await openDeviceStore(undefined)).kind).toBe("memory");
  });

  it("falls back to memory when opening fails", async () => {
    const failing = {
      open() {
        const opening = { error: new Error("denied"), onerror: null as (() => void) | null };
        queueMicrotask(() => opening.onerror?.());
        return opening;
      },
    } as unknown as IDBFactory;
    expect((await openDeviceStore(failing)).kind).toBe("memory");
  });

  it("falls back to memory when opening throws", async () => {
    const throwing = {
      open() {
        throw new Error("SecurityError");
      },
    } as unknown as IDBFactory;
    expect((await openDeviceStore(throwing)).kind).toBe("memory");
  });
});
