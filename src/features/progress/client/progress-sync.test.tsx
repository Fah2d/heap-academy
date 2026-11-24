// @vitest-environment jsdom
import { cleanup, render, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { parseLessonId, type LessonId } from "@/domain/ids";
import { deviceProgress } from "./device-progress";
import { ProgressSync } from "./progress-sync";
import { syncStatus } from "./sync-status";

afterEach(cleanup);

const LESSON = parseLessonId("00000000-0000-4000-8000-000000000001") as LessonId;
const pass = { lessonId: LESSON, completedAt: 1, code: "x = 1" };

describe("[FR-PRG-02] the sync mounted for a signed-in learner", () => {
  it("syncs on load, sends a new pass, and stops when it unmounts", async () => {
    const mergeProgress = vi.fn(async () => ({
      ok: true as const,
      value: { completions: [], rejected: [] },
    }));
    const recordCompletion = vi.fn(async () => ({ ok: true as const, value: null }));
    const view = render(
      <ProgressSync mergeProgress={mergeProgress} recordCompletion={recordCompletion} />,
    );
    await waitFor(() => expect(mergeProgress).toHaveBeenCalledOnce());
    await deviceProgress().record(pass);
    await waitFor(() => expect(recordCompletion).toHaveBeenCalledWith(pass));
    await waitFor(async () => expect(await deviceProgress().pending()).toEqual([]));
    const synced = mergeProgress.mock.calls.length;
    document.dispatchEvent(new Event("visibilitychange"));
    await waitFor(() => expect(mergeProgress.mock.calls.length).toBeGreaterThan(synced));
    view.unmount();
    await deviceProgress().clear();
    await deviceProgress().record(pass);
    expect(recordCompletion).toHaveBeenCalledOnce();
  });
});

describe("[FR-PRG-06] the unsynced state", () => {
  it("is on while a pass cannot reach the account, and off once it is stored", async () => {
    await deviceProgress().clear();
    let online = false;
    const mergeProgress = vi.fn(async () => {
      if (!online) throw new Error("offline");
      return {
        ok: true as const,
        value: { completions: [pass], rejected: [] },
      };
    });
    const recordCompletion = vi.fn(async () => ({ ok: true as const, value: null }));
    await deviceProgress().record(pass);
    const view = render(
      <ProgressSync mergeProgress={mergeProgress} recordCompletion={recordCompletion} />,
    );
    await waitFor(() => expect(syncStatus.unsynced()).toBe(true));
    online = true;
    document.dispatchEvent(new Event("visibilitychange"));
    await waitFor(() => expect(syncStatus.unsynced()).toBe(false));
    view.unmount();
  });

  it("stays off when a sync fails and nothing is waiting, and goes off at sign-out", async () => {
    await deviceProgress().clear();
    const mergeProgress = vi.fn(async () => ({ ok: false as const, error: "unavailable" }));
    const recordCompletion = vi.fn(async () => ({ ok: false as const, error: "unavailable" }));
    const view = render(
      <ProgressSync mergeProgress={mergeProgress} recordCompletion={recordCompletion} />,
    );
    await waitFor(() => expect(mergeProgress).toHaveBeenCalled());
    await deviceProgress().pending();
    expect(syncStatus.unsynced()).toBe(false);
    await deviceProgress().record(pass);
    await waitFor(() => expect(syncStatus.unsynced()).toBe(true));
    view.unmount();
    expect(syncStatus.unsynced()).toBe(false);
  });
});
