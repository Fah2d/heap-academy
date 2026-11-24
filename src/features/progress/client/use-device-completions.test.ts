// @vitest-environment jsdom
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { DeviceCompletion } from "@/domain/progress";
import type { LessonId } from "@/domain/ids";
import type { ProgressStore } from "./progress-store";
import { useDeviceCompletions } from "./use-device-completions";

// The course list and the course page fill in a guest's progress from the
// device (02-architecture.md section 10; FR-CAT-02, FR-CRS-02).

const A = "00000000-0000-4000-8000-00000000000a" as LessonId;
const B = "00000000-0000-4000-8000-00000000000b" as LessonId;

const row = (lessonId: LessonId): DeviceCompletion => ({
  lessonId,
  completedAt: 1,
  code: "",
  synced: false,
});

function fakeStore(initial: LessonId[]) {
  let held = initial.map(row);
  const listeners = new Set<() => void>();
  const store: ProgressStore = {
    completions: vi.fn(() => Promise.resolve(held)),
    record: () => Promise.resolve(true),
    durability: () => Promise.resolve("device"),
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
  return {
    store,
    /** One function for every render, as the page's `deviceProgress` is. */
    get: () => store,
    hold: (ids: LessonId[]) => {
      held = ids.map(row);
    },
    notify: () => {
      for (const listener of listeners) listener();
    },
    listeners,
  };
}

function setVisibility(value: DocumentVisibilityState) {
  Object.defineProperty(document, "visibilityState", { configurable: true, value });
}

afterEach(() => {
  cleanup();
  setVisibility("visible");
});

describe("useDeviceCompletions", () => {
  it("[FR-CAT-02] [FR-CRS-02] is undefined until the device answers, then the completed lesson IDs", async () => {
    const fake = fakeStore([A]);
    const { result } = renderHook(() => useDeviceCompletions(fake.get));
    expect(result.current).toBeUndefined();
    await waitFor(() => {
      expect(result.current).toEqual(new Set([A]));
    });
  });

  it("[FR-CAT-02] [FR-CRS-02] reads again after a new completion in this page", async () => {
    const fake = fakeStore([]);
    const { result } = renderHook(() => useDeviceCompletions(fake.get));
    await waitFor(() => {
      expect(result.current).toEqual(new Set());
    });
    fake.hold([A, B]);
    act(() => {
      fake.notify();
    });
    await waitFor(() => {
      expect(result.current).toEqual(new Set([A, B]));
    });
  });

  it("[FR-CAT-02] [FR-CRS-02] reads again when the tab is shown, and not when it is hidden", async () => {
    const fake = fakeStore([]);
    const { result } = renderHook(() => useDeviceCompletions(fake.get));
    await waitFor(() => {
      expect(fake.store.completions).toHaveBeenCalledTimes(1);
    });
    setVisibility("hidden");
    document.dispatchEvent(new Event("visibilitychange"));
    expect(fake.store.completions).toHaveBeenCalledTimes(1);
    fake.hold([B]);
    setVisibility("visible");
    document.dispatchEvent(new Event("visibilitychange"));
    await waitFor(() => {
      expect(result.current).toEqual(new Set([B]));
    });
  });

  it("[FR-CAT-02] [FR-CRS-02] reads again when the page comes back from the browser's history", async () => {
    const fake = fakeStore([]);
    const { result } = renderHook(() => useDeviceCompletions(fake.get));
    await waitFor(() => {
      expect(result.current).toEqual(new Set());
    });
    fake.hold([A]);
    window.dispatchEvent(new Event("pageshow"));
    await waitFor(() => {
      expect(result.current).toEqual(new Set([A]));
    });
  });

  it("[FR-CAT-02] [FR-CRS-02] stops listening when it unmounts", async () => {
    const fake = fakeStore([]);
    const { unmount } = renderHook(() => useDeviceCompletions(fake.get));
    await waitFor(() => {
      expect(fake.store.completions).toHaveBeenCalledTimes(1);
    });
    unmount();
    expect(fake.listeners.size).toBe(0);
    document.dispatchEvent(new Event("visibilitychange"));
    window.dispatchEvent(new Event("pageshow"));
    expect(fake.store.completions).toHaveBeenCalledTimes(1);
  });
});
