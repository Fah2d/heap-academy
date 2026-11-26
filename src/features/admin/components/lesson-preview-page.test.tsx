// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { lessonEditor as words } from "@/messages/admin";

// The preview's page (FR-ADM-08; docs/spec/03-experience.md section 7.7): the
// guard first, not-found for an address that names no lesson or one this
// session may not read, the load-failed state, and the workspace in preview
// with a back link to the editor.

vi.mock("server-only", () => ({}));

const NOT_FOUND = "NEXT_NOT_FOUND";
vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error(NOT_FOUND);
  },
}));

const state = vi.hoisted(() => ({
  calls: [] as string[],
  result: { ok: true, lesson: null } as unknown,
  guard: undefined as Error | undefined,
}));

vi.mock("../server/gate", () => ({
  requireAdminStage: (stage: string) => {
    state.calls.push(`guard:${stage}`);
    return state.guard === undefined ? Promise.resolve() : Promise.reject(state.guard);
  },
}));
vi.mock("@/infrastructure/db/session-client", () => ({
  createSessionClient: (mode: string) => {
    state.calls.push(`client:${mode}`);
    return Promise.resolve({});
  },
}));
vi.mock("../server/lesson-preview", () => ({
  lessonForPreview: (_db: unknown, id: string) => {
    state.calls.push(`read:${id}`);
    return Promise.resolve(state.result);
  },
}));
vi.mock("@/infrastructure/http/nonce", () => ({ requestNonce: () => Promise.resolve("nonce") }));
vi.mock("@/features/workspace", () => ({
  LessonContent: () => null,
  Workspace: ({
    lesson,
    preview,
  }: {
    lesson: { title: string };
    preview?: { backHref: string; backLabel: string };
  }) => (
    <div data-testid="workspace">
      {lesson.title}
      {preview !== undefined && <a href={preview.backHref}>{preview.backLabel}</a>}
    </div>
  ),
}));

const { LessonPreviewPage } = await import("./lesson-preview-page");

const ID = "00000000-0000-4000-8000-000000000e01";
const params = (id: string) => Promise.resolve({ id });

beforeEach(() => {
  state.calls = [];
  state.result = { ok: true, lesson: null };
  state.guard = undefined;
});

afterEach(() => {
  cleanup();
});

describe("LessonPreviewPage [FR-ADM-08]", () => {
  it("runs the admin guard before anything else, and reads nothing when it refuses", async () => {
    state.guard = new Error(NOT_FOUND);
    await expect(LessonPreviewPage({ params: params(ID) })).rejects.toThrow(NOT_FOUND);
    expect(state.calls).toEqual(["guard:allow"]);
  });

  it("answers not-found for an address that is not a lesson ID, with no read", async () => {
    await expect(LessonPreviewPage({ params: params("not-a-uuid") })).rejects.toThrow(NOT_FOUND);
    expect(state.calls).toEqual(["guard:allow"]);
  });

  it("answers not-found when this session reads no such lesson", async () => {
    await expect(LessonPreviewPage({ params: params(ID) })).rejects.toThrow(NOT_FOUND);
    expect(state.calls).toEqual(["guard:allow", "client:read-only", `read:${ID}`]);
  });

  it("says the preview could not be loaded when the read fails, with a way back", async () => {
    state.result = { ok: false };
    render(await LessonPreviewPage({ params: params(ID) }));
    expect(screen.getByRole("heading", { level: 1, name: words.previewMetaTitle })).toBeTruthy();
    expect(screen.getByText(words.previewLoadFailed)).toBeTruthy();
    expect(screen.getByRole("link", { name: words.backToEditor }).getAttribute("href")).toBe(
      `/admin/lessons/${ID}`,
    );
    expect(screen.queryByTestId("workspace")).toBeNull();
  });

  it("shows the lesson in the workspace's preview, with the back link to its editor", async () => {
    state.result = {
      ok: true,
      lesson: { instructionsMd: "## Ask", lesson: { id: ID, title: "Ask, then answer" } },
    };
    render(await LessonPreviewPage({ params: params(ID) }));
    expect(screen.getByTestId("workspace").textContent).toContain("Ask, then answer");
    expect(screen.getByRole("link", { name: words.backToEditor }).getAttribute("href")).toBe(
      `/admin/lessons/${ID}`,
    );
  });
});
