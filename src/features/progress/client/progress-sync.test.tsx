// @vitest-environment jsdom
import { cleanup, render, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { parseLessonId, type LessonId } from "@/domain/ids";
import { deviceProgress } from "./device-progress";
import { ProgressSync } from "./progress-sync";

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
    view.unmount();
    await deviceProgress().clear();
    await deviceProgress().record(pass);
    expect(recordCompletion).toHaveBeenCalledOnce();
  });
});
