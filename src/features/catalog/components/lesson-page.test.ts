import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const publishedLesson = vi.fn();
const publishedCourse = vi.fn();
vi.mock("@/content", () => ({
  publishedLesson: (...args: unknown[]) => publishedLesson(...args) as unknown,
  publishedCourse: (...args: unknown[]) => publishedCourse(...args) as unknown,
}));
vi.mock("@/infrastructure/http/nonce", () => ({ requestNonce: () => "nonce" }));
vi.mock("next/server", () => ({ connection: () => Promise.resolve() }));

const { loadLesson } = await import("./lesson-page");

const testCase = { id: "prints-hello", name: "Prints hello", expected: "hello" };
const lesson = {
  id: "0b6f4c2e-6a0c-4a43-9a3e-2f0d6c1c9b51",
  slug: "second",
  title: "Second",
  xp: 10,
  instructionsMarkdown: "Print hello.",
  hints: ["Use print."],
  starterCode: "print()",
  tests: [testCase],
  course: { slug: "python", title: "Python" },
};
const course = {
  slug: "python",
  title: "Python",
  summary: "",
  outcomes: [],
  chapters: [
    { id: "a", title: "One", summary: "", lessons: [{ slug: "first", title: "First" }] },
    {
      id: "b",
      title: "Two",
      summary: "",
      lessons: [
        { slug: "second", title: "Second" },
        { slug: "third", title: "Third" },
      ],
    },
  ],
};

beforeEach(() => {
  publishedLesson.mockReset();
  publishedCourse.mockReset();
  publishedLesson.mockResolvedValue({ ok: true, value: lesson });
  publishedCourse.mockResolvedValue({ ok: true, value: course });
});

describe("[FR-WSP-02] loadLesson", () => {
  it("gives the lesson with parsed test cases and its neighbours across chapters", async () => {
    const loaded = await loadLesson("python", "second");
    expect(publishedLesson).toHaveBeenCalledWith("python", "second");
    expect(publishedCourse).toHaveBeenCalledWith("python");
    expect(loaded).toEqual({
      instructionsMarkdown: "Print hello.",
      lesson: {
        id: "0b6f4c2e-6a0c-4a43-9a3e-2f0d6c1c9b51",
        xp: 10,
        course: { slug: "python", title: "Python" },
        slug: "second",
        title: "Second",
        starterCode: "print()",
        hints: ["Use print."],
        tests: [
          {
            id: "prints-hello",
            name: "Prints hello",
            stdin: "",
            afterCode: "",
            expected: "hello",
            match: "normalized",
            hint: "",
          },
        ],
        neighbours: {
          previous: { slug: "first", title: "First" },
          next: { slug: "third", title: "Third" },
        },
      },
    });
  });

  it("is null when no published lesson has the address, and then reads no course (T-25)", async () => {
    publishedLesson.mockResolvedValue({ ok: true, value: null });
    expect(await loadLesson("python", "none")).toBeNull();
    expect(publishedCourse).not.toHaveBeenCalled();
  });

  it("is null when the course is not published", async () => {
    publishedCourse.mockResolvedValue({ ok: true, value: null });
    expect(await loadLesson("python", "second")).toBeNull();
  });

  it("throws, so the request ends on the error page with status 500, when the lesson's ID is not a UUID", async () => {
    publishedLesson.mockResolvedValue({ ok: true, value: { ...lesson, id: "not-a-uuid" } });
    await expect(loadLesson("python", "second")).rejects.toThrow("ID is not a UUID");
  });

  it("throws, so the request ends on the error page with status 500, when the lesson read fails", async () => {
    publishedLesson.mockResolvedValue({ ok: false });
    await expect(loadLesson("python", "second")).rejects.toThrow("a published lesson");
  });

  it("throws when the course read fails", async () => {
    publishedCourse.mockResolvedValue({ ok: false });
    await expect(loadLesson("python", "second")).rejects.toThrow("a published course");
  });

  it("throws, rather than showing a workspace that cannot check, when the stored test cases do not parse", async () => {
    publishedLesson.mockResolvedValue({ ok: true, value: { ...lesson, tests: [{ id: 1 }] } });
    await expect(loadLesson("python", "second")).rejects.toThrow("do not parse");
  });

  it("throws when the course's order does not hold the lesson", async () => {
    publishedLesson.mockResolvedValue({ ok: true, value: { ...lesson, slug: "elsewhere" } });
    await expect(loadLesson("python", "elsewhere")).rejects.toThrow("does not hold");
  });
});
