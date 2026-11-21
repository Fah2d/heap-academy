import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

// Every admin page runs the guard for its own stage (FR-ADM-01, T-19). The
// layout only keeps strangers out; Next.js renders a page beside its layout,
// so a page that forgot `requireAdminStage("allow")` would render for an
// admin at aal1 (the database would still refuse its data). This keeps a new
// page from forgetting it.

const root = join(import.meta.dirname, "../../..");
const views = join(root, "src/features/admin/components");
const routes = join(root, "src/app/admin");

const STAGES: Record<string, string> = {
  "setup-page.tsx": "setup",
  "verify-page.tsx": "verify",
};

function pages(folder: string): string[] {
  return readdirSync(folder, { withFileTypes: true }).flatMap((entry) => {
    const path = join(folder, entry.name);
    if (entry.isDirectory()) return pages(path);
    return entry.name === "page.tsx" ? [path] : [];
  });
}

describe("admin pages and their guard [FR-ADM-01, T-19]", () => {
  const viewFiles = readdirSync(views).filter((name) => name.endsWith("-page.tsx"));

  it("finds the views", () => {
    expect(viewFiles).toEqual(
      expect.arrayContaining(["dashboard-page.tsx", ...Object.keys(STAGES)]),
    );
  });

  it.each(viewFiles)("%s calls the guard for its stage before anything else", (name) => {
    const source = readFileSync(join(views, name), "utf8");
    const stage = STAGES[name] ?? "allow";
    const body = /export async function \w+\([^)]*\)[^{]*\{\s*([^\n]+)/.exec(source)?.[1];
    expect(body).toBe(`await requireAdminStage("${stage}");`);
  });

  it.each(pages(routes).map((path) => relative(root, path)))(
    "%s renders one view of the admin feature",
    (path) => {
      const source = readFileSync(join(root, path), "utf8");
      // A page passes on its route's params and nothing else.
      const view = /return <(\w+Page)(?: params=\{params\})? \/>;/.exec(source)?.[1];
      expect(view).toBeDefined();
      expect(source).toMatch(
        new RegExp(`import \\{[^}]*\\b${view ?? ""}\\b[^}]*\\} from "@/features/admin";`),
      );
    },
  );
});
