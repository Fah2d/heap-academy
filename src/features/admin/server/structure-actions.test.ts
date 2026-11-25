import { beforeEach, describe, expect, it, vi } from "vitest";
import { type Identity, parseUserId } from "@/domain/auth/identity";
import type { RequestId } from "@/infrastructure/http/request-id";
import { type FakeDb, fakeDb } from "../../../../scripts/testing/fake-db";

// The course structure actions through the real action wrapper (FR-ADM-03,
// FR-ADM-10, FR-ADM-11, T-20): a guest, a learner at either level and an
// admin at aal1 are answered as for a missing action and the database is
// never asked; an oversized or extra input is refused; an admin's success
// expires the published-content cache, and a failure does not.

vi.mock("server-only", () => ({}));

const state = vi.hoisted(() => ({
  caller: null as Identity | null,
  admin: false,
  db: null as unknown as FakeDb,
  changed: vi.fn(),
}));

vi.mock("@/content", () => ({ contentChanged: state.changed }));

vi.mock("@/infrastructure/actions/server-action", async () => {
  const { createActionFactory } = await import("@/infrastructure/actions/define-action");
  return {
    defineAction: createActionFactory({
      context: () =>
        Promise.resolve({
          requestId: "00000000-0000-4000-8000-0000000000aa" as RequestId,
          identify: () => Promise.resolve(state.caller),
          isAdmin: () => Promise.resolve(state.admin),
          services: { db: state.db },
        }),
      log: () => undefined,
      now: () => 0,
    }),
  };
});

const actions = await import("./structure-actions");

const userId = parseUserId("00000000-0000-4000-8000-000000000002")!;

const COURSE = "00000000-0000-4000-8000-000000000c01";
const CHAPTER = "00000000-0000-4000-8000-000000000d01";
const OTHER = "00000000-0000-4000-8000-000000000d02";
const LOADED = "2026-11-21T08:00:00.123456+00:00";
const NEWER = "2026-11-21T08:05:00.654321+00:00";
const details = {
  title: "Python basics",
  slug: "python-basics",
  summary: "Write your first programs.",
  outcomes: ["Print a line"],
};

beforeEach(() => {
  state.caller = null;
  state.admin = false;
  state.db = fakeDb();
  state.changed.mockReset();
});

const calls = [
  ["saveCourse (create)", () => actions.saveCourse({ details })],
  ["saveCourse (edit)", () => actions.saveCourse({ id: COURSE, loadedAt: LOADED, details })],
  [
    "setCourseStatus",
    () => actions.setCourseStatus({ id: COURSE, loadedAt: LOADED, status: "published" }),
  ],
  ["saveChapter", () => actions.saveChapter({ courseId: COURSE, title: "One", summary: "" })],
  ["deleteChapter", () => actions.deleteChapter({ id: CHAPTER })],
  ["reorder", () => actions.reorder({ kind: "course", id: COURSE, direction: "up" })],
] as const;

function asAdmin() {
  state.caller = { userId, aal: "aal2" };
  state.admin = true;
}

describe("course structure actions refuse everyone but an admin [FR-ADM-03, T-20]", () => {
  it.each(calls)("%s: a guest is answered not_found", async (_, call) => {
    expect(await call()).toEqual({ ok: false, error: "not_found" });
    expect(state.db.calls).toEqual([]);
  });

  it.each(calls)("%s: a learner at aal1 or aal2 is answered not_found", async (_, call) => {
    for (const aal of ["aal1", "aal2"] as const) {
      state.caller = { userId, aal };
      expect(await call()).toEqual({ ok: false, error: "not_found" });
    }
    expect(state.db.calls).toEqual([]);
    expect(state.changed).not.toHaveBeenCalled();
  });

  it.each(calls)("%s: an admin at aal1 is answered not_found", async (_, call) => {
    state.caller = { userId, aal: "aal1" };
    state.admin = true;
    expect(await call()).toEqual({ ok: false, error: "not_found" });
    expect(state.db.calls).toEqual([]);
  });

  it("refuses an oversized, extra or malformed input before the database", async () => {
    asAdmin();
    const refused = [
      actions.saveCourse({ details: { ...details, title: "x".repeat(10_000) } }),
      actions.saveCourse({ details: { ...details, status: "published" } }),
      actions.saveCourse({ details: { ...details, slug: "Not A Slug" } }),
      actions.saveCourse({ details: { ...details, outcomes: ["a", "b", "c", "d", "e", "f"] } }),
      actions.saveCourse({ id: COURSE, loadedAt: "yesterday", details }),
      actions.setCourseStatus({ id: COURSE, loadedAt: LOADED, status: "deleted" }),
      actions.saveChapter({ courseId: "not-a-uuid", title: "One", summary: "" }),
      actions.saveChapter({ courseId: COURSE, title: "   ", summary: "" }),
      actions.reorder({ kind: "course", id: COURSE, direction: "sideways" }),
      actions.reorder({ kind: "chapter", id: CHAPTER, direction: "up" }),
      actions.reorder({ kind: "lesson", courseId: COURSE, id: CHAPTER, direction: "up" }),
    ];
    for (const result of await Promise.all(refused)) {
      expect(result).toEqual({ ok: false, error: "invalid_input" });
    }
    expect(state.db.calls).toEqual([]);
  });
});

describe("course structure actions for an admin [FR-ADM-03, FR-ADM-10, FR-ADM-11]", () => {
  it("creates a course at the end of the list and expires the cache", async () => {
    asAdmin();
    state.db.answer({ data: { position: 4 } }, { data: { id: COURSE } });
    expect(
      await actions.saveCourse({ details: { ...details, title: "  Python basics  " } }),
    ).toEqual({ ok: true, value: { id: COURSE } });
    const insert = state.db.calls[1]?.chain.find(([method]) => method === "insert");
    expect(insert?.[1][0]).toEqual({ ...details, position: 5 });
    expect(state.changed).toHaveBeenCalledTimes(1);
  });

  it("names a taken address", async () => {
    asAdmin();
    state.db.answer({ data: null }, { error: { code: "23505" } });
    expect(await actions.saveCourse({ details })).toEqual({ ok: false, error: "slug_taken" });
    expect(state.changed).not.toHaveBeenCalled();
  });

  it("saves details only over the version the editor loaded", async () => {
    asAdmin();
    state.db.answer({ data: { updated_at: NEWER } });
    expect(await actions.saveCourse({ id: COURSE, loadedAt: LOADED, details })).toEqual({
      ok: true,
      value: { id: COURSE, updatedAt: NEWER },
    });
    const update = state.db.calls[0]?.chain;
    expect(update).toContainEqual(["eq", ["id", COURSE]]);
    expect(update).toContainEqual(["eq", ["updated_at", LOADED]]);
    expect(state.changed).toHaveBeenCalledTimes(1);
  });

  it("refuses a stale save, and tells it apart from a course that is gone", async () => {
    asAdmin();
    // No row matched the loaded version, but the course is there: newer.
    state.db.answer({ data: null }, { data: { id: COURSE } });
    expect(await actions.saveCourse({ id: COURSE, loadedAt: LOADED, details })).toEqual({
      ok: false,
      error: "stale",
    });
    state.db.answer({ data: null }, { data: null });
    expect(await actions.saveCourse({ id: COURSE, loadedAt: LOADED, details })).toEqual({
      ok: false,
      error: "not_found",
    });
    expect(state.changed).not.toHaveBeenCalled();
  });

  it("passes on the database's refusal to publish a course with no published lesson", async () => {
    asAdmin();
    state.db.answer(
      { data: { status: "draft" } },
      { error: { code: "P0001", message: "course_has_no_published_lesson" } },
    );
    expect(
      await actions.setCourseStatus({ id: COURSE, loadedAt: LOADED, status: "published" }),
    ).toEqual({ ok: false, error: "no_published_lesson" });
    expect(state.changed).not.toHaveBeenCalled();
  });

  it("refuses a status move the content system does not allow, without writing", async () => {
    asAdmin();
    state.db.answer({ data: { status: "archived" } });
    expect(
      await actions.setCourseStatus({ id: COURSE, loadedAt: LOADED, status: "published" }),
    ).toEqual({ ok: false, error: "status_not_allowed" });
    expect(state.db.calls).toHaveLength(1);
  });

  it("archives a published course over the loaded version", async () => {
    asAdmin();
    state.db.answer({ data: { status: "published" } }, { data: { updated_at: NEWER } });
    expect(
      await actions.setCourseStatus({ id: COURSE, loadedAt: LOADED, status: "archived" }),
    ).toEqual({ ok: true, value: { updatedAt: NEWER } });
    expect(state.db.calls[1]?.chain[0]).toEqual(["update", [{ status: "archived" }]]);
    expect(state.changed).toHaveBeenCalledTimes(1);
  });

  it("adds a chapter at the end of its course, and renames one in place", async () => {
    asAdmin();
    state.db.answer({ data: null }, { data: { id: CHAPTER } });
    expect(await actions.saveChapter({ courseId: COURSE, title: " Basics ", summary: "" })).toEqual(
      { ok: true, value: { id: CHAPTER } },
    );
    expect(state.db.calls[1]?.chain[0]).toEqual([
      "insert",
      [{ course_id: COURSE, title: "Basics", summary: "", position: 0 }],
    ]);
    state.db.answer({ data: { id: CHAPTER } });
    const rename = {
      courseId: COURSE,
      id: CHAPTER,
      loadedAt: LOADED,
      title: "Start",
      summary: "S",
    };
    expect(await actions.saveChapter(rename)).toEqual({ ok: true, value: { id: CHAPTER } });
    expect(state.db.calls[2]?.chain).toContainEqual(["eq", ["course_id", COURSE]]);
    expect(state.db.calls[2]?.chain).toContainEqual(["eq", ["updated_at", LOADED]]);
    expect(state.changed).toHaveBeenCalledTimes(2);
  });

  it("[FR-ADM-10] refuses a rename without the loaded version, or over a newer chapter", async () => {
    asAdmin();
    expect(
      await actions.saveChapter({ courseId: COURSE, id: CHAPTER, title: "Start", summary: "" }),
    ).toEqual({ ok: false, error: "invalid_input" });
    // No row at the loaded version, but the chapter exists: stale.
    state.db.answer({ data: null }, { data: { id: CHAPTER } });
    const rename = { courseId: COURSE, id: CHAPTER, loadedAt: LOADED, title: "Start", summary: "" };
    expect(await actions.saveChapter(rename)).toEqual({ ok: false, error: "stale" });
    // No row at all: gone.
    state.db.answer({ data: null }, { data: null });
    expect(await actions.saveChapter(rename)).toEqual({ ok: false, error: "not_found" });
    expect(state.changed).not.toHaveBeenCalled();
  });

  it("says a course is gone when a chapter is added to a course deleted meanwhile", async () => {
    asAdmin();
    state.db.answer({ data: null }, { error: { code: "23503" } });
    expect(await actions.saveChapter({ courseId: COURSE, title: "Basics", summary: "" })).toEqual({
      ok: false,
      error: "not_found",
    });
  });

  it("refuses to delete a chapter that still has lessons", async () => {
    asAdmin();
    state.db.answer({ error: { code: "23503" } });
    expect(await actions.deleteChapter({ id: CHAPTER })).toEqual({
      ok: false,
      error: "chapter_has_lessons",
    });
    state.db.answer({ data: [] });
    expect(await actions.deleteChapter({ id: CHAPTER })).toEqual({
      ok: false,
      error: "not_found",
    });
    expect(state.changed).not.toHaveBeenCalled();
  });

  it("moves a chapter by sending the whole new order", async () => {
    asAdmin();
    state.db.answer({ data: [{ id: CHAPTER }, { id: OTHER }] }, { data: null });
    expect(
      await actions.reorder({ kind: "chapter", courseId: COURSE, id: OTHER, direction: "up" }),
    ).toEqual({ ok: true, value: null });
    expect(state.db.calls[1]).toEqual({
      target: "rpc:reorder_chapters",
      chain: [["args", [{ p_course_id: COURSE, p_chapter_ids: [OTHER, CHAPTER] }]]],
    });
    expect(state.changed).toHaveBeenCalledTimes(1);
  });

  it("moves a lesson inside its chapter by sending the chapter's new order", async () => {
    asAdmin();
    const FIRST = "00000000-0000-4000-8000-000000000e01";
    const SECOND = "00000000-0000-4000-8000-000000000e02";
    state.db.answer({ data: [{ id: FIRST }, { id: SECOND }] }, { data: null });
    expect(
      await actions.reorder({ kind: "lesson", chapterId: CHAPTER, id: FIRST, direction: "down" }),
    ).toEqual({ ok: true, value: null });
    expect(state.db.calls[0]?.target).toBe("lessons");
    expect(state.db.calls[0]?.chain).toContainEqual(["eq", ["chapter_id", CHAPTER]]);
    expect(state.db.calls[1]).toEqual({
      target: "rpc:reorder_lessons",
      chain: [["args", [{ p_chapter_id: CHAPTER, p_lesson_ids: [SECOND, FIRST] }]]],
    });
    expect(state.changed).toHaveBeenCalledTimes(1);
  });

  it("refuses a move past the end without writing, and a move the database finds stale", async () => {
    asAdmin();
    state.db.answer({ data: [{ id: COURSE }] });
    expect(await actions.reorder({ kind: "course", id: COURSE, direction: "down" })).toEqual({
      ok: false,
      error: "cannot_move",
    });
    expect(state.db.calls).toHaveLength(1);
    state.db.answer(
      { data: [{ id: COURSE }, { id: OTHER }] },
      { error: { code: "P0001", message: "order_out_of_date" } },
    );
    expect(await actions.reorder({ kind: "course", id: OTHER, direction: "up" })).toEqual({
      ok: false,
      error: "cannot_move",
    });
    expect(state.changed).not.toHaveBeenCalled();
  });

  it("answers unavailable for any other database error", async () => {
    asAdmin();
    state.db.answer({ data: null }, { error: { code: "57014", message: "statement timeout" } });
    expect(await actions.saveCourse({ details })).toEqual({ ok: false, error: "unavailable" });
  });
});
