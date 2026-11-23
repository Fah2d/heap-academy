import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

// Public pages read only through `src/content`, with a client that carries no
// session (CLAUDE.md rule 9; WP-5.1). The catalog feature and its routes may
// not reach a database client, identity, or another feature's queries.

const ROOT = join(import.meta.dirname, "..", "..", "..");
const CATALOG = join(ROOT, "src", "features", "catalog");
// Every route file that composes the catalog.
const ROUTES = [
  join(ROOT, "src", "app", "page.tsx"),
  join(ROOT, "src", "app", "courses", "page.tsx"),
  join(ROOT, "src", "app", "courses", "[course]", "page.tsx"),
  join(ROOT, "src", "app", "sitemap.ts"),
  join(ROOT, "src", "app", "robots.ts"),
  join(ROOT, "src", "app", "dev", "catalog", "page.dev.tsx"),
];

function sourceFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return sourceFiles(path);
    return /\.tsx?$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name) ? [path] : [];
  });
}

/**
 * Every module a source text names: static imports and exports, side-effect
 * imports, and `import("...")` calls, which the lint boundary rule does not see.
 */
export function importsOf(text: string): string[] {
  return [...text.matchAll(/(?:\bfrom|\bimport)\s*\(?\s*["'`]([^"'`]+)["'`]/g)].map(
    (match) => match[1] ?? "",
  );
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
  });

  const files = [...sourceFiles(CATALOG), ...ROUTES];

  it("checks the catalog's own files and its route files", () => {
    expect(files.length).toBeGreaterThan(ROUTES.length);
  });

  it.each(files.map((path) => [relative(ROOT, path), path]))(
    "%s imports no database client, identity or other feature",
    (_name, path) => {
      const forbidden = imports(path).filter(
        (specifier) =>
          specifier.startsWith("@/infrastructure") ||
          specifier.startsWith("@supabase/") ||
          (specifier.startsWith("@/features/") && specifier !== "@/features/catalog"),
      );
      expect(forbidden).toEqual([]);
    },
  );

  it("takes its published content from src/content", () => {
    const readers = files.filter((path) => valueImports(path).includes("@/content"));
    expect(readers.map((path) => relative(ROOT, path)).sort()).toEqual([
      "src/features/catalog/server/reads.ts",
      "src/features/catalog/server/sitemap.ts",
    ]);
  });
});
