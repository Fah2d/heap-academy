import { describe, expect, it, vi } from "vitest";
import { lessonForPreview, previewLesson } from "./lesson-preview";

vi.mock("server-only", () => ({}));

// The preview's read (FR-ADM-08): the row becomes the workspace's lesson,
// with the test cases through the grader's parser, no previous or next, and
// nothing of the solution, which the read does not even name.

const row = {
  id: "00000000-0000-4000-8000-000000000e01",
  title: "Ask, then answer",
  slug: "ask-then-answer",
  xp: 10,
  instructions_md: "## Ask",
  hints: ["Use input()"],
  starter_code: "name = input()",
  tests: [{ id: "t1", name: "Greets Ada", stdin: "Ada\n", expected: "Hello, Ada" }],
  courses: { slug: "python-basics", title: "Python basics" },
};

describe("previewLesson [FR-ADM-08]", () => {
  it("reads the lesson as the workspace takes it", () => {
    const result = previewLesson(row);
    expect(result).toMatchObject({
      ok: true,
      lesson: {
        instructionsMd: "## Ask",
        lesson: {
          id: row.id,
          xp: 10,
          course: { slug: "python-basics", title: "Python basics" },
          slug: row.slug,
          title: row.title,
          starterCode: "name = input()",
          hints: ["Use input()"],
          neighbours: { previous: null, next: null },
        },
      },
    });
    expect(result.ok && result.lesson?.lesson.tests.map((test) => test.id)).toEqual(["t1"]);
  });

  it("takes a draft with no test case yet", () => {
    const result = previewLesson({ ...row, tests: [] });
    expect(result.ok && result.lesson?.lesson.tests).toEqual([]);
  });

  it("answers no lesson for no row, so the page answers not-found", () => {
    expect(previewLesson(null)).toEqual({ ok: true, lesson: null });
  });

  it.each([
    ["a test case that does not parse", { ...row, tests: [{ id: "t1" }] }],
    ["an ID that is not a UUID", { ...row, id: "lesson-1" }],
    ["a missing course", { ...row, courses: null }],
  ])("refuses %s", (_, value) => {
    expect(previewLesson(value)).toEqual({ ok: false });
  });
});

describe("lessonForPreview [FR-ADM-08]", () => {
  function client(answer: { data: unknown; error: unknown }) {
    const calls: { select?: string; eq?: [string, string] } = {};
    const query = {
      select: (columns: string) => {
        calls.select = columns;
        return query;
      },
      eq: (column: string, value: string) => {
        calls.eq = [column, value];
        return query;
      },
      maybeSingle: () => Promise.resolve(answer),
    };
    const db = { from: (table: string) => (table === "lessons" ? query : undefined) };
    return { db: db as never, calls };
  }

  it("reads one lesson by ID and names no solution or wrong answer", async () => {
    const { db, calls } = client({ data: row, error: null });
    const result = await lessonForPreview(db, row.id);
    expect(result.ok).toBe(true);
    expect(calls.eq).toEqual(["id", row.id]);
    expect(calls.select).not.toMatch(/solution|wrong/);
  });

  it("is a failure when the database answers with an error", async () => {
    const { db } = client({ data: null, error: { message: "down" } });
    expect(await lessonForPreview(db, row.id)).toEqual({ ok: false });
  });
});
