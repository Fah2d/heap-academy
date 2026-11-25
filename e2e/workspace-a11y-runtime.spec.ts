import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { EXAMPLE_LESSON } from "../src/grader/example-lesson";
import { catalogCommon } from "../src/messages/catalog";
import { workspaceGallery } from "../src/messages/gallery";
import { lessonContent } from "../src/messages/lesson";
import { shell } from "../src/messages/shell";
import { account } from "../src/messages/sign-in";
import { learnerErrorHeading, workspace as words } from "../src/messages/workspace";
import { TIME_LIMIT_MS } from "../src/runtime/controller";
import { saveScreen } from "./screens";

// WP-7.2: the workspace states the WP-5.2 journeys do not reach, the keyboard
// walkthrough (NFR-A11Y-03), and the reduced-motion check (NFR-A11Y-08), on
// the development-only page /dev/workspace. Runs in the runtime-* projects
// against the development server.
test.describe.configure({ timeout: 120_000 });

const READY_MS = 60_000;
const WIDTHS = [1280, 768, 375] as const;
const WORK_PACKAGE = "WP-7.2";
const NO_FACTS = { line: undefined, timeLimitSeconds: 0, outputLimit: 0 };

const python = (page: Page) => page.locator("[data-python]");
const editor = (page: Page) => page.locator(".cm-content");
const runButton = (page: Page) => page.getByRole("button", { name: new RegExp(`^${words.run}`) });
const checkButton = (page: Page) =>
  page.getByRole("button", { name: new RegExp(`^${words.check}`) });
const failedSummary = (page: Page) => page.getByRole("heading", { name: words.summary(0, 2) });

async function ready(page: Page) {
  await expect(python(page)).toHaveAttribute("data-python", "ready", { timeout: READY_MS });
}

async function write(page: Page, code: string) {
  await editor(page).click();
  await page.keyboard.press("ControlOrMeta+A");
  await page.keyboard.press("Delete");
  await page.keyboard.insertText(code);
}

// The same wait as e2e/workspace-runtime.spec.ts: settled colors, not the
// editor's endless cursor blink.
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

async function screens(page: Page, name: string) {
  for (const width of WIDTHS) {
    await page.setViewportSize({ width, height: 900 });
    await settled(page);
    await saveScreen(page, name, width, { workPackage: WORK_PACKAGE, fullPage: width < 768 });
  }
  await page.setViewportSize({ width: 1280, height: 900 });
}

type Stop = {
  /** The landmark the element is in: its label, or its role when it has none. */
  region: string;
  name: string;
  ringed: boolean;
  inEditor: boolean;
  devOverlay: boolean;
};

// What the keyboard has reached: where it is, and whether its focus ring is
// drawn (DESIGN.md section 6). The editor draws its ring on its outer element.
function focused(page: Page): Promise<Stop> {
  return page.evaluate(() => {
    const element = document.activeElement;
    if (!(element instanceof HTMLElement) || element === document.body) {
      return { region: "none", name: "", ringed: false, inEditor: false, devOverlay: false };
    }
    const inEditor = element.classList.contains("cm-content");
    const ringHolder = inEditor ? element.closest(".cm-editor") : element;
    const style = ringHolder === null ? undefined : getComputedStyle(ringHolder);
    const landmark = element.closest("section, header, footer, nav, main");
    const labelledBy = landmark?.getAttribute("aria-labelledby");
    const region =
      landmark === null
        ? "body"
        : (landmark.getAttribute("aria-label") ??
          (labelledBy ? document.getElementById(labelledBy)?.textContent : null) ??
          landmark.tagName.toLowerCase());
    return {
      region,
      name: (element.getAttribute("aria-label") ?? element.textContent ?? "").trim().slice(0, 60),
      ringed: style !== undefined && style.outlineStyle === "solid" && style.outlineWidth === "2px",
      inEditor,
      // Next.js's development indicator; not in a production build.
      devOverlay: element.tagName.toLowerCase() === "nextjs-portal",
    };
  });
}

// Tab from the top of the page until focus comes back to the skip link.
async function walk(page: Page): Promise<Stop[]> {
  const stops: Stop[] = [];
  let wrapping = false;
  for (let step = 0; step < 60; step += 1) {
    await page.keyboard.press("Tab");
    // CodeMirror marks itself focused a moment after the focus event.
    if (await page.evaluate(() => document.activeElement?.classList.contains("cm-content"))) {
      await page.locator(".cm-editor.cm-focused").waitFor();
    }
    const stop = await focused(page);
    if (stops.length > 0 && stop.name === shell.skipLink) return stops;
    // After the last control, Next lesson, focus passes the development
    // indicator and the page itself before the skip link. Anywhere else,
    // focus on the page itself is focus lost: it is kept, and fails below.
    if (wrapping && (stop.devOverlay || stop.region === "none")) continue;
    stops.push(stop);
    if (stop.name.startsWith(words.next)) wrapping = true;
    // The editor keeps Tab for indenting; Escape, then Tab, leaves it (section 6.2).
    if (stop.inEditor) await page.keyboard.press("Escape");
  }
  throw new Error(`Focus never came back to the skip link: ${JSON.stringify(stops)}`);
}

function regions(stops: Stop[]): string[] {
  return stops
    .map((stop) => stop.region)
    .filter((region, index, all) => index === 0 || all[index - 1] !== region);
}

test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/dev/workspace");
});

test("[NFR-A11Y-03] the keyboard reaches every control in reading order, each with its focus ring", async ({
  page,
}) => {
  await ready(page);
  const stops = await walk(page);
  // docs/spec/03-experience.md section 6.1: header, instructions, editor,
  // actions, output, footer. The actions sit in the page's main landmark.
  expect(regions(stops)).toEqual([
    // The skip link comes first, before any landmark.
    "body",
    "header",
    shell.mainNavigation,
    shell.accountNavigation,
    "main",
    words.instructions,
    words.hints,
    words.work,
    "main",
    words.output,
    words.lessons,
  ]);
  // One stop each, in this order. The Console and Tests tabs are one stop;
  // the arrow keys move between them.
  const names = [
    shell.skipLink,
    shell.productName,
    catalogCommon.coursesLink,
    account.signIn,
    words.backToCourse(workspaceGallery.courseTitle),
    "name = input(",
    lessonContent.copyCode,
    words.showHint,
    words.reset,
    EXAMPLE_LESSON.starter.trim(),
    words.run,
    words.check,
    words.stop,
    words.console,
    words.consoleLabel,
    words.previous,
    words.next,
  ];
  expect(stops).toHaveLength(names.length);
  stops.forEach((stop, index) => {
    expect(stop.name.startsWith(names[index] ?? "")).toBe(true);
  });
  expect(stops.filter((stop) => !stop.ringed)).toEqual([]);
  expect(stops.findIndex((stop) => stop.inEditor)).toBe(
    names.indexOf(EXAMPLE_LESSON.starter.trim()),
  );
});

test("[NFR-A11Y-03] after a failed Check, the keyboard opens and closes each test case", async ({
  page,
}) => {
  await ready(page);
  await write(page, 'print("Hello, Sara!")\n');
  await checkButton(page).click();
  await expect(failedSummary(page)).toBeFocused();
  const cases = page.getByRole("region", { name: words.output }).locator("button[aria-expanded]");
  await expect(cases).toHaveCount(2);
  await expect(cases.first()).toHaveAttribute("aria-expanded", "true");
  for (let index = 0; index < 2; index += 1) {
    await page.keyboard.press("Tab");
    const toggle = cases.nth(index);
    await expect(toggle).toBeFocused();
    expect((await focused(page)).ringed).toBe(true);
    const before = await toggle.getAttribute("aria-expanded");
    await page.keyboard.press("Enter");
    await expect(toggle).not.toHaveAttribute("aria-expanded", before ?? "");
    await page.keyboard.press("Space");
    await expect(toggle).toHaveAttribute("aria-expanded", before ?? "");
  }
});

test("[NFR-A11Y-03] the reset dialog holds focus until Escape, then gives it back", async ({
  page,
}) => {
  await ready(page);
  // With the starter code in place, Reset presses nothing.
  await write(page, 'print("mine")\n');
  const reset = page.getByRole("button", { name: words.reset });
  await reset.focus();
  await page.keyboard.press("Enter");
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await noAxeViolations(page);
  for (let step = 0; step < 6; step += 1) {
    await page.keyboard.press("Tab");
    expect(await dialog.evaluate((element) => element.contains(document.activeElement))).toBe(true);
    expect((await focused(page)).ringed).toBe(true);
  }
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await expect(reset).toBeFocused();
});

test("[NFR-A11Y-08] nothing moves in the workspace under reduced motion", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.reload();
  await ready(page);
  await write(page, 'print("Hello, Sara!")\n');
  await checkButton(page).click();
  await expect(failedSummary(page)).toBeVisible();
  const moving = await page.evaluate(() =>
    [...document.querySelectorAll("*")]
      .filter((element) => {
        const style = getComputedStyle(element);
        return style.transitionDuration
          .split(",")
          .concat(style.animationDuration.split(","))
          .some((duration) => Number.parseFloat(duration) > 0);
      })
      .map((element) => element.outerHTML.slice(0, 80)),
  );
  expect(moving).toEqual([]);
});

test("[NFR-A11Y-02] [FR-WSP-09] an error while running names its line", async ({ page }) => {
  await ready(page);
  await write(page, "total = 10\nprint(total / 0)\n");
  await runButton(page).click();
  await expect(
    page.getByRole("heading", { name: learnerErrorHeading("runtime", { ...NO_FACTS, line: 2 }) }),
  ).toBeVisible();
  await expect(page.getByText("ZeroDivisionError").first()).toBeVisible();
  await noAxeViolations(page);
  await screens(page, "workspace-runtime-error");
});

test("[NFR-A11Y-02] [FR-WSP-07] a program past the time limit is stopped, and Python comes back", async ({
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
  await write(page, "while True:\n    pass\n");
  await runButton(page).click();
  await expect(
    page.getByRole("heading", {
      name: learnerErrorHeading("time_limit", {
        ...NO_FACTS,
        timeLimitSeconds: TIME_LIMIT_MS / 1000,
      }),
    }),
  ).toBeVisible({ timeout: TIME_LIMIT_MS + 15_000 });
  await expect(python(page)).toHaveAttribute("data-python", "restarting");
  await noAxeViolations(page);
  await screens(page, "workspace-time-limit");
  release();
  await ready(page);
});

test("[NFR-A11Y-02] [FR-WSP-09] a test case that runs out of input says so", async ({ page }) => {
  await ready(page);
  await write(page, 'first = input("First? ")\nsecond = input("Second? ")\nprint(first, second)\n');
  await checkButton(page).click();
  await expect(failedSummary(page)).toBeVisible();
  await expect(
    page.getByRole("heading", { name: learnerErrorHeading("input_ended", NO_FACTS) }).first(),
  ).toBeVisible();
  await noAxeViolations(page);
  await screens(page, "workspace-input-ended");
});

test("[NFR-A11Y-02] [FR-WSP-02] a revealed hint", async ({ page }) => {
  await ready(page);
  await page.getByRole("button", { name: words.showHint }).click();
  await expect(page.getByRole("heading", { name: words.hintHeading(1, 1) })).toBeVisible();
  await noAxeViolations(page);
  await screens(page, "workspace-hint");
});
