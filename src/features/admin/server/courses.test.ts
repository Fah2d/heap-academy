import { describe, expect, it, vi } from "vitest";
import { editorCourse, summarizeCourses } from "./courses";

vi.mock("server-only", () => ({}));

const id = "00000000-0000-4000-8000-0000000000c1";

describe("summarizeCourses [docs/spec/03-experience.md section 7.2]", () => {
  it("counts published and draft lessons per course, leaving archived ones out", () => {
    expect(
      summarizeCourses([
        {
          id,
          slug: "python-basics",
          title: "Python basics",
          status: "draft",
          lessons: [
            { status: "published" },
            { status: "draft" },
            { status: "draft" },
            { status: "archived" },
          ],
        },
      ]),
    ).toEqual({
      ok: true,
      courses: [
        {
          id,
          slug: "python-basics",
          title: "Python basics",
          status: "draft",
          publishedLessons: 1,
          draftLessons: 2,
        },
      ],
    });
  });

  it("returns an empty list when there are no courses", () => {
    expect(summarizeCourses([])).toEqual({ ok: true, courses: [] });
  });

  it("refuses rows that do not match the schema", () => {
    expect(summarizeCourses([{ id, slug: "x", title: "X", status: "live", lessons: [] }])).toEqual({
      ok: false,
    });
    expect(summarizeCourses(null)).toEqual({ ok: false });
  });
});

describe("editorCourse [FR-ADM-13]", () => {
  const LESSON_A = "00000000-0000-4000-8000-0000000000a1";
  const LESSON_B = "00000000-0000-4000-8000-0000000000a2";
  const row = {
    id,
    slug: "python-basics",
    title: "Python basics",
    summary: "",
    outcomes: [],
    status: "published",
    updated_at: "2026-11-27T08:00:00+00:00",
    chapters: [
      {
        id: "00000000-0000-4000-8000-0000000000b1",
        title: "First steps",
        summary: "",
        position: 1,
        updated_at: "2026-11-27T08:00:00+00:00",
        lessons: [
          { id: LESSON_A, title: "Print", status: "published", position: 1 },
          { id: LESSON_B, title: "Ask", status: "draft", position: 2 },
        ],
      },
    ],
  };
  const lessonsOf = (result: ReturnType<typeof editorCourse>) =>
    result.ok ? result.course?.chapters[0]?.lessons : undefined;

  it("gives each lesson the count the database returned, and 0 to one it has no row for", () => {
    const result = editorCourse(row, [{ lesson_id: LESSON_A, completions: 12 }]);
    expect(lessonsOf(result)?.map((lesson) => [lesson.title, lesson.completions])).toEqual([
      ["Print", 12],
      ["Ask", 0],
    ]);
  });

  it("fails the read when the counts are not what the function returns, so no number is made up", () => {
    expect(editorCourse(row, null)).toEqual({ ok: false });
    expect(editorCourse(row, [{ lesson_id: LESSON_A, completions: -1 }])).toEqual({ ok: false });
    expect(editorCourse(row, [{ lesson_id: "x", completions: 1 }])).toEqual({ ok: false });
  });

  it("still says there is no such course", () => {
    expect(editorCourse(null, [])).toEqual({ ok: true, course: null });
  });
});
