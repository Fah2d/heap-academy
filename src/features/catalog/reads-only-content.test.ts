import { readdirSync, readFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { describe, expect, it } from "vitest";

// Public pages read only through `src/content`, with a client that carries no
// session (CLAUDE.md rule 9; WP-5.1). The catalog feature and its routes may
// not reach a database client, identity, or another feature's queries.

const ROOT = join(import.meta.dirname, "..", "..", "..");
const SRC = join(ROOT, "src");
const CATALOG = join(SRC, "features", "catalog");
const APP = join(SRC, "app");

function sourceFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return sourceFiles(path);
    return /\.tsx?$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name) ? [path] : [];
  });
}

/**
 * Every module a source text names: static imports and exports, side-effect
 * imports, `import("...")` with any quote (lint does not check a backtick
 * one), and `require("...")`.
 */
function importsOf(text: string): string[] {
  return [...text.matchAll(/(?:\bfrom|\bimport|\brequire)\s*\(?\s*["'`]([^"'`]+)["'`]/g)].map(
    (match) => match[1] ?? "",
  );
}

/** A relative specifier as the `@/` path it points at, so `../../infrastructure` is seen too. */
function aliased(from: string, specifier: string): string {
  if (!specifier.startsWith(".")) return specifier;
  return `@/${relative(SRC, resolve(dirname(from), specifier))}`;
}

/** What a catalog file or route may not import (CLAUDE.md rules 8 and 9). */
function forbiddenImports(from: string, specifiers: string[]): string[] {
  return specifiers.filter((specifier) => {
    const target = aliased(from, specifier);
    return (
      target.startsWith("@/infrastructure") ||
      target.startsWith("@supabase/") ||
      target === "next/headers" ||
      (target.startsWith("@/features/") &&
        target !== "@/features/catalog" &&
        !target.startsWith("@/features/catalog/"))
    );
  });
}

function imports(path: string): string[] {
  return importsOf(readFileSync(path, "utf8"));
}

/** Imports that bring in code at run time; `import type` brings in none. */
function valueImports(path: string): string[] {
  const text = readFileSync(path, "utf8");
  return [...text.matchAll(/^import\s+(?!type\s)[^;]*?from\s+"([^"]+)"/gms)].map(
    (match) => match[1] ?? "",
  );
}

describe("the catalog reads only through src/content", () => {
  it("[T-21] sees dynamic imports as well as static ones", () => {
    const text = [
      'import "server-only";',
      'import { a } from "@/content";',
      'export { b } from "./b";',
      'const client = await import("@/infrastructure/db/session-client");',
      "const other = await import( '@supabase/ssr' );",
    ].join("\n");
    expect(importsOf(text)).toEqual([
      "server-only",
      "@/content",
      "./b",
      "@/infrastructure/db/session-client",
      "@supabase/ssr",
    ]);
    expect(importsOf('const a = require("next/headers");')).toEqual(["next/headers"]);
  });

  it("[T-21] forbids the request's headers and a relative path into another layer", () => {
    const from = join(CATALOG, "server", "reads.ts");
    expect(
      forbiddenImports(from, [
        "next/headers",
        "../../../infrastructure/db/session-client",
        "../../admin",
        "@/features/catalog/paths",
        "../paths",
        "@/content",
      ]),
    ).toEqual(["next/headers", "../../../infrastructure/db/session-client", "../../admin"]);
  });

  // Every route file that composes the catalog, found by what it imports, so a
  // new one (an image route, say) cannot slip past. The root layout frames
  // every page, so it takes the header link from here and the shell and
  // sign-in from their features; it is not a catalog route.
  const routes = sourceFiles(APP).filter(
    (path) =>
      !/^layout\.tsx?$/.test(path.split("/").at(-1) ?? "") &&
      imports(path).some(
        (specifier) =>
          specifier === "@/features/catalog" || specifier.startsWith("@/features/catalog/"),
      ),
  );
  const files = [...sourceFiles(CATALOG), ...routes];

  it("finds the catalog's route files", () => {
    expect(routes.map((path) => relative(ROOT, path)).sort()).toEqual(
      expect.arrayContaining([
        "src/app/courses/[course]/page.tsx",
        "src/app/courses/page.tsx",
        "src/app/dev/catalog/page.dev.tsx",
        "src/app/page.tsx",
        "src/app/robots.ts",
        "src/app/sitemap.ts",
      ]),
    );
  });

  // The lesson page and its development twin compose the workspace (WP-5.2
  // decision 7), and the home page its live editor (FR-LND-01): each may take
  // the workspace's client-safe index and the request's script nonce, which
  // carries no identity, and exactly those. Any other forbidden import still
  // fails.
  const WORKSPACE_HOSTS: Record<string, string[]> = {
    "src/features/catalog/components/home-page.tsx": [
      "@/features/workspace",
      "@/infrastructure/http/nonce",
    ],
    "src/features/catalog/components/lesson-page.tsx": [
      "@/features/workspace",
      "@/infrastructure/http/nonce",
    ],
    "src/features/catalog/components/workspace-gallery.tsx": [
      "@/features/workspace",
      "@/infrastructure/http/nonce",
    ],
  };

  // The course list and the course page show the learner's progress from the
  // device (WP-5.4; 02-architecture.md section 10): one client file may take
  // the progress feature's client-safe index, which reads only IndexedDB.
  const PROGRESS_READERS: Record<string, string[]> = {
    "src/features/catalog/components/course-progress.tsx": ["@/features/progress"],
  };
  // The header's bar slot (src/app/@bar) frames every page, as the root
  // layout does: its pages take the shell's header parts, and nothing else.
  const HEADER_BARS: Record<string, string[]> = Object.fromEntries(
    routes
      .map((path) => relative(ROOT, path))
      .filter((name) => name.startsWith("src/app/@bar/"))
      .map((name) => [name, ["@/features/shell"]]),
  );
  const allowed = { ...WORKSPACE_HOSTS, ...PROGRESS_READERS, ...HEADER_BARS };

  it.each(files.map((path) => [relative(ROOT, path), path]))(
    "%s imports no database client, identity, request headers or other feature",
    (name, path) => {
      expect(forbiddenImports(path, imports(path))).toEqual(allowed[name] ?? []);
    },
  );

  it("finds every file that hosts the workspace or reads progress", () => {
    for (const name of Object.keys(allowed)) {
      expect(files.map((path) => relative(ROOT, path))).toContain(name);
    }
  });

  it("takes its published content from src/content", () => {
    const readers = files.filter((path) => valueImports(path).includes("@/content"));
    expect(readers.map((path) => relative(ROOT, path)).sort()).toEqual([
      "src/features/catalog/components/lesson-page.tsx",
      "src/features/catalog/server/reads.ts",
      "src/features/catalog/server/sitemap.ts",
    ]);
  });
});
