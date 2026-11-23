import { readdirSync, readFileSync } from "node:fs";
import { join, relative, sep } from "node:path";
import type { Metadata } from "next";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Which pages a search engine may index (FR-SEO-01; WP-5.1 "Done when": sign-in,
// profile, and admin pages are excluded from indexing). The table is
// docs/spec/03-experience.md section 3. Every production page under src/app
// must be in it, so a new page cannot ship without a decision.

vi.mock("server-only", () => ({}));
vi.mock("next/server", () => ({ connection: () => Promise.resolve() }));
// The shell's fonts are built by Next.js; the not-found page imports them.
vi.mock("next/font/local", () => ({ default: () => ({ className: "", variable: "" }) }));

const state = vi.hoisted(() => ({
  decision: "allow" as "not_found" | "setup" | "verify" | "allow",
}));

// The admin door's decision, without a session or a database.
vi.mock("@/features/admin/server/gate", () => ({
  adminGateDecision: () => Promise.resolve(state.decision),
  requireAdminStage: () => Promise.resolve(),
  requireAdminList: () => Promise.resolve(),
}));

const PUBLISHED_COURSE = {
  slug: "python-basics",
  title: "Python basics",
  summary: "Print, names and numbers.",
  outcomes: [],
  chapters: [
    {
      id: "8d0f3a52-6f0e-4a57-9a54-4b1e2c3d4e5f",
      title: "First steps",
      summary: "",
      lessons: [{ slug: "hello", title: "Say hello" }],
    },
  ],
};

// Content that reads, so an indexed page answers as it does with a database.
vi.mock("@/content", () => ({
  publishedCourses: () =>
    Promise.resolve({
      ok: true,
      value: [{ slug: "python-basics", title: "Python basics", summary: "", lessonCount: 1 }],
    }),
  publishedCourse: () => Promise.resolve({ ok: true, value: PUBLISHED_COURSE }),
}));

const APP = import.meta.dirname;

// docs/spec/03-experience.md section 3. `/admin/courses/new` is not a row of
// its own there; it is part of the admin dashboard, which is not indexed.
const INDEXED = new Set(["/", "/courses", "/courses/[course]"]);
const NOT_INDEXED = new Set([
  "/sign-in",
  "/admin",
  "/admin/courses/new",
  "/admin/courses/[id]",
  "/admin/setup",
  "/admin/verify",
]);

// The build's page extensions, as `PAGE_EXTENSIONS` in next.config.ts names
// them. Importing that file would parse the server environment, so a test
// below reads it and fails when the two lists differ.
const BUILD_PAGE_EXTENSIONS = ["tsx", "ts", "jsx", "js"];

/** A production page file. A `.dev.tsx` page is not in the build. */
function isPageFile(name: string): boolean {
  return BUILD_PAGE_EXTENSIONS.some((extension) => name === `page.${extension}`);
}

/** Every production page's route, with its file relative to src/app. */
function pageFiles(directory: string): Map<string, string> {
  const pages = new Map<string, string>();
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      for (const [route, file] of pageFiles(path)) pages.set(route, file);
    } else if (isPageFile(entry.name)) {
      const folder = relative(APP, directory);
      pages.set(folder === "" ? "/" : `/${folder.split(sep).join("/")}`, relative(APP, path));
    }
  }
  return pages;
}

const PAGES = pageFiles(APP);

type PageModule = {
  metadata?: Metadata;
  generateMetadata?: (props: { params: Promise<Record<string, string>> }) => Promise<Metadata>;
};

async function metadataOf(route: string): Promise<Metadata> {
  const file = PAGES.get(route);
  if (file === undefined) throw new Error(`no page file for ${route}`);
  const page = (await import(/* @vite-ignore */ `./${file.split(sep).join("/")}`)) as PageModule;
  if (page.generateMetadata !== undefined) {
    return page.generateMetadata({
      params: Promise.resolve({ course: "python-basics", id: "1" }),
    });
  }
  return page.metadata ?? {};
}

function isIndexed(metadata: Metadata): boolean {
  const robots = metadata.robots;
  if (robots === null || robots === undefined) return true;
  if (typeof robots === "string") return !/noindex/.test(robots);
  return robots.index !== false;
}

describe("[FR-SEO-01] which pages are indexed", () => {
  beforeEach(() => {
    state.decision = "allow";
  });

  const routes = [...PAGES.keys()];

  it("counts every page extension of the build as a page, and no development page", () => {
    expect(["page.tsx", "page.ts", "page.jsx", "page.js"].filter(isPageFile)).toHaveLength(4);
    expect(["page.dev.tsx", "page.test.tsx", "layout.tsx", "apage.tsx"].filter(isPageFile)).toEqual(
      [],
    );
  });

  it("uses the same page extensions as the build", () => {
    const config = readFileSync(join(import.meta.dirname, "..", "..", "next.config.ts"), "utf8");
    expect(config).toContain(
      `const PAGE_EXTENSIONS = ${JSON.stringify(BUILD_PAGE_EXTENSIONS).replaceAll(",", ", ")};`,
    );
  });

  it("finds the pages of the build", () => {
    expect(routes).toContain("/");
    expect(routes).toContain("/sign-in");
    expect(routes.some((route) => route.startsWith("/dev"))).toBe(false);
  });

  it.each(routes)("%s has a row in the indexing table", (route) => {
    expect(INDEXED.has(route) || NOT_INDEXED.has(route), route).toBe(true);
  });

  it.each([...NOT_INDEXED])("%s asks not to be indexed", async (route) => {
    expect(isIndexed(await metadataOf(route))).toBe(false);
  });

  it.each([...NOT_INDEXED].filter((route) => route.startsWith("/admin")))(
    "%s asks not to be indexed at every stage of the admin door",
    async (route) => {
      for (const decision of ["not_found", "setup", "verify"] as const) {
        state.decision = decision;
        expect(isIndexed(await metadataOf(route)), decision).toBe(false);
      }
    },
  );

  it.each([...INDEXED])("%s may be indexed when its content reads", async (route) => {
    expect(isIndexed(await metadataOf(route))).toBe(true);
  });

  it("the not-found page asks not to be indexed", async () => {
    const page = (await import("./not-found")) as PageModule;
    expect(isIndexed(page.metadata ?? {})).toBe(false);
  });
});
