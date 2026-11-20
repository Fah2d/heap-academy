#!/usr/bin/env node
// The static page check of the `build` job (NFR-SEC-02): every page renders
// per request, because the script policy's nonce exists only at request time
// and Next.js cannot put one on a page it prerendered at build. A prerendered
// page would be served with scripts the policy blocks. The root layout calls
// `connection()`, so every page under it renders per request; this check
// fails the build on any page that still does not.
//
// It reads `prerender-manifest.json` from the build folder. Every entry is a
// prerendered route, in `routes`, or a family of them, in `dynamicRoutes`.
// Route handlers (`routeType: "route"`) are left out: they send no scripts.
//
// One page is allowed. Next.js always prerenders `/_global-error` at build:
// `app/global-error.tsx` is a client component and replaces the root layout,
// so neither `connection()` nor a segment option reaches it. When the root
// layout fails on a request, Next.js renders that error page per request,
// with the nonce on its scripts (measured in the WP-1.3 description).
//
// Usage: check-static.mjs <build folder>
// Exit codes: 0 no prerendered page, 1 a prerendered page or no manifest,
// 2 usage error.

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

/** Prerendered by Next.js whatever the app does; see the comment above. */
export const ALLOWED = ["/_global-error"];

/**
 * The pages a build prerendered, apart from the allowed ones.
 *
 * @param {unknown} manifest the parsed prerender-manifest.json
 * @returns {string[]}
 */
export function prerenderedPages(manifest) {
  if (typeof manifest !== "object" || manifest === null) {
    throw new Error("prerender-manifest.json is not an object");
  }
  const { routes, dynamicRoutes } = /** @type {Record<string, unknown>} */ (manifest);
  if (typeof routes !== "object" || routes === null) {
    throw new Error("prerender-manifest.json has no routes");
  }
  const entries = [
    ...Object.entries(routes),
    ...Object.entries(
      typeof dynamicRoutes === "object" && dynamicRoutes !== null ? dynamicRoutes : {},
    ),
  ];
  return entries
    .filter(([, entry]) => {
      const type = /** @type {{ routeType?: unknown } | null} */ (entry)?.routeType;
      return type !== "route";
    })
    .map(([path]) => path)
    .filter((path) => !ALLOWED.includes(path));
}

/** @param {string[]} argv @returns {number} */
export function main(argv) {
  const [folder] = argv;
  if (folder === undefined || argv.length !== 1) {
    process.stderr.write("usage: check-static.mjs <build folder>\n");
    return 2;
  }
  const file = join(folder, "prerender-manifest.json");
  if (!existsSync(file)) {
    // No manifest proves nothing: the build failed or wrote elsewhere.
    process.stderr.write(`No ${file}; nothing was checked.\n`);
    return 1;
  }
  const pages = prerenderedPages(JSON.parse(readFileSync(file, "utf8")));
  if (pages.length > 0) {
    for (const page of pages) process.stderr.write(`${page}\n`);
    process.stderr.write(
      "These pages are prerendered, so their scripts carry no nonce and the policy blocks them (NFR-SEC-02).\n",
    );
    return 1;
  }
  process.stdout.write(
    `No prerendered page in ${folder}, apart from ${ALLOWED.join(", ")}, which Next.js always prerenders.\n`,
  );
  return 0;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  process.exit(main(process.argv.slice(2)));
}
