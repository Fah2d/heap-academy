import { describe, expect, it } from "vitest";
import { forAll, type Generator } from "../../scripts/testing/property";
import { courseStanding } from "./course-progress";

const LESSONS = [{ id: "a" }, { id: "b" }, { id: "c" }];

describe("courseStanding", () => {
  it("[FR-CAT-02] [FR-CRS-02] begins at the first lesson with nothing completed", () => {
    expect(courseStanding(LESSONS, new Set())).toEqual({
      action: "begin",
      target: { id: "a" },
      completed: 0,
      total: 3,
      states: ["next", "open", "open"],
    });
  });

  it("[FR-CAT-02] [FR-CRS-02] continues to the next incomplete lesson", () => {
    expect(courseStanding(LESSONS, new Set(["a"]))).toEqual({
      action: "continue",
      target: { id: "b" },
      completed: 1,
      total: 3,
      states: ["completed", "next", "open"],
    });
  });

  it("[FR-CAT-02] [FR-CRS-02] continues to a skipped lesson before a later completed one", () => {
    expect(courseStanding(LESSONS, new Set(["a", "c"]))).toEqual({
      action: "continue",
      target: { id: "b" },
      completed: 2,
      total: 3,
      states: ["completed", "next", "completed"],
    });
  });

  it("[FR-CAT-02] [FR-CRS-02] continues at the first lesson when only a later one is completed", () => {
    const standing = courseStanding(LESSONS, new Set(["b"]));
    expect(standing.action).toBe("continue");
    expect(standing.target).toEqual({ id: "a" });
    expect(standing.states).toEqual(["next", "completed", "open"]);
  });

  it("[FR-CAT-02] [FR-CRS-02] reviews from the first lesson when every lesson is completed", () => {
    expect(courseStanding(LESSONS, new Set(["c", "b", "a"]))).toEqual({
      action: "review",
      target: { id: "a" },
      completed: 3,
      total: 3,
      states: ["completed", "completed", "completed"],
    });
  });

  it("[FR-CAT-02] ignores completions of lessons that are not in the course", () => {
    const standing = courseStanding(LESSONS, new Set(["x", "y", "z"]));
    expect(standing.action).toBe("begin");
    expect(standing.completed).toBe(0);
  });

  it("[FR-CAT-02] has no target for a course with no lesson", () => {
    expect(courseStanding([], new Set(["a"]))).toEqual({
      action: "begin",
      target: undefined,
      completed: 0,
      total: 0,
      states: [],
    });
  });

  const subset: Generator<Set<string>> = (random) =>
    new Set(LESSONS.filter(() => random.int(0, 1) === 1).map((lesson) => lesson.id));

  it("[FR-CRS-02] marks at most one lesson next, and it is the target unless the course is done", () => {
    forAll(subset, (completed) => {
      const standing = courseStanding(LESSONS, completed);
      const next = standing.states.flatMap((state, index) => (state === "next" ? [index] : []));
      expect(next.length).toBe(standing.action === "review" ? 0 : 1);
      if (next[0] !== undefined) expect(standing.target).toBe(LESSONS[next[0]]);
      expect(standing.states.filter((state) => state === "completed").length).toBe(
        standing.completed,
      );
    });
  });
});
