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
/** TESTS as the grader's parser gives them back: every field present. */
const SAVED_TESTS = [
  {
    id: "t1",
    name: "Greets",
    stdin: "",
    afterCode: "",
    expected: "Hello, Ada",
    match: "normalized",
    hint: "",
  },
];

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
  [
    "saveLesson",
    () => actions.saveLesson({ id: LESSON, loadedAt: LOADED, draft, testCases: TESTS }),
  ],
  [
    "setLessonStatus",
    () => actions.setLessonStatus({ id: LESSON, loadedAt: LOADED, status: "published" }),
  ],
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
      actions.saveLesson({ id: LESSON, loadedAt: "yesterday", draft, testCases: TESTS }),
      actions.saveLesson({
        id: LESSON,
        loadedAt: LOADED,
        draft: { ...draft, xp: 51 },
        testCases: TESTS,
      }),
      actions.saveLesson({
        id: LESSON,
        loadedAt: LOADED,
        draft: { ...draft, status: "published" },
        testCases: TESTS,
      }),
      actions.saveLesson({ id: LESSON, loadedAt: LOADED, draft }),
      actions.saveLesson({ id: LESSON, loadedAt: LOADED, draft, testCases: TESTS, tests: [] }),
      actions.saveLesson({
        id: LESSON,
        loadedAt: LOADED,
        draft: { ...draft, solutionCode: "x".repeat(10_001) },
        testCases: TESTS,
      }),
      actions.saveLesson({
        id: LESSON,
        loadedAt: LOADED,
        draft,
        testCases: TESTS,
        validatedHash: "not-a-hash",
      }),
      actions.setLessonStatus({ id: LESSON, loadedAt: LOADED, status: "deleted" }),
      actions.setLessonStatus({ id: "lesson", loadedAt: LOADED, status: "draft" }),
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
  it("[FR-ADM-05] saves over the loaded version with the test cases it is given, in the current place", async () => {
    asAdmin();
    state.db.answer({ data: { chapter_id: CHAPTER, position: 3 } }, { data: NEWER });
    expect(
      await actions.saveLesson({ id: LESSON, loadedAt: LOADED, draft, testCases: TESTS }),
    ).toEqual({
      ok: true,
      value: { updatedAt: NEWER, validated: false },
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
      p_tests: SAVED_TESTS,
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
    await actions.saveLesson({ id: LESSON, loadedAt: LOADED, draft, testCases: TESTS });
    const args = state.db.calls[2]?.chain[0]?.[1][0] as { p_position: number };
    expect(args.p_position).toBe(7);
  });

  it("[FR-ADM-10] saves nothing when the new chapter's last place cannot be read", async () => {
    asAdmin();
    state.db.answer(
      { data: { chapter_id: OTHER_CHAPTER, position: 0, tests: [] } },
      { error: { code: "XX000", message: "boom" } },
    );
    expect(
      await actions.saveLesson({ id: LESSON, loadedAt: LOADED, draft, testCases: TESTS }),
    ).toEqual({
      ok: false,
      error: "unavailable",
    });
    expect(state.db.calls).toHaveLength(2);
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
    expect(
      await actions.saveLesson({ id: LESSON, loadedAt: LOADED, draft, testCases: TESTS }),
    ).toEqual({
      ok: false,
      error: reason,
    });
    expect(state.changed).not.toHaveBeenCalled();
  });

  it("answers a lesson this session cannot read as not found, before saving", async () => {
    asAdmin();
    state.db.answer({ data: null });
    expect(
      await actions.saveLesson({ id: LESSON, loadedAt: LOADED, draft, testCases: TESTS }),
    ).toEqual({
      ok: false,
      error: "not_found",
    });
    expect(state.db.calls).toHaveLength(1);
  });
});

describe("saveLesson's test cases and validation [FR-ADM-05, FR-ADM-07]", () => {
  const testCase = (id: string) => ({ id, name: `Case ${id}`, expected: "ok" });

  it.each([
    ["13 test cases", Array.from({ length: 13 }, (_, index) => testCase(`t${index}`))],
    ["a repeated ID", [testCase("t1"), testCase("t1")]],
    [
      "an expected output over 5,000 characters",
      [{ ...testCase("t1"), expected: "x".repeat(5_001) }],
    ],
    ["an unknown field", [{ ...testCase("t1"), secret: "x" }]],
    ["an unknown comparison", [{ ...testCase("t1"), match: "regex" }]],
    ["a blank name", [{ ...testCase("t1"), name: "  " }]],
  ])("refuses %s before the database", async (_, testCases) => {
    asAdmin();
    expect(await actions.saveLesson({ id: LESSON, loadedAt: LOADED, draft, testCases })).toEqual({
      ok: false,
      error: "invalid_input",
    });
    expect(state.db.calls).toEqual([]);
  });

  it("saves a draft with no test case", async () => {
    asAdmin();
    state.db.answer({ data: { chapter_id: CHAPTER, position: 0 } }, { data: NEWER });
    const result = await actions.saveLesson({ id: LESSON, loadedAt: LOADED, draft, testCases: [] });
    expect(result).toEqual({ ok: true, value: { updatedAt: NEWER, validated: false } });
    const args = state.db.calls[1]?.chain[0]?.[1][0] as { p_tests: unknown };
    expect(args.p_tests).toEqual([]);
  });

  it("reports the save validated when the hash is of exactly what is saved", async () => {
    asAdmin();
    const { gradableHash } = await import("../gradable-hash");
    const validatedHash = await gradableHash({
      starterCode: draft.starterCode,
      solutionCode: draft.solutionCode,
      wrongAnswers: draft.wrongAnswers,
      testCases: SAVED_TESTS as never,
    });
    state.db.answer({ data: { chapter_id: CHAPTER, position: 0 } }, { data: NEWER });
    const result = await actions.saveLesson({
      id: LESSON,
      loadedAt: LOADED,
      draft,
      testCases: TESTS,
      validatedHash,
    });
    expect(result).toEqual({ ok: true, value: { updatedAt: NEWER, validated: true } });
    const args = state.db.calls[1]?.chain[0]?.[1][0] as { p_validated: boolean };
    expect(args.p_validated).toBe(true);
  });

  it("[T-22] does not report validated when the hash is of other content, so a published lesson's save is refused", async () => {
    asAdmin();
    const { gradableHash } = await import("../gradable-hash");
    const validatedHash = await gradableHash({
      starterCode: draft.starterCode,
      solutionCode: "print('something else')",
      wrongAnswers: draft.wrongAnswers,
      testCases: SAVED_TESTS as never,
    });
    state.db.answer(
      { data: { chapter_id: CHAPTER, position: 0 } },
      { error: { code: "P0001", message: "lesson_not_validated" } },
    );
    const result = await actions.saveLesson({
      id: LESSON,
      loadedAt: LOADED,
      draft,
      testCases: TESTS,
      validatedHash,
    });
    expect(result).toEqual({ ok: false, error: "needs_validation" });
    const args = state.db.calls[1]?.chain[0]?.[1][0] as { p_validated: boolean };
    expect(args.p_validated).toBe(false);
  });
});

describe("setLessonStatus for an admin [FR-ADM-07, FR-ADM-09]", () => {
  it("publishes the version the editor loaded, and expires the published content", async () => {
    asAdmin();
    state.db.answer({ data: { status: "draft" } }, { data: { updated_at: NEWER } });
    expect(
      await actions.setLessonStatus({ id: LESSON, loadedAt: LOADED, status: "published" }),
    ).toEqual({ ok: true, value: { updatedAt: NEWER } });
    const update = state.db.calls[1];
    expect(update?.target).toBe("lessons");
    expect(update?.chain).toEqual([
      ["update", [{ status: "published" }]],
      ["eq", ["id", LESSON]],
      ["eq", ["updated_at", LOADED]],
      ["select", ["updated_at"]],
      ["maybeSingle", []],
    ]);
    expect(state.changed).toHaveBeenCalledTimes(1);
  });

  it("[T-22] answers a lesson the database finds not validated since its last change as needs_validation", async () => {
    asAdmin();
    state.db.answer(
      { data: { status: "draft" } },
      { error: { code: "P0001", message: "lesson_not_validated" } },
    );
    expect(
      await actions.setLessonStatus({ id: LESSON, loadedAt: LOADED, status: "published" }),
    ).toEqual({ ok: false, error: "needs_validation" });
    expect(state.changed).not.toHaveBeenCalled();
  });

  it("refuses a move the states do not allow, before writing", async () => {
    asAdmin();
    state.db.answer({ data: { status: "archived" } });
    expect(
      await actions.setLessonStatus({ id: LESSON, loadedAt: LOADED, status: "published" }),
    ).toEqual({ ok: false, error: "status_not_allowed" });
    expect(state.db.calls).toHaveLength(1);
  });

  it("[FR-ADM-10] answers a newer version as stale, and a lesson that is gone as not found", async () => {
    asAdmin();
    state.db.answer({ data: { status: "published" } }, { data: null }, { data: { id: LESSON } });
    expect(
      await actions.setLessonStatus({ id: LESSON, loadedAt: LOADED, status: "archived" }),
    ).toEqual({ ok: false, error: "stale" });
    state.db.answer({ data: null });
    expect(
      await actions.setLessonStatus({ id: LESSON, loadedAt: LOADED, status: "draft" }),
    ).toEqual({ ok: false, error: "not_found" });
  });

  it("answers a failed read as unavailable, not as gone", async () => {
    asAdmin();
    state.db.answer({ error: { code: "XX000", message: "boom" } });
    expect(
      await actions.setLessonStatus({ id: LESSON, loadedAt: LOADED, status: "draft" }),
    ).toEqual({ ok: false, error: "unavailable" });
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

  it("says the chapter could not be read, not that it is gone, when its lookup fails", async () => {
    asAdmin();
    state.db.answer({ error: { code: "XX000", message: "boom" } });
    expect(
      await actions.createLesson({ courseId: COURSE, chapterId: CHAPTER, title: "Loops" }),
    ).toEqual({ ok: false, error: "unavailable" });
  });

  it("answers an address taken by a lesson added at the same moment as a failure to retry", async () => {
    asAdmin();
    state.db.answer(
      { data: { id: CHAPTER } },
      { data: [] },
      { error: { code: "23505", message: "duplicate key" } },
    );
    expect(
      await actions.createLesson({ courseId: COURSE, chapterId: CHAPTER, title: "Loops" }),
    ).toEqual({ ok: false, error: "unavailable" });
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
