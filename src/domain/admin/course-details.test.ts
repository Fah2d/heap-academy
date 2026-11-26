import { describe, expect, it } from "vitest";
import { checkCourseFields, courseDetails } from "./course-details";

// The details check the editor runs before it sends (FR-ADM-03,
// docs/spec/04-content-system.md section 1.1).

const fields = {
  title: "Python basics",
  slug: "python-basics",
  summary: "Write your first programs.",
  outcomes: ["Print a line", "", "", "", ""],
};

describe("checkCourseFields [FR-ADM-03]", () => {
  it("trims, drops empty outcome lines, and returns what the action accepts", () => {
    const checked = checkCourseFields({ ...fields, title: "  Python basics " });
    expect(checked).toEqual({
      ok: true,
      details: { ...fields, outcomes: ["Print a line"] },
    });
    expect(checked.ok && courseDetails.safeParse(checked.details).success).toBe(true);
  });

  it("checks only the four fields when handed a whole course", () => {
    const course = { ...fields, id: "c1", status: "draft", loadedAt: "2026-11-21", chapters: [] };
    expect(checkCourseFields(course)).toEqual({
      ok: true,
      details: { ...fields, outcomes: ["Print a line"] },
    });
  });

  it("names every field that is wrong, with the outcome's line", () => {
    expect(
      checkCourseFields({
        title: " ",
        slug: "Python Basics",
        summary: "x".repeat(141),
        outcomes: ["fine", "y".repeat(141), "", "", ""],
      }),
    ).toEqual({
      ok: false,
      invalid: [
        { field: "title" },
        { field: "slug" },
        { field: "summary" },
        { field: "outcome", index: 1 },
      ],
    });
  });

  it("accepts the limits and refuses one past them", () => {
    expect(checkCourseFields({ ...fields, title: "t".repeat(60) }).ok).toBe(true);
    expect(checkCourseFields({ ...fields, title: "t".repeat(61) }).ok).toBe(false);
    expect(checkCourseFields({ ...fields, slug: "a".repeat(60) }).ok).toBe(true);
    expect(checkCourseFields({ ...fields, slug: "a".repeat(61) }).ok).toBe(false);
    expect(checkCourseFields({ ...fields, slug: "a--b" }).ok).toBe(false);
    expect(checkCourseFields({ ...fields, slug: "-a" }).ok).toBe(false);
    expect(checkCourseFields({ ...fields, summary: "s".repeat(140) }).ok).toBe(true);
  });

  it("refuses a sixth outcome", () => {
    expect(checkCourseFields({ ...fields, outcomes: ["a", "b", "c", "d", "e", "f"] })).toEqual({
      ok: false,
      invalid: [{ field: "outcome", index: 5 }],
    });
  });
});
