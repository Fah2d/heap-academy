import { expect, test, type Page } from "@playwright/test";
import { homeEditor } from "../src/messages/catalog";
import { learnerErrorHeading, workspace as words } from "../src/messages/workspace";
import { noAxeViolations } from "./journeys";
import { saveScreen } from "./screens";

// WP-7.5, FR-LND-01: the home page's live editor runs its program in the
// production runtime, on the production build. Python is not fetched when the
// page opens, only on the first Run; the editor's code arrives after the
// page's load event (NFR-PERF-01). Axe on every state, screens at 375, 768
// and 1280 px. Runs in the `stack` project: the home page reads the courses.
test.describe.configure({ timeout: 120_000 });

const WORK_PACKAGE = "WP-7.5";
const READY_MS = 60_000;

const section = (page: Page) => page.locator("[data-home-editor]");
const editor = (page: Page) => section(page).locator(".cm-content");
const console_ = (page: Page) => section(page).getByTestId("console-output");
const runButton = (page: Page) =>
  section(page).getByRole("button", { name: new RegExp(`^${words.run}`) });

/** Records every request for the Python runtime's files. */
function runtimeRequests(page: Page): string[] {
  const seen: string[] = [];
  page.on("request", (request) => {
    if (new URL(request.url()).pathname.startsWith("/_runtime/")) seen.push(request.url());
  });
  return seen;
}

for (const width of [375, 768, 1280]) {
  test(`[FR-LND-01] at ${String(width)} px the program is in the real editor and Python is not fetched`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    const requests = runtimeRequests(page);
    await page.goto("/");
    await expect(editor(page)).toHaveText(homeEditor.program.trimEnd().split("\n").join(""));
    await expect(editor(page)).toHaveAttribute("aria-labelledby", /.+/);
    await expect(runButton(page)).toBeEnabled();
    expect(requests).toEqual([]);
    await noAxeViolations(page);
    await saveScreen(page, "home-editor", width, { workPackage: WORK_PACKAGE });
  });
}

test("[FR-LND-01] [FR-WSP-17] Run starts Python, keeps the press, and prints the program's output", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  const requests = runtimeRequests(page);
  // Python's files wait until the starting state has been checked, so the
  // check never races a fast load.
  let release = () => {};
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route("**/_runtime/**", async (route) => {
    await held;
    await route.continue();
  });
  await page.goto("/");
  await expect(editor(page)).toBeVisible();
  await runButton(page).click();
  await expect(runButton(page)).toHaveText(new RegExp(words.runPending));
  await expect(section(page).locator('[data-python="loading"]')).toBeVisible();
  await expect(section(page).getByRole("status").filter({ hasText: words.starting })).toHaveCount(
    1,
  );
  await noAxeViolations(page);
  await saveScreen(page, "home-editor-starting", 1280, { workPackage: WORK_PACKAGE });
  release();

  await expect(console_(page)).toHaveText("Hello, Sara!\nS\na\nr\na\nDone.\n", {
    timeout: READY_MS,
  });
  expect(requests.length).toBeGreaterThan(0);
  await noAxeViolations(page);
  await saveScreen(page, "home-editor-ran", 1280, { workPackage: WORK_PACKAGE });
});

test("[FR-LND-01] an edited program runs, and its error is shown the way a lesson shows it", async ({
  page,
}) => {
  await page.setViewportSize({ width: 375, height: 900 });
  await page.goto("/");
  await editor(page).click();
  await page.keyboard.press("ControlOrMeta+A");
  await page.keyboard.press("Delete");
  await page.keyboard.insertText('print("Mine")\nprint(10 / 0)\n');
  await runButton(page).click();
  await expect(console_(page)).toContainText("Mine", { timeout: READY_MS });
  await expect(
    section(page).getByRole("heading", {
      name: learnerErrorHeading("runtime", { line: 2, timeLimitSeconds: 0, outputLimit: 0 }),
    }),
  ).toBeVisible();
  await noAxeViolations(page);
  await saveScreen(page, "home-editor-error", 375, { workPackage: WORK_PACKAGE });
});
