import { beforeEach, describe, expect, it, vi } from "vitest";

// The sitemap and the indexing rules (FR-SEO-01): every public page, at the
// production address, with only published courses.

vi.mock("server-only", () => ({}));

const state = vi.hoisted(() => ({ courses: { ok: true, value: [] } as unknown }));
vi.mock("@/content", () => ({ publishedCourses: () => Promise.resolve(state.courses) }));

const { catalogSitemap } = await import("./sitemap");
const { catalogRobots } = await import("../robots");

beforeEach(() => {
  state.courses = { ok: true, value: [] };
});

describe("the sitemap [FR-SEO-01]", () => {
  it("lists the home page, the course list, and each published course", async () => {
    state.courses = {
      ok: true,
      value: [
        { slug: "python-basics", title: "Python basics", summary: "S", lessonCount: 3 },
        { slug: "loops", title: "Loops", summary: "S", lessonCount: 1 },
      ],
    };
    expect(await catalogSitemap()).toEqual([
      { url: "https://heapacademy.dev/" },
      { url: "https://heapacademy.dev/courses" },
      { url: "https://heapacademy.dev/courses/python-basics" },
      { url: "https://heapacademy.dev/courses/loops" },
    ]);
  });

  it("lists the two fixed pages when nothing is published", async () => {
    expect(await catalogSitemap()).toEqual([
      { url: "https://heapacademy.dev/" },
      { url: "https://heapacademy.dev/courses" },
    ]);
  });

  it("fails rather than answer a sitemap without the courses when they cannot be read", async () => {
    state.courses = { ok: false };
    await expect(catalogSitemap()).rejects.toThrow("sitemap");
  });
});

describe("the indexing rules [FR-SEO-01]", () => {
  it("lets crawlers read every page and names the sitemap", () => {
    // Pages left out of indexing say so in their own robots metadata. A
    // disallow here would stop a crawler from reading that, so only the API,
    // which has no pages, is disallowed.
    expect(catalogRobots()).toEqual({
      rules: { userAgent: "*", allow: "/", disallow: "/api/" },
      sitemap: "https://heapacademy.dev/sitemap.xml",
    });
  });
});
