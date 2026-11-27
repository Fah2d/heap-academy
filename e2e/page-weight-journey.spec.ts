import { expect, test, type Page, type Response } from "@playwright/test";

// WP-7.2, NFR-PERF-01: the public pages that are not a lesson download no
// code editor, except the home page, whose live editor (FR-LND-01, WP-7.5)
// fetches it only after the page's load event. The root layout imports feature indexes that also re-export
// the lesson page, and Next.js takes the client components of a layout from
// its whole import graph, so without `"sideEffects"` in package.json the
// workspace and CodeMirror (about 160 kB compressed) loaded on every page
// (docs/reports/day-7-quality.md section 5). The lesson page is the control:
// it must download the editor, so the marker still finds it. Runs in the
// `stack` project, where the seed's course is published.

// A class name CodeMirror's own styles carry; no other code holds it.
const EDITOR_MARKER = "cm-editor";

async function scriptsOf(page: Page, path: string): Promise<string[]> {
  const bodies: Promise<string>[] = [];
  const listen = (response: Response) => {
    if (response.request().resourceType() === "script") bodies.push(response.text());
  };
  page.on("response", listen);
  // The load event waits for every script the page's HTML names, the
  // framework's chunks included. Then every script the browser fetched must
  // have reached the listener, so none is missed by reading too early.
  const response = await page.goto(path, { waitUntil: "load" });
  expect(response?.status(), path).toBe(200);
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          performance
            .getEntriesByType("resource")
            .filter((entry) => (entry as PerformanceResourceTiming).initiatorType === "script")
            .length,
      ),
    )
    .toBeLessThanOrEqual(bodies.length);
  // The lesson page goes on fetching (Python's worker and its files); a body
  // read after the test ends fails as the page closes, so stop reading here.
  page.off("response", listen);
  return Promise.all(bodies);
}

for (const path of ["/courses", "/courses/sample-course"]) {
  test(`[NFR-PERF-01] ${path} downloads no code editor`, async ({ page }) => {
    const scripts = await scriptsOf(page, path);
    expect(scripts.length, "scripts downloaded").toBeGreaterThan(0);
    expect(scripts.filter((body) => body.includes(EDITOR_MARKER))).toEqual([]);
  });
}

test("[NFR-PERF-01] the lesson page downloads the code editor, so the marker is right", async ({
  page,
}) => {
  const scripts = await scriptsOf(page, "/learn/sample-course/say-hello-by-name");
  expect(scripts.some((body) => body.includes(EDITOR_MARKER))).toBe(true);
});

test("[NFR-PERF-01] [FR-LND-01] / downloads the code editor only after the page has loaded", async ({
  page,
}) => {
  const editorScripts: string[] = [];
  page.on("response", (response) => {
    if (response.request().resourceType() !== "script") return;
    void response.text().then(
      (body) => {
        if (body.includes(EDITOR_MARKER)) editorScripts.push(response.url());
      },
      () => undefined,
    );
  });
  const response = await page.goto("/", { waitUntil: "load" });
  expect(response?.status()).toBe(200);
  await expect(page.locator("[data-home-editor] .cm-editor")).toBeVisible();
  await expect.poll(() => editorScripts.length).toBeGreaterThan(0);
  // Each script that holds the editor was asked for after the load event began.
  const timings = await page.evaluate((urls) => {
    const [navigation] = performance.getEntriesByType(
      "navigation",
    ) as PerformanceNavigationTiming[];
    const starts = performance
      .getEntriesByType("resource")
      .filter((entry) => urls.includes(entry.name))
      .map((entry) => entry.startTime);
    return { loadEventStart: navigation?.loadEventStart ?? 0, starts };
  }, editorScripts);
  expect(timings.starts.length).toBe(editorScripts.length);
  expect(timings.loadEventStart).toBeGreaterThan(0);
  for (const start of timings.starts) expect(start).toBeGreaterThanOrEqual(timings.loadEventStart);
});
