import { describe, expect, it, vi } from "vitest";
import { editorLesson } from "./lessons";

vi.mock("server-only", () => ({}));

// The lesson editor's read (FR-ADM-04): the row becomes the editor's lesson,
// with the solution whichever shape the client returned, the chapters in
// order, the test cases through the grader's parser, and the version the
// editor saves with.

const row = {
  id: "00000000-0000-4000-8000-000000000e01",
  course_id: "00000000-0000-4000-8000-000000000c01",
  chapter_id: "00000000-0000-4000-8000-000000000d02",
  title: "Ask, then answer",
  slug: "ask-then-answer",
  xp: 10,
  status: "draft",
  instructions_md: "## Ask",
  hints: ["Use input()"],
  starter_code: "",
  tests: [
    { id: "t1", name: "Greets Ada", stdin: "Ada\n", expected: "Hello, Ada" },
    {
      id: "t2",
      name: "Prints the type",
      afterCode: "print(type(x))",
      expected: "int",
      match: "exact",
    },
  ],
  updated_at: "2026-11-22T08:00:00.123456+00:00",
  lesson_solutions: { solution_code: "print(1)", wrong_answers: [{ label: "x", code: "" }] },
  courses: {
    title: "Python basics",
    chapters: [
      { id: "00000000-0000-4000-8000-000000000d02", title: "Second", position: 1 },
      { id: "00000000-0000-4000-8000-000000000d01", title: "First", position: 0 },
    ],
  },
};

describe("editorLesson [FR-ADM-04]", () => {
  it("reads the lesson, its solution, its chapters in order and its version", () => {
    expect(editorLesson(row)).toEqual({
      ok: true,
      lesson: {
        id: row.id,
        courseId: row.course_id,
        courseTitle: "Python basics",
        chapterId: row.chapter_id,
        chapters: [
          { id: "00000000-0000-4000-8000-000000000d01", title: "First" },
          { id: "00000000-0000-4000-8000-000000000d02", title: "Second" },
        ],
        title: row.title,
        slug: row.slug,
        xp: 10,
        status: "draft",
        instructionsMd: "## Ask",
        hints: ["Use input()"],
        starterCode: "",
        solutionCode: "print(1)",
        wrongAnswers: [{ label: "x", code: "" }],
        testCases: [
          {
            id: "t1",
            name: "Greets Ada",
            stdin: "Ada\n",
            afterCode: "",
            expected: "Hello, Ada",
            match: "normalized",
            hint: "",
          },
          {
            id: "t2",
            name: "Prints the type",
            stdin: "",
            afterCode: "print(type(x))",
            expected: "int",
            match: "exact",
            hint: "",
          },
        ],
        loadedAt: row.updated_at,
      },
    });
  });

  it("takes the solution from a list, and an empty one when there is none", () => {
    const listed = editorLesson({ ...row, lesson_solutions: [row.lesson_solutions] });
    expect(listed.ok && listed.lesson?.solutionCode).toBe("print(1)");
    for (const none of [null, []]) {
      const result = editorLesson({ ...row, lesson_solutions: none });
      expect(result.ok && result.lesson).toMatchObject({ solutionCode: "", wrongAnswers: [] });
    }
  });

  it("[FR-ADM-05] reads a lesson with no test case yet as an empty list", () => {
    const result = editorLesson({ ...row, tests: [] });
    expect(result.ok && result.lesson?.testCases).toEqual([]);
  });

  it("answers no row as no lesson, and a malformed row as a failed read", () => {
    expect(editorLesson(null)).toEqual({ ok: true, lesson: null });
    expect(editorLesson({ ...row, tests: [{ id: "t1" }] })).toEqual({ ok: false });
    expect(editorLesson({ ...row, status: "deleted" })).toEqual({ ok: false });
    expect(editorLesson({ ...row, courses: null })).toEqual({ ok: false });
  });
});
