import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { EXAMPLE_LESSON } from "../src/grader/example-lesson";
import { workspaceGallery } from "../src/messages/gallery";
import { learnerErrorHeading, workspace as words } from "../src/messages/workspace";
import { SOURCE_LIMIT } from "../src/runtime/protocol";
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
// the screenshots measure the settled colors.
async function settled(page: Page) {
  await page.waitForFunction(() => document.getAnimations().length === 0);
}

async function noAxeViolations(page: Page) {
  await settled(page);
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
}

async function screens(page: Page, name: string) {
  for (const width of WIDTHS) {
    await page.setViewportSize({ width, height: 900 });
    await settled(page);
    await saveScreen(page, name, width, { workPackage: WORK_PACKAGE, fullPage: width < 768 });
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

test("[FR-WSP-07] J-4: Stop ends a runaway loop, Python comes back, and the next Run works", async ({
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
  await screens(page, "workspace-stopped");
  await ready(page);
  await write(page, 'print("again")\n');
  await runButton(page).click();
  await expect(consoleOutput(page)).toHaveText("again\n");
});

test("[FR-WSP-12] [NFR-A11Y-03] the keyboard runs code, and Escape then Tab leaves the editor", async ({
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
});

test("[T-07] output that looks like markup is shown as text", async ({ page }) => {
  await ready(page);
  const payload = "<img src=x onerror=\"document.title='owned'\"><b>bold</b>";
  await write(page, `print(${JSON.stringify(payload)})\n`);
  await runButton(page).click();
  await expect(consoleOutput(page)).toHaveText(`${payload}\n`);
  await expect(consoleOutput(page).locator("img, b")).toHaveCount(0);
  expect(await page.title()).not.toBe("owned");
});

test("[FR-WSP-04] a program over the worker's limit is refused with the reason", async ({
  page,
}) => {
  await ready(page);
  await write(page, `#${"x".repeat(SOURCE_LIMIT)}`);
  await runButton(page).click();
  await expect(page.getByText(words.tooLarge("source", SOURCE_LIMIT))).toBeVisible();
  await expect(page.getByText(words.consoleEmpty)).toBeVisible();
  await write(page, 'print("fits")\n');
  await expect(page.getByText(words.tooLarge("source", SOURCE_LIMIT))).toHaveCount(0);
});
