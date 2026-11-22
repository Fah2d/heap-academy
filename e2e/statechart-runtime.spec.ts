import { expect, test, type Page } from "@playwright/test";
import { EXAMPLE_LESSON } from "../src/grader/example-lesson";
import { runtimeDev } from "../src/messages/runtime-dev";

// WP-3.4: the runtime page driven by the workspace statechart, in Chromium,
// Firefox and WebKit (the runtime-* projects): a check, a runaway loop, and
// a press that waits for Python (FR-WSP-07, FR-WSP-17). The same page is the
// one the owner opens on phones through the preview.
test.describe.configure({ timeout: 120_000 });

const READY_MS = 60_000;
const chart = (page: Page) => page.locator("[data-chart-state]");

async function ready(page: Page) {
  await expect(chart(page)).toHaveAttribute("data-chart-state", "ready", { timeout: READY_MS });
}

test.beforeEach(async ({ page }) => {
  await page.goto("/dev/runtime");
});

test("[FR-WSP-17] Run pressed while Python starts waits and then runs", async ({ page }) => {
  // Python's files are held until Run is pressed, so the page is still
  // loading at the click however fast the runner is. Whether the context's
  // route sees a worker's requests is not documented; `held` makes a miss
  // fail here instead of racing.
  let release: () => void = () => undefined;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  let held = false;
  await page.context().route("**/_runtime/pyodide/**", async (route) => {
    held = true;
    await gate;
    await route.continue();
  });
  await page.reload();
  await page.getByLabel(runtimeDev.input).fill("Ada");
  await expect(chart(page)).toHaveAttribute("data-chart-state", "loading");
  await page.getByRole("button", { name: runtimeDev.run }).click();
  await expect(chart(page)).toContainText(runtimeDev.pending.run);
  await expect.poll(() => held).toBe(true);
  release();
  await expect(page.locator("[data-outcome]")).toHaveAttribute("data-outcome", "ok", {
    timeout: READY_MS,
  });
  await expect(page.getByTestId("runtime-output")).toHaveText("Hello, Ada\n");
});

test("[FR-GRD-01] the example solution passes its check and the lesson region passes", async ({
  page,
}) => {
  await ready(page);
  await page.getByRole("button", { name: runtimeDev.sampleSolution }).click();
  await page.getByRole("button", { name: runtimeDev.check }).click();
  const tests = page.getByTestId("runtime-tests").locator("li");
  await expect(tests).toHaveCount(EXAMPLE_LESSON.testCases.length);
  for (const status of await tests.all()) {
    await expect(status).toHaveAttribute("data-test-status", "passed");
  }
  await expect(chart(page)).toHaveAttribute("data-lesson", "passed");
  await expect(chart(page)).toHaveAttribute("data-chart-state", "ready");
});

test("[FR-RUN-02] [FR-WSP-07] a runaway loop is stopped at the limit and Python comes back", async ({
  page,
}) => {
  await ready(page);
  await page.getByRole("button", { name: runtimeDev.sampleLoop }).click();
  await page.getByRole("button", { name: runtimeDev.run }).click();
  await expect(chart(page)).toHaveAttribute("data-chart-state", "running");
  await expect(chart(page)).toHaveAttribute("data-chart-state", "restarting", { timeout: 15_000 });
  await expect(chart(page)).toContainText(runtimeDev.restartReason.time_limit);
  await ready(page);
  await expect(page.getByTestId("runtime-refused")).toHaveText("0");
});

test("[FR-WSP-07] Stop ends a running loop at once", async ({ page }) => {
  await ready(page);
  await page.getByRole("button", { name: runtimeDev.sampleLoop }).click();
  await page.getByRole("button", { name: runtimeDev.run }).click();
  await page.getByRole("button", { name: runtimeDev.stop }).click();
  await expect(chart(page)).toContainText(runtimeDev.restartReason.stopped);
  await ready(page);
});
