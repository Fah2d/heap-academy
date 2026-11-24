import { beforeEach, describe, expect, it, vi } from "vitest";
import { fakeDb, type FakeDb } from "../../scripts/testing/fake-db";

// WP-5.1: a page view with a warm cache makes no database query
// (docs/spec/02-architecture.md section 12). The framework's data cache is
// replaced by one that keeps each answer under its key parts and arguments,
// as the real one does, and keeps nothing when the read throws.

vi.mock("server-only", () => ({}));

const state = vi.hoisted(() => ({
  db: null as unknown as FakeDb,
  store: new Map<string, unknown>(),
  database: "http://127.0.0.1:54321",
}));

vi.mock("next/cache", () => ({
  unstable_cache:
    (read: (...args: unknown[]) => Promise<unknown>, keyParts: string[]) =>
    async (...args: unknown[]) => {
      const key = JSON.stringify([keyParts, args]);
      if (state.store.has(key)) return state.store.get(key);
      const value = await read(...args);
      state.store.set(key, value);
      return value;
    },
  updateTag: () => undefined,
}));
vi.mock("@/infrastructure/db/public-client", () => ({
  createPublicClient: () => state.db,
  publicDatabaseAddress: () => state.database,
}));
vi.mock("@/infrastructure/logging/logger", () => ({ log: () => undefined }));

const content = await import("./index");

const course = {
  slug: "one",
  title: "One",
  summary: "S",
  outcomes: [],
  chapters: [
    {
      id: "00000000-0000-4000-8000-000000000d01",
      title: "First",
      summary: "",
      position: 0,
      lessons: [{ slug: "a", title: "A", position: 0 }],
    },
  ],
};

const list = { data: [{ slug: "one", title: "One", summary: "S", lessons: [{ slug: "a" }] }] };

beforeEach(() => {
  state.db = fakeDb();
  state.store.clear();
  state.database = "http://127.0.0.1:54321";
});

describe("published content with a warm cache [FR-ADM-11]", () => {
  it("reads the course list from the database once, then from the cache", async () => {
    state.db.answer({
      data: [{ slug: "one", title: "One", summary: "S", lessons: [{ slug: "a" }] }],
    });
    const first = await content.publishedCourses();
    const second = await content.publishedCourses();
    expect(second).toEqual(first);
    expect(state.db.calls).toHaveLength(1);
  });

  it("reads a course page from the database once, then from the cache", async () => {
    state.db.answer(list, { data: course });
    const first = await content.publishedCourse("one");
    const second = await content.publishedCourse("one");
    expect(second).toEqual(first);
    expect(first.ok && first.value?.title).toBe("One");
    // The course list, read first to rule out a made-up address, and the course.
    expect(state.db.calls).toHaveLength(2);
  });

  it("keeps no failed read, so the next view asks the database again", async () => {
    state.db.answer(list, { error: { code: "57014" } }, { data: course });
    expect(await content.publishedCourse("one")).toEqual({ ok: false });
    const retried = await content.publishedCourse("one");
    expect(retried.ok && retried.value?.slug).toBe("one");
    // The list once (kept), the failed course read, then the course again.
    expect(state.db.calls).toHaveLength(3);
  });
  // The cache is kept on disk and shared by every server of one build, so an
  // answer read from one database must never answer for another.
  it("keeps the answers of two databases apart", async () => {
    state.db.answer(list, {
      data: [{ slug: "two", title: "Two", summary: "S", lessons: [{ slug: "b" }] }],
    });
    const first = await content.publishedCourses();
    state.database = "http://127.0.0.1:1";
    const second = await content.publishedCourses();
    expect(first.ok && first.value.map((row) => row.slug)).toEqual(["one"]);
    expect(second.ok && second.value.map((row) => row.slug)).toEqual(["two"]);
    expect(state.db.calls).toHaveLength(2);
  });

  it("keeps a course page of two databases apart", async () => {
    state.db.answer(list, { data: course }, list, { data: { ...course, title: "Other" } });
    const first = await content.publishedCourse("one");
    state.database = "http://127.0.0.1:1";
    const second = await content.publishedCourse("one");
    expect(first.ok && first.value?.title).toBe("One");
    expect(second.ok && second.value?.title).toBe("Other");
    expect(state.db.calls).toHaveLength(4);
  });
});
