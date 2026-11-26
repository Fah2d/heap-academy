import { describe, expect, it } from "vitest";
import { lessonNeighbours } from "./neighbours";

// Previous and next follow the course's order across chapters (FR-WSP-11).

const chapters = [
  {
    lessons: [
      { slug: "a", title: "A" },
      { slug: "b", title: "B" },
    ],
  },
  { lessons: [] },
  { lessons: [{ slug: "c", title: "C" }] },
];

describe("lessonNeighbours [FR-WSP-11]", () => {
  it("gives the lessons before and after, across chapters and past an empty one", () => {
    expect(lessonNeighbours(chapters, "b")).toEqual({
      previous: { slug: "a", title: "A" },
      next: { slug: "c", title: "C" },
    });
  });

  it("has no previous lesson for the first and no next lesson for the last", () => {
    expect(lessonNeighbours(chapters, "a")).toEqual({
      previous: null,
      next: { slug: "b", title: "B" },
    });
    expect(lessonNeighbours(chapters, "c")).toEqual({
      previous: { slug: "b", title: "B" },
      next: null,
    });
  });

  it("has neither for a course with one lesson", () => {
    expect(lessonNeighbours([{ lessons: [{ slug: "a", title: "A" }] }], "a")).toEqual({
      previous: null,
      next: null,
    });
  });

  it("answers undefined for a lesson that is not in the course", () => {
    expect(lessonNeighbours(chapters, "z")).toBeUndefined();
  });
});
