import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { EXAMPLE_LESSON } from "../src/grader/example-lesson";
import { workspaceGallery } from "../src/messages/gallery";
import { goToLine, learnerErrorHeading, workspace as words } from "../src/messages/workspace";
import { SOURCE_LIMIT } from "../src/runtime/protocol";
import { invitation } from "../src/messages/sign-in";
import { saveScreen } from "./screens";

// WP-5.2: the lesson workspace on a laptop, on the development-only page
// /dev/workspace, which holds the example lesson of
// docs/spec/04-content-system.md section 7 with no database. Runs in the
// runtime-* projects against the development server. J-2's completion line
// and XP (FR-WSP-06) are WP-5.4's; here J-2 ends with the lesson passed and
// Next as the primary action.
test.describe.configure({ timeout: 120_000 });

const READY_MS = 60_000;
const WIDTHS = [1280, 768, 375] as const;
const WORK_PACKAGE = "WP-5.2";

const python = (page: Page) => page.locator("[data-python]");
const editor = (page: Page) => page.locator(".cm-content");
const consoleOutput = (page: Page) => page.getByTestId("console-output");
const runButton = (page: Page) => page.getByRole("button", { name: new RegExp(`^${words.run}`) });
const checkButton = (page: Page) =>
  page.getByRole("button", { name: new RegExp(`^${words.check}`) });
const stopButton = (page: Page) => page.getByRole("button", { name: words.stop, exact: true });

async function ready(page: Page) {
  await expect(python(page)).toHaveAttribute("data-python", "ready", { timeout: READY_MS });
}

async function write(page: Page, code: string) {
  await editor(page).click();
  await page.keyboard.press("ControlOrMeta+A");
  await page.keyboard.press("Delete");
  await page.keyboard.insertText(code);
}

// A state change has a 160 ms color transition (DESIGN.md section 7); axe and
// the screenshots measure the settled colors. Endless animations, such as the
// editor's blinking cursor, are not waited for.
async function settled(page: Page) {
  await page.waitForFunction(() =>
    document
      .getAnimations()
      .every((animation) => animation.effect?.getComputedTiming().iterations === Infinity),
  );
}

async function noAxeViolations(page: Page) {
  await settled(page);
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
}

async function screens(page: Page, name: string, workPackage?: string) {
  for (const width of WIDTHS) {
    await page.setViewportSize({ width, height: 900 });
    await settled(page);
    // Below 768 px the screen is WP-5.3's phone layout, unless a later package owns the state.
    await saveScreen(page, name, width, {
      workPackage: workPackage ?? (width < 768 ? "WP-5.3" : WORK_PACKAGE),
      fullPage: width < 768,
    });
  }
  await page.setViewportSize({ width: 1280, height: 900 });
}

test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/dev/workspace");
});

test("[FR-WSP-01] [FR-WSP-02] [FR-WSP-17] the lesson, its instructions and Python's status", async ({
  page,
}) => {
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(EXAMPLE_LESSON.title);
  await expect(page.getByRole("heading", { name: "Your task" })).toBeVisible();
  await expect(
    page.getByRole("link", { name: words.backToCourse(workspaceGallery.courseTitle) }),
  ).toBeVisible();
  await expect(page.getByText(words.consoleEmpty)).toBeVisible();
  await ready(page);
  await noAxeViolations(page);
  await screens(page, "workspace-ready");
});

test("[FR-WSP-05] [FR-WSP-11] J-2: check, see a failure with expected and actual output, fix, pass", async ({
  page,
}) => {
  await ready(page);
  await checkButton(page).click();
  const summary = page.locator("[data-summary]");
  await expect(summary).toHaveText(words.summary(0, 2));
  await expect(summary).toBeFocused();
  await expect(page.getByRole("status").filter({ hasText: words.summary(0, 2) })).toBeAttached();
  await expect(page.getByText(words.expected).first()).toBeVisible();
  await expect(page.getByText(EXAMPLE_LESSON.testCases[0]?.expected ?? "").first()).toBeVisible();
  await noAxeViolations(page);
  await screens(page, "workspace-check-failed");

  await write(page, EXAMPLE_LESSON.wrongAnswer.code);
  await checkButton(page).click();
  await expect(summary).toHaveText(words.summary(1, 2));
  await expect(page.locator('li[data-test-status="passed"]')).toHaveCount(1);
  await expect(page.locator('li[data-test-status="failed"]')).toHaveCount(1);

  await write(page, EXAMPLE_LESSON.solution);
  await checkButton(page).click();
  await expect(summary).toHaveText(words.summary(2, 2));
  await expect(summary).toHaveAttribute("data-summary", "passed");
  const next = page.getByRole("link", {
    name: words.neighbour(words.next, workspaceGallery.next.title),
  });
  await expect(next).toHaveAttribute(
    "href",
    `/learn/${workspaceGallery.courseSlug}/${workspaceGallery.next.slug}`,
  );
  await noAxeViolations(page);
  await screens(page, "workspace-passed");
});

// WP-5.4: a pass is kept on the device, survives a reload, and earns its XP once.
test("[FR-WSP-06] [FR-PRG-01] a pass shows its XP once and is kept after a reload", async ({
  page,
}) => {
  await ready(page);
  await write(page, EXAMPLE_LESSON.solution);
  await checkButton(page).click();
  const completion = page.locator("[data-completion]");
  await expect(completion).toHaveText(words.completeFirst(10));
  await expect(
    page.getByRole("status").filter({ hasText: words.completeFirst(10) }),
  ).toBeAttached();
  await expect(page.getByText(words.memoryTitle)).toHaveCount(0);
  // The pass is on the device with the code that was checked.
  const kept = await page.evaluate(
    () =>
      new Promise<unknown[]>((resolve, reject) => {
        const open = indexedDB.open("heap-academy");
        open.onerror = () => {
          reject(open.error ?? new Error("IndexedDB open failed"));
        };
        open.onsuccess = () => {
          const database = open.result;
          const read = database.transaction("completions").objectStore("completions").getAll();
          read.onsuccess = () => {
            database.close();
            resolve(read.result);
          };
          read.onerror = () => {
            database.close();
            reject(read.error ?? new Error("IndexedDB read failed"));
          };
        };
      }),
  );
  expect(kept).toEqual([
    expect.objectContaining({ code: `${EXAMPLE_LESSON.solution}`, synced: false }),
  ]);
  await noAxeViolations(page);
  await screens(page, "workspace-complete", "WP-5.4");

  await page.reload();
  await ready(page);
  await expect(page.getByText(words.restored)).toBeVisible();
  await checkButton(page).click();
  await expect(completion).toHaveText(words.completeAgain);
});

test("[FR-AUTH-07] [FR-PRG-01] a guest is invited to save progress after a first pass, and can hide it", async ({
  page,
}) => {
  await ready(page);
  await write(page, EXAMPLE_LESSON.solution);
  await checkButton(page).click();
  await expect(page.locator("[data-completion]")).toHaveText(words.completeFirst(10));
  const card = page.getByRole("region", { name: invitation.label });
  await expect(card).toContainText(invitation.body);
  await expect(card.getByRole("link", { name: invitation.signIn })).toHaveAttribute(
    "href",
    `/sign-in?${new URLSearchParams({ returnTo: "/dev/workspace" }).toString()}`,
  );
  // Inline, not a dialog: the next action stays available.
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(checkButton(page)).toBeEnabled();
  await noAxeViolations(page);
  await screens(page, "workspace-invitation", "WP-5.4");
  await card.getByRole("button", { name: invitation.dismiss }).click();
  await expect(card).toHaveCount(0);
  // Focus goes on to the tests' summary, which is seen and read out.
  await expect(page.locator("[data-summary]")).toBeFocused();
});

test("[FR-WSP-08] J-3: a program that asks for input twice", async ({ page }) => {
  await ready(page);
  await write(page, 'a = input("First? ")\nb = input("Second? ")\nprint(a + b)\n');
  const batch = page.getByLabel(words.batchLabel);
  const interactive = !(await batch.isVisible());
  if (!interactive) await batch.fill("4\n2");
  await runButton(page).click();
  if (interactive) {
    const first = page.getByLabel("First?");
    await expect(first).toBeVisible();
    await expect(first).toBeFocused();
    await noAxeViolations(page);
    await screens(page, "workspace-input");
    await first.fill("4");
    await first.press("Enter");
    const second = page.getByLabel("Second?");
    await expect(second).toBeVisible();
    await expect(second).toBeFocused();
    await second.fill("2");
    await second.press("Enter");
  }
  await expect(consoleOutput(page)).toContainText("42");
  await expect(page.getByRole("status").filter({ hasText: "Run finished" })).toBeAttached();
});

test("[FR-WSP-07] [T-02] J-4: Stop ends a runaway loop, Python comes back, and the next Run works", async ({
  page,
}) => {
  await ready(page);
  await write(page, "while True:\n    pass\n");
  await runButton(page).click();
  await expect(stopButton(page)).toBeEnabled();
  await stopButton(page).click();
  await expect(
    page.getByRole("heading", {
      name: learnerErrorHeading("stopped", {
        line: undefined,
        timeLimitSeconds: 0,
        outputLimit: 0,
      }),
    }),
  ).toBeVisible();
  await noAxeViolations(page);
  await screens(page, "workspace-stopped");
  await ready(page);
  await write(page, 'print("again")\n');
  await runButton(page).click();
  await expect(consoleOutput(page)).toHaveText("again\n");
});

test("[FR-WSP-07] [FR-WSP-17] output over the limit replaces Python, which says it is restarting", async ({
  page,
}) => {
  await ready(page);
  // The new worker's files are held, so the restarting state stays on screen.
  let release: () => void = () => undefined;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.context().route("**/_runtime/pyodide/**", async (route) => {
    await gate;
    await route.continue();
  });
  await write(page, 'while True:\n    print("x" * 1000)\n');
  await runButton(page).click();
  await expect(
    page.getByRole("heading", {
      name: learnerErrorHeading("output_limit", {
        line: undefined,
        timeLimitSeconds: 0,
        outputLimit: 0,
      }),
    }),
  ).toBeVisible();
  await expect(python(page)).toHaveAttribute("data-python", "restarting");
  await expect(page.getByText(words.restarting).first()).toBeVisible();
  await expect(editor(page)).toContainText('print("x" * 1000)');
  await noAxeViolations(page);
  // Below 768 px the console scrolls inside its 24 rem ceiling, so the error
  // card stays near the output instead of below thousands of lines.
  await page.setViewportSize({ width: 375, height: 900 });
  // The phone layout draws the console a moment after the resize; wait for it.
  const consoleRegion = page.getByRole("region", { name: words.consoleLabel });
  await expect(consoleRegion).toBeVisible();
  const consoleBox = await consoleRegion.boundingBox();
  expect(consoleBox?.height).toBeLessThanOrEqual(384);
  await screens(page, "workspace-restarting");
  release();
  await ready(page);
  await write(page, 'print("back")\n');
  await runButton(page).click();
  await expect(consoleOutput(page)).toHaveText("back\n");
});

test("[FR-WSP-03] [FR-WSP-12] [NFR-A11Y-03] the keyboard runs code, and Escape then Tab leaves the editor", async ({
  page,
}) => {
  await ready(page);
  await write(page, 'print("from the keyboard")\n');
  await page.keyboard.press("Control+Enter");
  await expect(consoleOutput(page)).toHaveText("from the keyboard\n");
  await expect(editor(page)).toHaveText('print("from the keyboard")');
  await editor(page).click();
  await page.keyboard.press("Escape");
  await page.keyboard.press("Tab");
  await expect(editor(page)).not.toBeFocused();
  await noAxeViolations(page);
});

test("[T-07] output that looks like markup is shown as text", async ({ page }) => {
  await ready(page);
  const payload = "<img src=x onerror=\"document.title='owned'\"><b>bold</b>";
  await write(page, `print(${JSON.stringify(payload)})\n`);
  await runButton(page).click();
  await expect(consoleOutput(page)).toHaveText(`${payload}\n`);
  await expect(consoleOutput(page).locator("img, b")).toHaveCount(0);
  expect(await page.title()).not.toBe("owned");
  await noAxeViolations(page);
});

test("[FR-WSP-04] a program over the worker's limit is refused with the reason", async ({
  page,
}) => {
  await ready(page);
  await write(page, `#${"x".repeat(SOURCE_LIMIT)}`);
  await runButton(page).click();
  await expect(page.getByText(words.tooLarge("source", SOURCE_LIMIT))).toBeVisible();
  await expect(page.getByText(words.consoleEmpty)).toBeVisible();
  await noAxeViolations(page);
  await screens(page, "workspace-refused");
  await write(page, 'print("fits")\n');
  await expect(page.getByText(words.tooLarge("source", SOURCE_LIMIT))).toHaveCount(0);
});

test("[NFR-PERF-03] [FR-WSP-17] while Python loads, the lesson reads and the editor takes typing", async ({
  page,
}) => {
  // Python's files are held, as on a slow connection.
  let release: () => void = () => undefined;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.context().route("**/_runtime/pyodide/**", async (route) => {
    await gate;
    await route.continue();
  });
  await page.reload();
  await expect(python(page)).toHaveAttribute("data-python", /idle|loading/);
  await expect(page.getByRole("heading", { name: "Your task" })).toBeVisible();
  await write(page, 'print("typed while loading")\n');
  await expect(editor(page)).toHaveText('print("typed while loading")');
  await expect(page.getByText(words.starting).first()).toBeVisible();
  await noAxeViolations(page);
  await screens(page, "workspace-loading");
  release();
  await ready(page);
});

test("[FR-WSP-17] a failed load offers Retry", async ({ page }) => {
  await page.context().route("**/_runtime/pyodide/**", (route) => route.abort());
  await page.reload();
  await expect(python(page)).toHaveAttribute("data-python", "failed", { timeout: READY_MS });
  await expect(page.getByRole("button", { name: words.retry })).toBeVisible();
  await noAxeViolations(page);
  await screens(page, "workspace-load-failed");
  await page.context().unroute("**/_runtime/pyodide/**");
  await page.getByRole("button", { name: words.retry }).click();
  await ready(page);
});

test("[FR-WSP-09] a syntax error names its line, and Go to line moves the cursor there", async ({
  page,
}) => {
  await ready(page);
  await write(page, 'name = "Ada"\nprint(name\n');
  await runButton(page).click();
  const go = page.getByRole("button", { name: goToLine(2) });
  await expect(go).toBeVisible();
  await noAxeViolations(page);
  await screens(page, "workspace-syntax-error");
  await go.click();
  await expect(editor(page)).toBeFocused();
});

test("[FR-WSP-10] reset asks first, and Undo brings the code back", async ({ page }) => {
  await ready(page);
  await write(page, 'print("mine")\n');
  await page.getByRole("button", { name: words.reset }).click();
  await page.getByRole("dialog").getByRole("button", { name: words.resetConfirm }).click();
  await expect(editor(page)).toHaveText(EXAMPLE_LESSON.starter.trimEnd());
  await expect(page.getByText(words.resetDone)).toBeVisible();
  await noAxeViolations(page);
  await screens(page, "workspace-reset");
  await page.getByRole("button", { name: words.undo }).click();
  await expect(editor(page)).toHaveText('print("mine")');
});

test("[FR-PRG-01] saved code comes back on the next visit", async ({ page }) => {
  await ready(page);
  await write(page, 'print("kept")\n');
  // Saved when typing pauses (400 ms). The reload waits until the device has it.
  await expect
    .poll(() =>
      page.evaluate(
        (key) =>
          new Promise<unknown>((resolve, reject) => {
            // No version: whatever version the workspace opened. Closed after
            // the read, so it never holds up the workspace's own upgrade.
            const open = indexedDB.open("heap-academy");
            open.onerror = () => {
              reject(open.error ?? new Error("IndexedDB open failed"));
            };
            open.onsuccess = () => {
              const database = open.result;
              const read = database.transaction("code").objectStore("code").get(key);
              read.onsuccess = () => {
                database.close();
                resolve(read.result);
              };
              read.onerror = () => {
                database.close();
                reject(read.error ?? new Error("IndexedDB read failed"));
              };
            };
          }),
        `${workspaceGallery.courseSlug}/${workspaceGallery.lessonSlug}`,
      ),
    )
    .toBe('print("kept")\n');
  await page.reload();
  await expect(page.getByText(words.restored)).toBeVisible();
  await expect(editor(page)).toHaveText('print("kept")');
  await noAxeViolations(page);
  await screens(page, "workspace-restored");
});

test("[FR-SYS-02] a browser that cannot run Python sees why, not a broken workspace", async ({
  page,
}) => {
  await page.addInitScript(() => {
    Reflect.deleteProperty(window, "Worker");
  });
  await page.reload();
  await expect(page.getByText(words.unsupportedTitle)).toBeVisible();
  await expect(runButton(page)).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Your task" })).toBeVisible();
  await noAxeViolations(page);
  await screens(page, "workspace-unsupported");
});

test("[NFR-A11Y-01] a program longer than the editor stays reachable by keyboard", async ({
  page,
}) => {
  await ready(page);
  await write(page, Array.from({ length: 60 }, (_, line) => `print(${line})`).join("\n"));
  await noAxeViolations(page);
});
