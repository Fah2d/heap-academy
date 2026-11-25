import AxeBuilder from "@axe-core/playwright";
import { expect, type Locator, type Page } from "@playwright/test";
import { EXAMPLE_LESSON } from "../src/grader/example-lesson";
import { workspaceGallery } from "../src/messages/gallery";
import { learnerErrorHeading, workspace as words } from "../src/messages/workspace";

// WP-7.4: journeys J-1 to J-4 (docs/spec/01-requirements.md section 2), each
// written once and walked at phone and laptop sizes (NFR-COMPAT-03), in each
// engine (NFR-COMPAT-01). Each takes the lesson it walks: the development-only
// page /dev/workspace, which holds the example lesson with no database, or a
// lesson on its real address, which needs the local stack
// (e2e/lesson-route-journey.spec.ts writes two). Every target has the example
// lesson's title or its own, and the example lesson's starter, wrong answer,
// solution and test cases (docs/spec/04-content-system.md section 7). On a
// phone (below 768 px) the workspace shows one view at a time, so a journey
// taps to the view it needs; on a laptop every part is on the screen and it
// clicks. e2e/journeys-phone.spec.ts, e2e/journeys-wide-runtime.spec.ts and
// e2e/lesson-route-journey.spec.ts choose the sizes and engines.

export const READY_MS = 60_000;

export type Device = { phone: boolean };

/**
 * The lesson a journey walks. `course` is the back link's course, checked
 * where the database supplies it. `next` is the lesson after it, or `null` at
 * the end of a course; `follow` says whether that lesson exists to be opened.
 */
export type Target = {
  address: string;
  title: string;
  xp: number;
  course: { title: string; slug: string } | null;
  next: { href: string; title: string; follow: boolean } | null;
};

// workspace-gallery.tsx gives the example lesson 10 XP; its Next names a
// lesson that is not on the development page, so only its address is checked.
export const DEV_WORKSPACE: Target = {
  address: "/dev/workspace",
  title: EXAMPLE_LESSON.title,
  xp: 10,
  course: null,
  next: {
    href: `/learn/${workspaceGallery.courseSlug}/${workspaceGallery.next.slug}`,
    title: workspaceGallery.next.title,
    follow: false,
  },
};

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
// ready; Run shows the output. On a phone the Lesson view comes first. J-1 on
// the development page's phone layout, with that layout's own checks, is in
// e2e/workspace-phone.spec.ts.
export async function videoToFirstRun(page: Page, device: Device, target: Target) {
  // Python's files are held at first, as on a slow connection.
  let release: () => void = () => undefined;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.context().route("**/_runtime/pyodide/**", async (route) => {
    await gate;
    await route.continue();
  });
  await page.goto(target.address);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(target.title);
  if (target.course !== null) {
    const back = page.getByRole("link", { name: words.backToCourse(target.course.title) });
    await expect(back).toBeVisible();
    await expect(back).toHaveAttribute("href", `/courses/${target.course.slug}`);
  }
  if (device.phone) {
    await expect(view(page, words.viewLesson)).toHaveAttribute("aria-selected", "true");
  }
  await expect(page.getByRole("heading", { name: "Your task" })).toBeVisible();
  await noSidewaysScroll(page);

  await expect(python(page)).toHaveAttribute("data-python", /idle|loading/);
  await write(page, 'print("my first run")\n', device);
  await noAxeViolations(page);

  release();
  await ready(page);
  await press(button(page, words.run), device);
  // On a phone, Run shows the Output view with the console.
  if (device.phone) {
    await expect(view(page, words.viewOutput)).toHaveAttribute("aria-selected", "true");
  }
  await expect(consoleOutput(page)).toHaveText("my first run\n");
  await noSidewaysScroll(page);
  await noAxeViolations(page);
}

// J-2: Run, Check, a failing test case with expected and actual output, a
// fix, a pass, the completion moment, and Next to the following lesson. The
// last lesson of a course shows Next disabled, not hidden (FR-WSP-11).
export async function completeALesson(page: Page, device: Device, target: Target) {
  await page.goto(target.address);
  await ready(page);
  const summary = page.locator("[data-summary]");

  // The starter is a comment: it runs and prints nothing.
  await press(button(page, words.run), device);
  await expect(page.getByRole("status").filter({ hasText: words.runFinished(0) })).toBeAttached();

  await write(page, EXAMPLE_LESSON.wrongAnswer.code, device);
  await press(button(page, words.check), device);
  await expect(summary).toHaveText(words.summary(1, 2));
  const failed = page.locator('li[data-test-status="failed"]');
  await expect(failed).toHaveCount(1);
  await expect(failed.getByText(words.expected, { exact: true })).toBeVisible();
  await expect(failed.getByText(words.actual, { exact: true })).toBeVisible();
  // The wrong answer prints the same name whatever the input says.
  await expect(failed).toContainText("Hello, Sara!");
  await expect(failed).toContainText(EXAMPLE_LESSON.testCases[1]?.expected.trim() ?? "");
  await noSidewaysScroll(page);
  await noAxeViolations(page);

  await write(page, EXAMPLE_LESSON.solution, device);
  await press(button(page, words.check), device);
  await expect(summary).toHaveText(words.summary(2, 2));
  await expect(page.locator("[data-completion]")).toHaveText(words.completeFirst(target.xp));
  await noSidewaysScroll(page);
  await noAxeViolations(page);
  if (target.next === null) {
    await expect(page.getByRole("link", { name: new RegExp(`^${words.next}: `) })).toHaveCount(0);
    await expect(page.getByRole("link", { name: words.noNext })).toHaveAttribute(
      "aria-disabled",
      "true",
    );
    return;
  }
  const next = page.getByRole("link", { name: words.neighbour(words.next, target.next.title) });
  await expect(next).toBeVisible();
  await expect(next).toHaveAttribute("href", target.next.href);
  if (!target.next.follow) return;
  await press(next, device);
  await expect(page).toHaveURL(target.next.href);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(target.next.title);
}

/**
 * Passes a lesson with the example solution and waits for the completion
 * moment. The progress journeys (e2e/progress-journey.spec.ts) use it to make
 * a completion; J-2 above walks the whole path to one.
 */
export async function passLesson(page: Page, device: Device, target: Target) {
  await page.goto(target.address);
  await ready(page);
  await write(page, EXAMPLE_LESSON.solution, device);
  await press(button(page, words.check), device);
  await expect(page.locator("[data-summary]")).toHaveText(words.summary(2, 2));
  await expect(page.locator("[data-completion]")).toHaveText(words.completeFirst(target.xp));
}

// J-3: a program that calls input() twice. The console asks for each answer
// where the browser can pause a program; elsewhere the Input field takes the
// answers before Run (FR-WSP-08).
export async function programThatAsksForInput(page: Page, device: Device, target: Target) {
  await page.goto(target.address);
  await ready(page);
  await write(page, 'a = input("First? ")\nb = input("Second? ")\nprint(a + b)\n', device);
  await showView(page, words.viewOutput, device);
  const batch = page.getByLabel(words.batchLabel);
  const interactive = !(await batch.isVisible());
  // Chromium can pause a program for input, so the Input field showing there
  // is a fault.
  if (page.context().browser()?.browserType().name() === "chromium") {
    expect(interactive).toBe(true);
  }
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
  // Where the program paused, the console holds each prompt with its answer
  // echoed after it (FR-WSP-08); where it could not, the answers were given
  // before Run and the console holds the prompts and the result.
  await expect(consoleOutput(page)).toHaveText(
    interactive ? "First? 4\nSecond? 2\n42\n" : "First? Second? 42\n",
  );
  await expect(
    page.getByRole("status").filter({ hasText: words.runFinished(interactive ? 3 : 1) }),
  ).toBeAttached();
  await noSidewaysScroll(page);
}

// J-4: a runaway loop is stopped, Python comes back without a reload, and
// the next Run works.
export async function runawayCode(page: Page, device: Device, target: Target) {
  await page.goto(target.address);
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
