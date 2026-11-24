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
  return { data: [{ slug, title: "Listed", summary: "S", lessons: [{ slug: "a" }] }] };
}

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
    ]);
  });

  it("lists published courses in order with their published lesson counts", async () => {
    state.db.answer({
      data: [
        { slug: "one", title: "One", summary: "S1", lessons: [{ slug: "a" }, { slug: "b" }] },
        { slug: "three", title: "Three", summary: "S3", lessons: [{ slug: "c" }] },
      ],
    });
    expect(await content.publishedCourses()).toEqual({
      ok: true,
      value: [
        { slug: "one", title: "One", summary: "S1", lessonCount: 2 },
        { slug: "three", title: "Three", summary: "S3", lessonCount: 1 },
      ],
    });
    expect(state.db.calls[0]?.chain).toEqual([
      ["select", ["slug, title, summary, lessons(slug)"]],
      ["order", ["position"]],
      ["order", ["title"]],
    ]);
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
            lessons: [{ slug: "c", title: "C", position: 0 }],
          },
          {
            id: "00000000-0000-4000-8000-000000000d01",
            title: "First",
            summary: "",
            position: 0,
            lessons: [
              { slug: "b", title: "B", position: 1 },
              { slug: "a", title: "A", position: 0 },
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
      { slug: "a", title: "A" },
      { slug: "b", title: "B" },
    ]);
    expect(state.db.calls[1]?.chain).toContainEqual(["eq", ["slug", "one"]]);
  });

  it("[FR-CAT-04] leaves out a course with no published lesson", async () => {
    state.db.answer({
      data: [
        { slug: "empty", title: "Empty", summary: "S0", lessons: [] },
        { slug: "one", title: "One", summary: "S1", lessons: [{ slug: "a" }] },
      ],
    });
    expect(await content.publishedCourses()).toEqual({
      ok: true,
      value: [{ slug: "one", title: "One", summary: "S1", lessonCount: 1 }],
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
            lessons: [{ slug: "a", title: "A", position: 0 }],
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

  it("expires the content tag when an admin changes content", () => {
    content.contentChanged();
    expect(state.updated).toEqual(["content"]);
  });
});
