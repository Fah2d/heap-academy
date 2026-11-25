import { expect, test, type Page } from "@playwright/test";
import { EXAMPLE_LESSON } from "../src/grader/example-lesson";
import { workspace as words } from "../src/messages/workspace";

// WP-7.2: the workspace on a throttled phone profile (NFR-PERF-03), and the
// time a one-line Run takes once Python is ready (NFR-PERF-06). The numbers
// go to the test's annotations and to docs/reports/day-7-quality.md. Runs in
// the `profile` project only: Chromium, because the throttling is the Chrome
// DevTools Protocol's, against the development server's /dev/workspace.
test.describe.configure({ timeout: 300_000 });

const READY_MS = 240_000;
// Lighthouse's mobile profile: 150 ms round trip, 1.6 Mbit/s down,
// 750 kbit/s up, and a processor four times slower.
const THROTTLE = {
  latency: 150,
  downloadThroughput: (1.6 * 1024 * 1024) / 8,
  uploadThroughput: (750 * 1024) / 8,
  cpuSlowdown: 4,
};
const PHONE = { width: 412, height: 915 };
const RUN_LIMIT_MS = 150;

const python = (page: Page) => page.locator("[data-python]");
const editor = (page: Page) => page.locator(".cm-content");

function note(type: string, description: string) {
  test.info().annotations.push({ type, description });
}

test("[NFR-PERF-03] on a throttled phone, the lesson reads and the editor takes typing before Python is ready", async ({
  page,
}) => {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Network.enable");
  await cdp.send("Network.setCacheDisabled", { cacheDisabled: true });
  await cdp.send("Network.emulateNetworkConditions", {
    offline: false,
    latency: THROTTLE.latency,
    downloadThroughput: THROTTLE.downloadThroughput,
    uploadThroughput: THROTTLE.uploadThroughput,
  });
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: THROTTLE.cpuSlowdown });
  // Counted from Playwright's events, which include the Python worker's own
  // requests; the protocol session above sees only the page's.
  let runtimeBytes = 0;
  let pageBytes = 0;
  const sizes: Promise<void>[] = [];
  page.on("requestfinished", (request) => {
    sizes.push(
      request.sizes().then((size) => {
        const bytes = size.responseBodySize + size.responseHeadersSize;
        if (request.url().includes("/_runtime/")) runtimeBytes += bytes;
        else pageBytes += bytes;
      }),
    );
  });

  await page.setViewportSize(PHONE);
  const started = Date.now();
  await page.goto("/dev/workspace", { waitUntil: "commit" });
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(EXAMPLE_LESSON.title, {
    timeout: READY_MS,
  });
  const lessonMs = Date.now() - started;

  await page.getByRole("tab", { name: words.viewCode }).click();
  await editor(page).click();
  await page.keyboard.insertText('print("typed early")');
  await expect(editor(page)).toContainText('print("typed early")');
  const typedMs = Date.now() - started;
  const stateWhenTyped = await python(page).getAttribute("data-python");

  await expect(python(page)).toHaveAttribute("data-python", "ready", { timeout: READY_MS });
  const readyMs = Date.now() - started;
  await Promise.all(sizes);

  note("lesson readable (ms)", String(lessonMs));
  note("editor took typing (ms)", String(typedMs));
  note("Python ready (ms)", String(readyMs));
  note("page bytes over the network", String(pageBytes));
  note("Python runtime bytes over the network", String(runtimeBytes));
  note("Python state when the typing landed", String(stateWhenTyped));

  expect(stateWhenTyped).not.toBe("ready");
  expect(lessonMs).toBeLessThan(readyMs);
  expect(typedMs).toBeLessThan(readyMs);
});

test("[NFR-PERF-06] on a laptop, a one-line Run answers in 150 ms or less once Python is ready", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/dev/workspace");
  await expect(python(page)).toHaveAttribute("data-python", "ready", { timeout: READY_MS });
  const run = page.getByRole("button", { name: new RegExp(`^${words.run}`) });
  // The first Run warms the worker; the next five are measured in the page,
  // from the press to the output on screen. Each prints its own line, so the
  // previous output never counts.
  const timings: number[] = [];
  for (let attempt = 0; attempt < 6; attempt += 1) {
    await editor(page).click();
    await page.keyboard.press("ControlOrMeta+A");
    await page.keyboard.press("Delete");
    await page.keyboard.insertText(`print("fast ${String(attempt)}")`);
    const elapsed = await run.evaluate(
      (button, expected) =>
        new Promise<number>((resolve) => {
          const shown = () =>
            document.querySelector('[data-testid="console-output"]')?.textContent === expected;
          const start = performance.now();
          const observer = new MutationObserver(() => {
            if (shown()) {
              observer.disconnect();
              resolve(performance.now() - start);
            }
          });
          observer.observe(document.body, { subtree: true, childList: true, characterData: true });
          (button as HTMLButtonElement).click();
        }),
      `fast ${String(attempt)}\n`,
    );
    if (attempt > 0) timings.push(Math.round(elapsed));
    await expect(python(page)).toHaveAttribute("data-python", "ready");
  }
  note("one-line Run, press to output (ms)", timings.join(", "));
  expect(Math.max(...timings)).toBeLessThanOrEqual(RUN_LIMIT_MS);
});
