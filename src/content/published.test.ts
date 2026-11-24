import { beforeEach, describe, expect, it, vi } from "vitest";
import { fakeDb, type FakeDb } from "../../scripts/testing/fake-db";

// Published content for public pages (FR-ADM-11, docs/spec/02-architecture.md
// section 7.3): read with the session-less client, kept under one tag for at
// most a minute, and expired by an admin's change. A failed read is never
// kept and reaches the page as a failure.

vi.mock("server-only", () => ({}));

const state = vi.hoisted(() => ({
  db: null as unknown as FakeDb,
  cacheOptions: [] as unknown[],
  updated: [] as string[],
}));

vi.mock("next/cache", () => ({
  unstable_cache: (read: (...args: unknown[]) => unknown, _keys: unknown, options: unknown) => {
    state.cacheOptions.push(options);
    return read;
  },
  updateTag: (tag: string) => state.updated.push(tag),
}));
vi.mock("@/infrastructure/db/public-client", () => ({
  createPublicClient: () => state.db,
  publicDatabaseAddress: () => "http://127.0.0.1:54321",
}));
const logged = vi.hoisted(() => [] as unknown[]);
vi.mock("@/infrastructure/logging/logger", () => ({ log: (entry: unknown) => logged.push(entry) }));

const content = await import("./index");

/** The course list's answer naming `slug`, read before a course page. */
function listed(slug: string) {
  return { data: [{ slug, title: "Listed", summary: "S", chapters: [chapter(0, ["a"])] }] };
}

/** A lesson's ID in these tests, from its one-letter slug. */
function lessonId(slug: string): string {
  return `00000000-0000-4000-8000-0000000001${slug.charCodeAt(0).toString(16)}`;
}

/** A chapter as the course list reads it, its lessons at positions 0, 1, ... */
function chapter(position: number, slugs: string[]) {
  return {
    position,
    lessons: slugs.map((slug, index) => ({ id: lessonId(slug), slug, position: index })),
  };
}

const ids = (...slugs: string[]) => slugs.map((slug) => ({ id: lessonId(slug), slug }));

beforeEach(() => {
  state.db = fakeDb();
  state.updated.length = 0;
  logged.length = 0;
});

describe("published content [FR-ADM-11]", () => {
  it("is cached under the content tag for at most a minute", () => {
    expect(state.cacheOptions).toEqual([
      { tags: ["content"], revalidate: 60 },
      { tags: ["content"], revalidate: 60 },
      { tags: ["content"], revalidate: 60 },
    ]);
  });

  it("lists published courses in order with their published lesson counts", async () => {
    state.db.answer({
      data: [
        { slug: "one", title: "One", summary: "S1", chapters: [chapter(0, ["a", "b"])] },
        { slug: "three", title: "Three", summary: "S3", chapters: [chapter(0, ["c"])] },
      ],
    });
    expect(await content.publishedCourses()).toEqual({
      ok: true,
      value: [
        { slug: "one", title: "One", summary: "S1", lessonCount: 2, lessons: ids("a", "b") },
        { slug: "three", title: "Three", summary: "S3", lessonCount: 1, lessons: ids("c") },
      ],
    });
    expect(state.db.calls[0]?.chain).toEqual([
      ["select", ["slug, title, summary, chapters(position, lessons(id, slug, position))"]],
      ["order", ["position"]],
      ["order", ["title"]],
    ]);
  });

  it("[FR-CAT-02] lists a course's lessons in course order, across chapters", async () => {
    const second = chapter(1, ["c"]);
    const first = chapter(0, ["a", "b"]);
    state.db.answer({
      data: [
        {
          slug: "one",
          title: "One",
          summary: "S1",
          chapters: [second, { ...first, lessons: [...first.lessons].reverse() }],
        },
      ],
    });
    const result = await content.publishedCourses();
    expect(result.ok && result.value[0]?.lessons).toEqual(ids("a", "b", "c"));
  });

  it("puts a course's chapters and lessons in their positions", async () => {
    state.db.answer(listed("one"), {
      data: {
        slug: "one",
        title: "One",
        summary: "S",
        outcomes: ["Print"],
        chapters: [
          {
            id: "00000000-0000-4000-8000-000000000d02",
            title: "Second",
            summary: "",
            position: 1,
            lessons: [{ id: lessonId("c"), slug: "c", title: "C", xp: 10, position: 0 }],
          },
          {
            id: "00000000-0000-4000-8000-000000000d01",
            title: "First",
            summary: "",
            position: 0,
            lessons: [
              { id: lessonId("b"), slug: "b", title: "B", xp: 20, position: 1 },
              { id: lessonId("a"), slug: "a", title: "A", xp: 10, position: 0 },
            ],
          },
        ],
      },
    });
    const result = await content.publishedCourse("one");
    expect(result.ok && result.value?.chapters.map((chapter) => chapter.title)).toEqual([
      "First",
      "Second",
    ]);
    expect(result.ok && result.value?.chapters[0]?.lessons).toEqual([
      { id: lessonId("a"), slug: "a", title: "A", xp: 10 },
      { id: lessonId("b"), slug: "b", title: "B", xp: 20 },
    ]);
    expect(state.db.calls[1]?.chain).toContainEqual(["eq", ["slug", "one"]]);
  });

  it("[FR-CAT-04] leaves out a course with no published lesson", async () => {
    state.db.answer({
      data: [
        { slug: "empty", title: "Empty", summary: "S0", chapters: [chapter(0, [])] },
        { slug: "none", title: "None", summary: "S2", chapters: [] },
        { slug: "one", title: "One", summary: "S1", chapters: [chapter(0, ["a"])] },
      ],
    });
    expect(await content.publishedCourses()).toEqual({
      ok: true,
      value: [{ slug: "one", title: "One", summary: "S1", lessonCount: 1, lessons: ids("a") }],
    });
  });

  it("[FR-CAT-04] answers null for a published course with no published lesson", async () => {
    state.db.answer(listed("empty"), {
      data: {
        slug: "empty",
        title: "Empty",
        summary: "S",
        outcomes: [],
        chapters: [
          {
            id: "00000000-0000-4000-8000-000000000d01",
            title: "First",
            summary: "",
            position: 0,
            lessons: [],
          },
        ],
      },
    });
    expect(await content.publishedCourse("empty")).toEqual({ ok: true, value: null });
  });

  it("[FR-CRS-01] leaves out a chapter with no published lesson", async () => {
    state.db.answer(listed("one"), {
      data: {
        slug: "one",
        title: "One",
        summary: "S",
        outcomes: [],
        chapters: [
          {
            id: "00000000-0000-4000-8000-000000000d01",
            title: "Drafts only",
            summary: "",
            position: 0,
            lessons: [],
          },
          {
            id: "00000000-0000-4000-8000-000000000d02",
            title: "Ready",
            summary: "",
            position: 1,
            lessons: [{ id: lessonId("a"), slug: "a", title: "A", xp: 10, position: 0 }],
          },
        ],
      },
    });
    const result = await content.publishedCourse("one");
    expect(result.ok && result.value?.chapters.map((chapter) => chapter.title)).toEqual(["Ready"]);
  });

  it("answers null for a listed course whose own read finds nothing", async () => {
    state.db.answer(listed("draft-course"), { data: null });
    expect(await content.publishedCourse("draft-course")).toEqual({ ok: true, value: null });
  });

  it("[T-14] answers a well-formed address missing from the course list with no course query", async () => {
    state.db.answer(listed("one"));
    expect(await content.publishedCourse("made-up-course")).toEqual({ ok: true, value: null });
    expect(state.db.calls).toHaveLength(1);
    expect(state.db.calls[0]?.chain).not.toContainEqual(["eq", ["slug", "made-up-course"]]);
  });

  it("answers a failure for a course page when the course list cannot be read", async () => {
    state.db.answer({ error: { code: "57014" } });
    expect(await content.publishedCourse("one")).toEqual({ ok: false });
    expect(state.db.calls).toHaveLength(1);
  });

  it("turns a database error or an unexpected shape into a failure", async () => {
    state.db.answer({ error: { code: "57014" } });
    expect(await content.publishedCourses()).toEqual({ ok: false });
    state.db.answer({ data: [{ slug: 1 }] });
    expect(await content.publishedCourses()).toEqual({ ok: false });
    // Each failure is logged, with no detail a visitor chose.
    expect(logged).toEqual([
      {
        level: "error",
        requestId: "none",
        route: "GET /content/published-courses",
        outcome: "content-read-failed",
      },
      {
        level: "error",
        requestId: "none",
        route: "GET /content/published-courses",
        outcome: "content-read-failed",
      },
    ]);
  });

  it.each(["", "Not-A-Slug", "a/../b", "x".repeat(61), "ada@example.com"])(
    "[T-25] answers the address %j with no query, as no course",
    async (slug) => {
      expect(await content.publishedCourse(slug)).toEqual({ ok: true, value: null });
      expect(state.db.calls).toHaveLength(0);
    },
  );

  const lessonData = {
    id: "00000000-0000-4000-8000-00000000a001",
    slug: "printing",
    title: "Printing",
    xp: 10,
    instructions_md: "Print **hello**.",
    hints: ["Use print."],
    starter_code: "# Write here\n",
    tests: [{ id: "t1", name: "Says hello" }],
    courses: { slug: "python-basics", title: "Python basics" },
  };

  it("[FR-WSP-02] reads one published lesson by its course's address and its own", async () => {
    state.db.answer({ data: lessonData });
    expect(await content.publishedLesson("python-basics", "printing")).toEqual({
      ok: true,
      value: {
        id: lessonData.id,
        slug: "printing",
        title: "Printing",
        xp: 10,
        instructionsMarkdown: "Print **hello**.",
        hints: ["Use print."],
        starterCode: "# Write here\n",
        tests: [{ id: "t1", name: "Says hello" }],
        course: { slug: "python-basics", title: "Python basics" },
      },
    });
    expect(state.db.calls[0]?.target).toBe("lessons");
    expect(state.db.calls[0]?.chain).toEqual([
      [
        "select",
        [
          "id, slug, title, xp, instructions_md, hints, starter_code, tests, courses!inner(slug, title)",
        ],
      ],
      ["eq", ["slug", "printing"]],
      ["eq", ["courses.slug", "python-basics"]],
      ["maybeSingle", []],
    ]);
  });

  it("[T-21] never asks for a solution or a wrong answer", async () => {
    state.db.answer({ data: lessonData });
    await content.publishedLesson("python-basics", "printing");
    const asked = JSON.stringify(state.db.calls);
    expect(asked).not.toContain("solution");
    expect(asked).not.toContain("wrong_answers");
  });

  it("answers null for a lesson that is not published, and fails on an unexpected shape", async () => {
    state.db.answer({ data: null });
    expect(await content.publishedLesson("python-basics", "draft")).toEqual({
      ok: true,
      value: null,
    });
    state.db.answer({ data: { ...lessonData, hints: "not a list" } });
    expect(await content.publishedLesson("python-basics", "printing")).toEqual({ ok: false });
    expect(logged).toEqual([
      {
        level: "error",
        requestId: "none",
        route: "GET /content/published-lesson",
        outcome: "content-read-failed",
      },
    ]);
  });

  it.each([
    ["Not-A-Slug", "printing"],
    ["python-basics", "a/../b"],
    ["python-basics", "x".repeat(61)],
    ["", ""],
  ])(
    "[T-25] answers the addresses %j and %j with no query, as no lesson",
    async (course, lesson) => {
      expect(await content.publishedLesson(course, lesson)).toEqual({ ok: true, value: null });
      expect(state.db.calls).toHaveLength(0);
    },
  );

  it("expires the content tag when an admin changes content", () => {
    content.contentChanged();
    expect(state.updated).toEqual(["content"]);
  });
});
