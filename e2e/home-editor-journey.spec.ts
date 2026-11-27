import { expect, test, type Page } from "@playwright/test";
import { homeEditor } from "../src/messages/catalog";
import {
  learnerErrorHeading,
  pythonErrorExplanations,
  workspace as words,
} from "../src/messages/workspace";
import { SOURCE_LIMIT } from "../src/runtime/protocol";
import { noAxeViolations } from "./journeys";
import { saveScreen } from "./screens";

// WP-7.5, FR-LND-01: the home page's live editor runs its program in the
// production runtime, on the production build. Python is not fetched when the
// page opens, only on the first Run or edit; the editor's code arrives after
// the page's load event (NFR-PERF-01). Every state of the editor, with axe and
// a screen at 375, 768 and 1280 px. Runs in the `stack` project: the home page
// reads the courses.
test.describe.configure({ timeout: 120_000 });

const WORK_PACKAGE = "WP-7.5";
const READY_MS = 60_000;
const WIDTHS = [375, 768, 1280] as const;
// A class name only CodeMirror's own code holds (e2e/page-weight-journey.spec.ts).
const EDITOR_MARKER = "cm-editor";

const section = (page: Page) => page.locator("[data-home-editor]");
const editor = (page: Page) => section(page).locator(".cm-content");
const consoleOutput = (page: Page) => section(page).getByTestId("console-output");
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

/** Python's files wait until `release` is called, so a state on the way is seen. */
async function holdPython(page: Page): Promise<() => void> {
  let release = () => {};
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route("**/_runtime/**", async (route) => {
    await held;
    await route.continue();
  });
  return release;
}

async function write(page: Page, code: string) {
  await editor(page).click();
  await page.keyboard.press("ControlOrMeta+A");
  await page.keyboard.press("Delete");
  await page.keyboard.insertText(code);
}

async function shot(page: Page, name: string, width: number) {
  await noAxeViolations(page);
  await saveScreen(page, name, width, { workPackage: WORK_PACKAGE });
}

for (const width of WIDTHS) {
  test.describe(`at ${String(width)} px`, () => {
    test.use({ viewport: { width, height: 900 } });

    test(`[FR-LND-01] the program is in the real editor and Python is not fetched`, async ({
      page,
    }) => {
      const requests = runtimeRequests(page);
      await page.goto("/");
      await expect(editor(page)).toHaveText(homeEditor.program.split("\n").join(""));
      await page.waitForLoadState("networkidle");
      expect(requests).toEqual([]);
      await expect(runButton(page)).toBeEnabled();
      await shot(page, "home-editor", width);
    });

    test(`[FR-LND-01] [FR-WSP-17] Run starts Python, keeps the press, and prints the output`, async ({
      page,
    }) => {
      const requests = runtimeRequests(page);
      const release = await holdPython(page);
      await page.goto("/");
      await expect(editor(page)).toBeVisible();
      await runButton(page).click();
      await expect(runButton(page)).toHaveText(new RegExp(words.runPending));
      await expect(section(page).locator('[data-python="loading"]')).toBeVisible();
      await shot(page, "home-editor-starting", width);
      release();

      await expect(consoleOutput(page)).toHaveText("Hello, Sara!\nS\na\nr\na\nDone.\n", {
        timeout: READY_MS,
      });
      expect(requests.length).toBeGreaterThan(0);
      await shot(page, "home-editor-ran", width);
    });

    test(`[FR-LND-01] [FR-WSP-23] an edited program's error reads as in a lesson, with what it means`, async ({
      page,
    }) => {
      await page.goto("/");
      await write(page, 'print("Mine")\nprint(10 / 0)\n');
      await runButton(page).click();
      await expect(consoleOutput(page)).toContainText("Mine", { timeout: READY_MS });
      await expect(
        section(page).getByRole("heading", {
          name: learnerErrorHeading("runtime", { line: 2, timeLimitSeconds: 0, outputLimit: 0 }),
        }),
      ).toBeVisible();
      await expect(
        section(page).getByText(pythonErrorExplanations.ZeroDivisionError),
      ).toBeVisible();
      await shot(page, "home-editor-error", width);
    });

    test(`[FR-LND-01] [FR-WSP-08] a program that asks for input waits for the answer`, async ({
      page,
    }) => {
      await page.goto("/");
      await write(page, 'name = input("Your name? ")\nprint("Hi, " + name)\n');
      await runButton(page).click();
      // The input line is labelled by the program's own prompt (section 6.3).
      const answer = section(page).getByRole("textbox", { name: "Your name?" });
      await expect(answer).toBeVisible({ timeout: READY_MS });
      await shot(page, "home-editor-input", width);
      await answer.fill("Omar");
      await answer.press("Enter");
      await expect(consoleOutput(page)).toContainText("Hi, Omar");
    });

    test(`[FR-LND-01] [FR-WSP-04] a program too large to run is refused with the reason`, async ({
      page,
    }) => {
      await page.goto("/");
      await write(page, `# ${"x".repeat(SOURCE_LIMIT)}\n`);
      await runButton(page).click();
      await expect(section(page).getByText(words.tooLarge("source", SOURCE_LIMIT))).toBeVisible();
      await shot(page, "home-editor-too-large", width);
    });

    test(`[FR-LND-01] [FR-WSP-17] Python that cannot start says so, and Retry is offered`, async ({
      page,
    }) => {
      await page.route("**/_runtime/**", (route) => route.abort());
      await page.goto("/");
      await expect(editor(page)).toBeVisible();
      await runButton(page).click();
      await expect(section(page).getByText(words.failed).first()).toBeVisible({
        timeout: READY_MS,
      });
      await expect(section(page).getByRole("button", { name: words.retry })).toBeVisible();
      await shot(page, "home-editor-failed", width);
    });

    test(`[FR-LND-01] [FR-SYS-02] a browser that cannot run Python sees why, with no Run`, async ({
      page,
    }) => {
      // The capability is removed in the page, never faked by user agent.
      await page.addInitScript(() => {
        Reflect.deleteProperty(window, "Worker");
      });
      await page.goto("/");
      await expect(page.getByText(words.unsupportedTitle)).toBeVisible();
      await expect(page.getByRole("button", { name: new RegExp(`^${words.run}`) })).toHaveCount(0);
      await shot(page, "home-editor-unsupported", width);
    });

    test(`[FR-LND-01] when the editor's code cannot be fetched, the program and Run stay`, async ({
      page,
    }) => {
      // Every script is fetched as usual, except the one that holds CodeMirror.
      await page.route("**/_next/static/**/*.js", async (route) => {
        const response = await route.fetch();
        const body = await response.text();
        if (body.includes(EDITOR_MARKER)) await route.abort();
        else await route.fulfill({ response, body });
      });
      await page.goto("/");
      await expect(page.getByText(homeEditor.editorFailed)).toBeVisible();
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      await runButton(page).click();
      await expect(consoleOutput(page)).toContainText("Hello, Sara!", { timeout: READY_MS });
      await shot(page, "home-editor-no-editor", width);
    });
  });
}
