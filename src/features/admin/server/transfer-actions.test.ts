import { beforeEach, describe, expect, it, vi } from "vitest";
import { type Identity, parseUserId } from "@/domain/auth/identity";
import type { RequestId } from "@/infrastructure/http/request-id";
import { type FakeDb, fakeDb } from "../../../../scripts/testing/fake-db";
import { type CourseFile, type LessonFile, parseLessonFileText } from "../lesson-file";

// Export and import through the real action wrapper (FR-ADM-12, T-20, T-23):
// anyone but an admin at aal2 is answered as for a missing action and the
// database is never asked; an exported lesson imports as an identical draft,
// never marked validated; a malformed lesson is refused before the database.

vi.mock("server-only", () => ({}));

const state = vi.hoisted(() => ({
  caller: null as Identity | null,
  admin: false,
  db: null as unknown as FakeDb,
}));

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

const actions = await import("./transfer-actions");

const userId = parseUserId("00000000-0000-4000-8000-000000000002")!;
const COURSE = "00000000-0000-4000-8000-000000000c01";
const CHAPTER = "00000000-0000-4000-8000-000000000d01";
const OTHER_CHAPTER = "00000000-0000-4000-8000-000000000d02";
const LESSON = "00000000-0000-4000-8000-000000000e01";
const SECOND = "00000000-0000-4000-8000-000000000e02";
const CREATED = "2026-11-25T08:00:00.123456+00:00";
const SAVED = "2026-11-25T08:00:00.234567+00:00";

const lessonRow = {
  id: LESSON,
  position: 0,
  title: "Say hello by name",
  slug: "say-hello-by-name",
  xp: 10,
  instructions_md: "## Ask, then answer",
  hints: ["Store the answer first."],
  starter_code: "# Ask\n",
  tests: [{ id: "greets", name: "Greets Sara", stdin: "Sara\n", expected: "Hello, Sara!" }],
  lesson_solutions: {
    solution_code: 'print("Hello, " + input() + "!")',
    wrong_answers: [{ label: "fixed name", code: 'print("Hello, Sara!")' }],
  },
};

/** The course as the export query returns it: rows out of order, a draft with no solution row. */
const courseRow = {
  title: "Python basics",
  slug: "python-basics",
  summary: "Write your first programs.",
  outcomes: ["Print text"],
  chapters: [
    {
      id: OTHER_CHAPTER,
      position: 1,
      title: "Second",
      summary: "",
      lessons: [],
    },
    {
      id: CHAPTER,
      position: 0,
      title: "First steps",
      summary: "Start here",
      lessons: [
        {
          ...lessonRow,
          id: SECOND,
          position: 1,
          title: "Empty draft",
          slug: "empty-draft",
          tests: [],
          lesson_solutions: [],
        },
        lessonRow,
      ],
    },
  ],
};

beforeEach(() => {
  state.caller = null;
  state.admin = false;
  state.db = fakeDb();
});

function asAdmin() {
  state.caller = { userId, aal: "aal2" };
  state.admin = true;
}

async function exportedFile(): Promise<CourseFile> {
  state.db.answer({ data: courseRow });
  const result = await actions.exportCourse({ id: COURSE });
  if (!result.ok) throw new Error(result.error);
  return JSON.parse(result.value.text) as CourseFile;
}

const anyLesson = { format: "heap-academy.lesson" };
const calls = [
  ["exportCourse", () => actions.exportCourse({ id: COURSE })],
  [
    "importLesson",
    () => actions.importLesson({ courseId: COURSE, chapterId: CHAPTER, lesson: anyLesson }),
  ],
] as const;

describe("export and import refuse everyone but an admin [FR-ADM-12, T-20, T-23]", () => {
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
});

describe("exportCourse [FR-ADM-12]", () => {
  it("writes every chapter and lesson in order, solutions included, as one file named by the address", async () => {
    asAdmin();
    state.db.answer({ data: courseRow });
    const result = await actions.exportCourse({ id: COURSE });
    expect(result.ok && result.value.fileName).toBe("python-basics.json");
    const file = JSON.parse(result.ok ? result.value.text : "null") as CourseFile;
    expect(file.format).toBe("heap-academy.course");
    expect(file.chapters.map((chapter) => chapter.title)).toEqual(["First steps", "Second"]);
    expect(file.chapters[0]?.lessons.map((lesson) => lesson.title)).toEqual([
      "Say hello by name",
      "Empty draft",
    ]);
    expect(file.chapters[0]?.lessons[0]).toMatchObject({
      solution_code: lessonRow.lesson_solutions.solution_code,
      wrong_answers: lessonRow.lesson_solutions.wrong_answers,
      tests: [{ id: "greets", afterCode: "", match: "normalized", hint: "" }],
    });
    expect(file.chapters[0]?.lessons[1]).toMatchObject({
      solution_code: "",
      wrong_answers: [],
      tests: [],
    });
    // The file names no row: no IDs, no status.
    expect(result.ok && result.value.text).not.toContain(LESSON);
    expect(result.ok && result.value.text).not.toContain('"status"');
    const query = state.db.calls[0];
    expect(query?.target).toBe("courses");
    expect(query?.chain).toContainEqual(["eq", ["id", COURSE]]);
  });

  it("answers not_found for no course, and unavailable for a failed or broken read", async () => {
    asAdmin();
    state.db.answer(
      { data: null },
      { error: { code: "XX000", message: "boom" } },
      { data: { ...courseRow, chapters: "none" } },
      {
        data: {
          ...courseRow,
          chapters: [{ ...courseRow.chapters[1], lessons: [{ ...lessonRow, tests: [{}] }] }],
        },
      },
    );
    expect(await actions.exportCourse({ id: COURSE })).toEqual({ ok: false, error: "not_found" });
    for (let n = 0; n < 3; n += 1) {
      expect(await actions.exportCourse({ id: COURSE })).toEqual({
        ok: false,
        error: "unavailable",
      });
    }
  });
});

describe("importLesson [FR-ADM-12, T-23]", () => {
  async function exportedLesson(): Promise<LessonFile> {
    const lesson = (await exportedFile()).chapters[0]?.lessons[0];
    const parsed = parseLessonFileText(JSON.stringify(lesson));
    if (!parsed.ok) throw new Error("fixture");
    state.db = fakeDb();
    return parsed.lesson;
  }

  it("imports an exported lesson as an identical draft, last in the chapter, not validated", async () => {
    asAdmin();
    const lesson = await exportedLesson();
    state.db.answer(
      { data: { id: OTHER_CHAPTER } },
      { data: [{ slug: "loops", chapter_id: OTHER_CHAPTER, position: 2 }] },
      { data: { id: LESSON, updated_at: CREATED } },
      { data: SAVED },
    );
    expect(
      await actions.importLesson({ courseId: COURSE, chapterId: OTHER_CHAPTER, lesson }),
    ).toEqual({ ok: true, value: { id: LESSON, slug: "say-hello-by-name" } });
    expect(state.db.calls[0]?.chain).toContainEqual(["eq", ["course_id", COURSE]]);
    const insert = state.db.calls[2]?.chain.find(([method]) => method === "insert");
    expect(insert?.[1][0]).toEqual({
      course_id: COURSE,
      chapter_id: OTHER_CHAPTER,
      title: "Say hello by name",
      slug: "say-hello-by-name",
      position: 3,
    });
    const rpc = state.db.calls[3];
    expect(rpc?.target).toBe("rpc:save_lesson");
    expect(rpc?.chain[0]?.[1][0]).toEqual({
      p_lesson_id: LESSON,
      p_loaded_updated_at: CREATED,
      p_chapter_id: OTHER_CHAPTER,
      p_slug: "say-hello-by-name",
      p_title: lessonRow.title,
      p_position: 3,
      p_xp: lessonRow.xp,
      p_instructions_md: lessonRow.instructions_md,
      p_hints: lessonRow.hints,
      p_starter_code: lessonRow.starter_code,
      p_tests: [
        {
          id: "greets",
          name: "Greets Sara",
          stdin: "Sara\n",
          afterCode: "",
          expected: "Hello, Sara!",
          match: "normalized",
          hint: "",
        },
      ],
      p_solution_code: lessonRow.lesson_solutions.solution_code,
      p_wrong_answers: lessonRow.lesson_solutions.wrong_answers,
      p_validated: false,
    });
    expect(state.db.calls).toHaveLength(4);
  });

  it("gives the draft the next free address when the course already uses the file's", async () => {
    asAdmin();
    const lesson = await exportedLesson();
    state.db.answer(
      { data: { id: CHAPTER } },
      {
        data: [
          { slug: "say-hello-by-name", chapter_id: CHAPTER, position: 0 },
          { slug: "say-hello-by-name-2", chapter_id: OTHER_CHAPTER, position: 0 },
        ],
      },
      { data: { id: LESSON, updated_at: CREATED } },
      { data: SAVED },
    );
    expect(await actions.importLesson({ courseId: COURSE, chapterId: CHAPTER, lesson })).toEqual({
      ok: true,
      value: { id: LESSON, slug: "say-hello-by-name-3" },
    });
    const rpc = state.db.calls[3]?.chain[0]?.[1][0] as { p_slug: string; p_position: number };
    expect(rpc.p_slug).toBe("say-hello-by-name-3");
    expect(rpc.p_position).toBe(1);
  });

  it("deletes the new row again when filling it fails", async () => {
    asAdmin();
    const lesson = await exportedLesson();
    state.db.answer(
      { data: { id: CHAPTER } },
      { data: [] },
      { data: { id: LESSON, updated_at: CREATED } },
      { error: { code: "23514", message: "new row violates check constraint" } },
      { data: null },
    );
    expect(await actions.importLesson({ courseId: COURSE, chapterId: CHAPTER, lesson })).toEqual({
      ok: false,
      error: "unavailable",
    });
    const cleanup = state.db.calls[4];
    expect(cleanup?.target).toBe("lessons");
    expect(cleanup?.chain).toEqual([
      ["delete", []],
      ["eq", ["id", LESSON]],
    ]);
  });

  it("refuses a chapter of another course, and a failed insert, with nothing left behind", async () => {
    asAdmin();
    const lesson = await exportedLesson();
    state.db.answer({ data: null });
    expect(await actions.importLesson({ courseId: COURSE, chapterId: CHAPTER, lesson })).toEqual({
      ok: false,
      error: "chapter_not_found",
    });
    state.db.answer(
      { data: { id: CHAPTER } },
      { data: [] },
      { error: { code: "23505", message: "duplicate key" } },
    );
    expect(await actions.importLesson({ courseId: COURSE, chapterId: CHAPTER, lesson })).toEqual({
      ok: false,
      error: "unavailable",
    });
    expect(state.db.calls.some((call) => call.target === "rpc:save_lesson")).toBe(false);
  });

  it("refuses a malformed lesson before the database", async () => {
    asAdmin();
    const lesson = await exportedLesson();
    for (const bad of [
      null,
      "lesson",
      { ...lesson, xp: 99 },
      { ...lesson, validated: true },
      { ...lesson, tests: [{ id: "x", name: "No output" }] },
    ]) {
      expect(
        await actions.importLesson({ courseId: COURSE, chapterId: CHAPTER, lesson: bad }),
      ).toEqual({ ok: false, error: "invalid_file" });
    }
    expect(await actions.importLesson({ courseId: "course", chapterId: CHAPTER, lesson })).toEqual({
      ok: false,
      error: "invalid_input",
    });
    expect(
      await actions.importLesson({
        courseId: COURSE,
        chapterId: CHAPTER,
        lesson: { ...lesson, instructions_md: "x".repeat(800_000) },
      }),
    ).toEqual({ ok: false, error: "invalid_input" });
    expect(state.db.calls).toEqual([]);
  });
});
