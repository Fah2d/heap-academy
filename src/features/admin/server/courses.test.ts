import { describe, expect, it, vi } from "vitest";
import { summarizeCourses } from "./courses";

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
