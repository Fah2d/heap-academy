import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { main, prerenderedPages } from "./check-static.mjs";

let folder: string | undefined;

afterEach(() => {
  if (folder !== undefined) rmSync(folder, { recursive: true, force: true });
  folder = undefined;
});

/** A build folder holding the given manifest, or none. */
function build(manifest?: unknown): string {
  folder = mkdtempSync(join(tmpdir(), "build-"));
  if (manifest !== undefined) {
    writeFileSync(join(folder, "prerender-manifest.json"), JSON.stringify(manifest));
  }
  return folder;
}

function quietly(run: () => number): { code: number; out: string; errors: string } {
  const out: string[] = [];
  const errors: string[] = [];
  const writeOut = process.stdout.write.bind(process.stdout);
  const writeError = process.stderr.write.bind(process.stderr);
  process.stdout.write = (chunk: string | Uint8Array) => out.push(String(chunk)) > 0;
  process.stderr.write = (chunk: string | Uint8Array) => errors.push(String(chunk)) > 0;
  try {
    return { code: run(), out: out.join(""), errors: errors.join("") };
  } finally {
    process.stdout.write = writeOut;
    process.stderr.write = writeError;
  }
}

const page = { routeType: "page", srcRoute: null };

describe("static page check", () => {
  it("[NFR-SEC-02] passes a build whose only prerendered page is the one Next.js always prerenders", () => {
    expect(
      prerenderedPages({ version: 4, routes: { "/_global-error": page }, dynamicRoutes: {} }),
    ).toEqual([]);
  });

  it("[NFR-SEC-02] fails a prerendered page, such as a not-found page outside the per-request layout", () => {
    expect(
      prerenderedPages({
        version: 4,
        routes: { "/_global-error": page, "/_not-found": page, "/about": page },
        dynamicRoutes: {},
      }),
    ).toEqual(["/_not-found", "/about"]);
  });

  it("[NFR-SEC-02] fails a family of pages prerendered from their parameters", () => {
    expect(
      prerenderedPages({ version: 4, routes: {}, dynamicRoutes: { "/courses/[slug]": page } }),
    ).toEqual(["/courses/[slug]"]);
  });

  it("[NFR-SEC-02] counts an entry with no route type as a page, and leaves out route handlers", () => {
    expect(
      prerenderedPages({
        version: 4,
        routes: { "/robots.txt": { routeType: "route" }, "/old": {} },
        dynamicRoutes: { "/feed/[id]": { routeType: "route" } },
      }),
    ).toEqual(["/old"]);
  });

  it("[NFR-SEC-02] refuses a manifest it cannot read", () => {
    expect(() => prerenderedPages(null)).toThrow("not an object");
    expect(() => prerenderedPages({ version: 4 })).toThrow("no routes");
  });

  it("[NFR-SEC-02] exits 1 and names each prerendered page", () => {
    const root = build({ version: 4, routes: { "/_not-found": page }, dynamicRoutes: {} });
    const { code, errors } = quietly(() => main([root]));
    expect(code).toBe(1);
    expect(errors).toContain("/_not-found\n");
    expect(errors).toContain("carry no nonce");
  });

  it("[NFR-SEC-02] exits 0 on a build with no prerendered page", () => {
    const root = build({ version: 4, routes: { "/_global-error": page }, dynamicRoutes: {} });
    const { code, out } = quietly(() => main([root]));
    expect(code).toBe(0);
    expect(out).toContain("No prerendered page");
  });

  it("[NFR-SEC-02] fails a folder with no manifest, which proves nothing", () => {
    const { code, errors } = quietly(() => main([build()]));
    expect(code).toBe(1);
    expect(errors).toContain("nothing was checked");
  });

  it("[NFR-SEC-02] refuses arguments it does not know", () => {
    const root = build({ version: 4, routes: {} });
    expect(quietly(() => main([])).code).toBe(2);
    expect(quietly(() => main([root, "--other"])).code).toBe(2);
  });
});
