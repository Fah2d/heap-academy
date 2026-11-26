import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";
import { codeEditor } from "../src/messages/lesson";
import { expectEveryControlReached } from "./keyboard";

// WP-7.2: the keyboard walkthrough (NFR-A11Y-03) of the catalog's states and
// every admin state, on their development-only pages. Tab reaches each
// control once, in document order, each with its focus ring, and focus is
// never lost. The order on the screen is the document order: no page here
// reorders controls with CSS; the workspace's walk checks its regions by
// name. Runs in the `gallery` project, against the development server. The
// sign-in and not-found pages are walked on the production build, in
// e2e/sign-in.spec.ts and e2e/shell.spec.ts.

const PAGES = [
  { name: "the catalog gallery", path: "/dev/catalog" },
  { name: "the home page with no course", path: "/dev/catalog?state=home-empty" },
  { name: "the empty course list", path: "/dev/catalog?state=list-empty" },
  { name: "the course list", path: "/dev/catalog?state=list-rows" },
  { name: "the course page", path: "/dev/catalog?state=course" },
];

for (const { name, path } of PAGES) {
  for (const width of [375, 1280]) {
    test(`[NFR-A11Y-03] the keyboard reaches every control on ${name}, in order, at ${String(width)} px`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.goto(path);
      await expectEveryControlReached(page);
    });
  }
}

// Every example of the admin gallery's three pages, each opened alone
// (`?example=<id>`), read from the gallery's source so that a new example is
// walked without a list to keep.
const GALLERY_SOURCE = readFileSync(
  "src/features/admin/components/admin-state-gallery.tsx",
  "utf8",
);
const ADMIN_PAGES = [
  { part: "CourseStates", path: "/dev/admin" },
  { part: "LessonStates", path: "/dev/admin/lessons" },
  { part: "ValidationStates", path: "/dev/admin/validation" },
] as const;

function examplesOf(part: string): string[] {
  const start = GALLERY_SOURCE.indexOf(`function ${part}(`);
  const next = GALLERY_SOURCE.indexOf("\nfunction ", start + 1);
  const body = GALLERY_SOURCE.slice(start, next === -1 ? undefined : next);
  return [...body.matchAll(/<Example id="([^"]+)"/g)].map((match) => match[1] ?? "");
}

for (const { part, path } of ADMIN_PAGES) {
  const examples = examplesOf(part);
  test(`[NFR-A11Y-03] the admin gallery's ${part} has examples to walk`, () => {
    expect(examples.length).toBeGreaterThan(0);
  });
  for (const example of examples) {
    test(`[NFR-A11Y-03] the keyboard reaches every control in the admin example "${example}", in order, at 1280 px`, async ({
      page,
    }) => {
      await page.setViewportSize({ width: 1280, height: 900 });
      await page.goto(`${path}?example=${example}`);
      await expect(page.locator(`section[aria-labelledby="${example}"]`)).toBeVisible();
      // Each code editor is built after the page loads, beside its hint.
      const editors = await page.getByText(codeEditor.leaveHint, { exact: true }).count();
      await expect(page.locator(".cm-editor")).toHaveCount(editors);
      await expectEveryControlReached(page);
    });
  }
}
