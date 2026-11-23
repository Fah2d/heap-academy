import { readdirSync } from "node:fs";
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

/** Every production page: `page.tsx`. A `.dev.tsx` page is not in the build. */
function pageRoutes(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return pageRoutes(path);
    if (entry.name !== "page.tsx") return [];
    const folder = relative(APP, directory);
    return [folder === "" ? "/" : `/${folder.split(sep).join("/")}`];
  });
}

type PageModule = {
  metadata?: Metadata;
  generateMetadata?: (props: { params: Promise<Record<string, string>> }) => Promise<Metadata>;
};

async function metadataOf(route: string): Promise<Metadata> {
  const file = route === "/" ? "./page.tsx" : `.${route}/page.tsx`;
  const page = (await import(/* @vite-ignore */ file)) as PageModule;
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

  const routes = pageRoutes(APP);

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
