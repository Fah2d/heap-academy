import AxeBuilder from "@axe-core/playwright";
import { expect, type Locator, type Page } from "@playwright/test";
import { EXAMPLE_LESSON } from "../src/grader/example-lesson";
import { workspaceGallery } from "../src/messages/gallery";
import { learnerErrorHeading, workspace as words } from "../src/messages/workspace";

// WP-7.4: journeys J-1 to J-4 (docs/spec/01-requirements.md section 2), each
// written once and walked at phone and laptop sizes (NFR-COMPAT-03). They run
// on the development-only page /dev/workspace, which holds the example lesson
// with no database. On a phone (below 768 px) the workspace shows one view at
// a time, so a journey taps to the view it needs; on a laptop every part is
// on the screen and it clicks. e2e/journeys-phone.spec.ts and
// e2e/journeys-wide-runtime.spec.ts choose the sizes and engines.

export const READY_MS = 60_000;

export type Device = { phone: boolean };

const python = (page: Page) => page.locator("[data-python]");
const editor = (page: Page) => page.locator(".cm-content");
const consoleOutput = (page: Page) => page.getByTestId("console-output");
const button = (page: Page, name: string) =>
  page.getByRole("button", { name: new RegExp(`^${name}`) });
const view = (page: Page, name: string) =>
  page.getByRole("tablist", { name: words.views }).getByRole("tab", { name });

async function press(target: Locator, { phone }: Device) {
  await (phone ? target.tap() : target.click());
}

async function ready(page: Page) {
  await expect(python(page)).toHaveAttribute("data-python", "ready", { timeout: READY_MS });
}

// A state change has a 160 ms color transition (DESIGN.md section 7); axe
// measures the settled colors. Endless animations, such as the editor's
// blinking cursor, are not waited for.
async function noAxeViolations(page: Page) {
  await page.waitForFunction(() =>
    document
      .getAnimations()
      .every((animation) => animation.effect?.getComputedTiming().iterations === Infinity),
  );
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
}

// NFR-COMPAT-03: the page itself never scrolls sideways, at any width.
async function noSidewaysScroll(page: Page) {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
}

async function showView(page: Page, name: string, device: Device) {
  if (!device.phone) return;
  await press(view(page, name), device);
  await expect(view(page, name)).toHaveAttribute("aria-selected", "true");
}

async function write(page: Page, code: string, device: Device) {
  await showView(page, words.viewCode, device);
  await press(editor(page), device);
  await page.keyboard.press("ControlOrMeta+A");
  await page.keyboard.press("Delete");
  await page.keyboard.insertText(code);
  await expect(editor(page)).toContainText(code.split("\n")[0] ?? "");
}

// J-1: the lesson reads at once and the editor takes typing before Python is
// ready; Run shows the output.
export async function videoToFirstRun(page: Page, device: Device) {
  // Python's files are held at first, as on a slow phone connection.
  let release: () => void = () => undefined;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.context().route("**/_runtime/pyodide/**", async (route) => {
    await gate;
    await route.continue();
  });
  await page.goto("/dev/workspace");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(EXAMPLE_LESSON.title);
  await expect(page.getByRole("heading", { name: "Your task" })).toBeVisible();
  await noSidewaysScroll(page);

  if (device.phone) {
    await press(button(page, words.toCode), device);
    await expect(view(page, words.viewCode)).toHaveAttribute("aria-selected", "true");
  }
  await expect(python(page)).toHaveAttribute("data-python", /idle|loading/);
  await write(page, 'print("my first run")\n', device);
  await noAxeViolations(page);

  release();
  await ready(page);
  await press(button(page, words.run), device);
  await expect(consoleOutput(page)).toHaveText("my first run\n");
  if (device.phone) {
    await expect(view(page, words.viewOutput)).toHaveAttribute("aria-selected", "true");
  }
  await noSidewaysScroll(page);
  await noAxeViolations(page);
}

// J-2: Check, a failing test case with expected and actual output, a fix,
// a pass, the completion moment, and Next to the following lesson.
export async function completeALesson(page: Page, device: Device) {
  await page.goto("/dev/workspace");
  await ready(page);
  const summary = page.locator("[data-summary]");

  await press(button(page, words.check), device);
  await expect(summary).toHaveText(words.summary(0, 2));
  await expect(page.getByText(words.expected).first()).toBeVisible();
  await expect(page.getByText(EXAMPLE_LESSON.testCases[0]?.expected ?? "").first()).toBeVisible();
  await noSidewaysScroll(page);
  await noAxeViolations(page);

  await write(page, EXAMPLE_LESSON.wrongAnswer.code, device);
  await press(button(page, words.check), device);
  await expect(summary).toHaveText(words.summary(1, 2));
  await expect(page.locator('li[data-test-status="failed"]')).toHaveCount(1);

  await write(page, EXAMPLE_LESSON.solution, device);
  await press(button(page, words.check), device);
  await expect(summary).toHaveText(words.summary(2, 2));
  await expect(page.locator("[data-completion]")).toHaveText(words.completeFirst(10));
  const next = page.getByRole("link", {
    name: words.neighbour(words.next, workspaceGallery.next.title),
  });
  await expect(next).toBeVisible();
  await expect(next).toHaveAttribute(
    "href",
    `/learn/${workspaceGallery.courseSlug}/${workspaceGallery.next.slug}`,
  );
  await noSidewaysScroll(page);
  await noAxeViolations(page);
}

// J-3: a program that calls input() twice. The console asks for each answer
// where the browser can pause a program; elsewhere the Input field takes the
// answers before Run (FR-WSP-08).
export async function programThatAsksForInput(page: Page, device: Device) {
  await page.goto("/dev/workspace");
  await ready(page);
  await write(page, 'a = input("First? ")\nb = input("Second? ")\nprint(a + b)\n', device);
  await showView(page, words.viewOutput, device);
  const batch = page.getByLabel(words.batchLabel);
  const interactive = !(await batch.isVisible());
  if (!interactive) await batch.fill("4\n2");
  await press(button(page, words.run), device);
  if (interactive) {
    for (const [prompt, answer] of [
      ["First?", "4"],
      ["Second?", "2"],
    ] as const) {
      const field = page.getByLabel(prompt);
      await expect(field).toBeVisible();
      await expect(field).toBeFocused();
      await noAxeViolations(page);
      await field.fill(answer);
      await field.press("Enter");
    }
  }
  await expect(consoleOutput(page)).toContainText("42");
  await expect(page.getByRole("status").filter({ hasText: "Run finished" })).toBeAttached();
  await noSidewaysScroll(page);
}

// J-4: a runaway loop is stopped, Python comes back without a reload, and
// the next Run works.
export async function runawayCode(page: Page, device: Device) {
  await page.goto("/dev/workspace");
  await ready(page);
  await write(page, "while True:\n    pass\n", device);
  await press(button(page, words.run), device);
  const stop = page.getByRole("button", { name: words.stop, exact: true });
  await expect(stop).toBeEnabled();
  await press(stop, device);
  await expect(
    page.getByRole("heading", {
      name: learnerErrorHeading("stopped", {
        line: undefined,
        timeLimitSeconds: 0,
        outputLimit: 0,
      }),
    }),
  ).toBeVisible();
  await noSidewaysScroll(page);
  await noAxeViolations(page);
  await ready(page);
  await write(page, 'print("again")\n', device);
  await press(button(page, words.run), device);
  await expect(consoleOutput(page)).toHaveText("again\n");
}
