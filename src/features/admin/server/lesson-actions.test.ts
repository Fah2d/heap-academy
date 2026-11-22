import { beforeEach, describe, expect, it, vi } from "vitest";
import { type Identity, parseUserId } from "@/domain/auth/identity";
import type { RequestId } from "@/infrastructure/http/request-id";
import { type FakeDb, fakeDb } from "../../../../scripts/testing/fake-db";

// The lesson editor's actions through the real action wrapper (FR-ADM-04,
// FR-ADM-10, T-20): anyone but an admin at aal2 is answered as for a missing
// action and the database is never asked; a save goes through save_lesson
// with the version the editor loaded, and each refusal becomes one reason.

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

const actions = await import("./lesson-actions");

const userId = parseUserId("00000000-0000-4000-8000-000000000002")!;
const COURSE = "00000000-0000-4000-8000-000000000c01";
const CHAPTER = "00000000-0000-4000-8000-000000000d01";
const OTHER_CHAPTER = "00000000-0000-4000-8000-000000000d02";
const LESSON = "00000000-0000-4000-8000-000000000e01";
const LOADED = "2026-11-22T08:00:00.123456+00:00";
const NEWER = "2026-11-22T08:05:00.654321+00:00";
const TESTS = [{ id: "t1", name: "Greets", expected: "Hello, Ada" }];

const draft = {
  chapterId: CHAPTER,
  title: "Ask, then answer",
  slug: "ask-then-answer",
  xp: 10,
  instructionsMd: "## Ask",
  hints: ["Use input()"],
  starterCode: "",
  solutionCode: 'print("Hello, " + input())',
  wrongAnswers: [{ label: "No name", code: 'print("Hello")' }],
};

beforeEach(() => {
  state.caller = null;
  state.admin = false;
  state.db = fakeDb();
  state.changed.mockReset();
});

function asAdmin() {
  state.caller = { userId, aal: "aal2" };
  state.admin = true;
}

const calls = [
  ["saveLesson", () => actions.saveLesson({ id: LESSON, loadedAt: LOADED, draft })],
  [
    "createLesson",
    () => actions.createLesson({ courseId: COURSE, chapterId: CHAPTER, title: "Loops" }),
  ],
  ["renderInstructionsPreview", () => actions.renderInstructionsPreview({ markdown: "## Hi" })],
] as const;

describe("lesson actions refuse everyone but an admin [FR-ADM-04, T-20]", () => {
  it.each(calls)(
    "%s: a guest, a learner and an admin at aal1 are answered not_found",
    async (_, call) => {
      expect(await call()).toEqual({ ok: false, error: "not_found" });
      for (const aal of ["aal1", "aal2"] as const) {
        state.caller = { userId, aal };
        expect(await call()).toEqual({ ok: false, error: "not_found" });
      }
      state.caller = { userId, aal: "aal1" };
      state.admin = true;
      expect(await call()).toEqual({ ok: false, error: "not_found" });
      expect(state.db.calls).toEqual([]);
    },
  );

  it("refuses an oversized, extra or malformed input before the database", async () => {
    asAdmin();
    const refused = [
      actions.saveLesson({ id: LESSON, loadedAt: "yesterday", draft }),
      actions.saveLesson({ id: LESSON, loadedAt: LOADED, draft: { ...draft, xp: 51 } }),
      actions.saveLesson({
        id: LESSON,
        loadedAt: LOADED,
        draft: { ...draft, status: "published" },
      }),
      actions.saveLesson({ id: LESSON, loadedAt: LOADED, draft, tests: [] }),
      actions.saveLesson({
        id: LESSON,
        loadedAt: LOADED,
        draft: { ...draft, solutionCode: "x".repeat(10_001) },
      }),
      actions.createLesson({ courseId: COURSE, chapterId: CHAPTER, title: " " }),
      actions.renderInstructionsPreview({ markdown: "x".repeat(20_001) }),
    ];
    for (const result of await Promise.all(refused)) {
      expect(result).toEqual({ ok: false, error: "invalid_input" });
    }
    expect(state.db.calls).toEqual([]);
  });
});

describe("saveLesson for an admin [FR-ADM-04, FR-ADM-10]", () => {
  it("saves over the loaded version, keeping the test cases and the current place", async () => {
    asAdmin();
    state.db.answer({ data: { chapter_id: CHAPTER, position: 3, tests: TESTS } }, { data: NEWER });
    expect(await actions.saveLesson({ id: LESSON, loadedAt: LOADED, draft })).toEqual({
      ok: true,
      value: { updatedAt: NEWER },
    });
    const rpc = state.db.calls[1];
    expect(rpc?.target).toBe("rpc:save_lesson");
    expect(rpc?.chain[0]?.[1][0]).toEqual({
      p_lesson_id: LESSON,
      p_loaded_updated_at: LOADED,
      p_chapter_id: CHAPTER,
      p_slug: draft.slug,
      p_title: draft.title,
      p_position: 3,
      p_xp: 10,
      p_instructions_md: draft.instructionsMd,
      p_hints: draft.hints,
      p_starter_code: "",
      p_tests: TESTS,
      p_solution_code: draft.solutionCode,
      p_wrong_answers: draft.wrongAnswers,
      p_validated: false,
    });
    expect(state.changed).toHaveBeenCalledTimes(1);
  });

  it("puts a lesson moved to another chapter last there", async () => {
    asAdmin();
    state.db.answer(
      { data: { chapter_id: OTHER_CHAPTER, position: 0, tests: [] } },
      { data: { position: 6 } },
      { data: NEWER },
    );
    await actions.saveLesson({ id: LESSON, loadedAt: LOADED, draft });
    const args = state.db.calls[2]?.chain[0]?.[1][0] as { p_position: number };
    expect(args.p_position).toBe(7);
  });

  it.each([
    [{ code: "P0001", message: "lesson_changed_since_loaded" }, "stale"],
    [{ code: "P0001", message: "lesson_not_validated" }, "needs_validation"],
    [{ code: "P0001", message: "lesson_not_found" }, "not_found"],
    [{ code: "23505", message: "duplicate key" }, "slug_taken"],
    [{ code: "23503", message: "foreign key" }, "chapter_not_found"],
    [
      { code: "23514", message: 'violates check constraint "lessons_published_complete"' },
      "published_incomplete",
    ],
    [{ code: "23514", message: 'violates check constraint "lessons_xp_check"' }, "unavailable"],
    [{ code: "XX000", message: "boom" }, "unavailable"],
  ])("answers %j as %s, and keeps the cache", async (error, reason) => {
    asAdmin();
    state.db.answer({ data: { chapter_id: CHAPTER, position: 0, tests: [] } }, { error });
    expect(await actions.saveLesson({ id: LESSON, loadedAt: LOADED, draft })).toEqual({
      ok: false,
      error: reason,
    });
    expect(state.changed).not.toHaveBeenCalled();
  });

  it("answers a lesson this session cannot read as not found, before saving", async () => {
    asAdmin();
    state.db.answer({ data: null });
    expect(await actions.saveLesson({ id: LESSON, loadedAt: LOADED, draft })).toEqual({
      ok: false,
      error: "not_found",
    });
    expect(state.db.calls).toHaveLength(1);
  });
});

describe("createLesson for an admin [FR-ADM-03]", () => {
  it("adds a draft last in its chapter, with a free address made from the title", async () => {
    asAdmin();
    state.db.answer(
      { data: { id: CHAPTER } },
      {
        data: [
          { slug: "loops", chapter_id: CHAPTER, position: 0 },
          { slug: "loops-2", chapter_id: OTHER_CHAPTER, position: 4 },
          { slug: "if", chapter_id: CHAPTER, position: 2 },
        ],
      },
      { data: { id: LESSON } },
    );
    expect(
      await actions.createLesson({ courseId: COURSE, chapterId: CHAPTER, title: "  Loops  " }),
    ).toEqual({ ok: true, value: { id: LESSON } });
    const insert = state.db.calls[2]?.chain.find(([method]) => method === "insert");
    expect(insert?.[1][0]).toEqual({
      course_id: COURSE,
      chapter_id: CHAPTER,
      title: "Loops",
      slug: "loops-3",
      position: 3,
    });
  });

  it("refuses a chapter of another course, and a title with nothing for an address", async () => {
    asAdmin();
    state.db.answer({ data: null });
    expect(
      await actions.createLesson({ courseId: COURSE, chapterId: CHAPTER, title: "Loops" }),
    ).toEqual({ ok: false, error: "chapter_not_found" });
    expect(
      await actions.createLesson({ courseId: COURSE, chapterId: CHAPTER, title: "مرحبا" }),
    ).toEqual({ ok: false, error: "slug_needed" });
  });

  it("starts an empty chapter at the first place", async () => {
    asAdmin();
    state.db.answer({ data: { id: CHAPTER } }, { data: [] }, { data: { id: LESSON } });
    await actions.createLesson({ courseId: COURSE, chapterId: CHAPTER, title: "Loops" });
    const insert = state.db.calls[2]?.chain.find(([method]) => method === "insert");
    expect(insert?.[1][0]).toMatchObject({ slug: "loops", position: 0 });
  });
});

describe("renderInstructionsPreview [NFR-SEC-07]", () => {
  it("renders with the learners' renderer and reads nothing", async () => {
    asAdmin();
    const markdown = "## Ask\n\nSay <script>alert(1)</script>hi to `input()`.";
    const result = await actions.renderInstructionsPreview({ markdown });
    const { renderMarkdown } = await import("@/content/markdown");
    expect(result).toEqual({ ok: true, value: renderMarkdown(markdown) });
    expect(JSON.stringify(result)).not.toContain("script");
    expect(state.db.calls).toEqual([]);
  });
});
