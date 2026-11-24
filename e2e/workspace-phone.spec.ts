import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { workspace as words } from "../src/messages/workspace";
import { saveScreen } from "./screens";

// WP-5.3: the lesson workspace on a phone (docs/spec/03-experience.md section
// 6.8), on the development-only page /dev/workspace, in the phone-workspace
// project (an emulated Pixel 7: touch, a mobile viewport). J-1 at the three
// widths FR-WSP-13 names. The journey on the real route, as a guest, is
// WP-7.4's (e2e/j01-video-to-first-run.spec.ts). The bar's place above the on-screen keyboard is worked out
// from the visual viewport (src/features/workspace/client/phone-layout.ts);
// an emulated phone has no on-screen keyboard, so that part is a unit test.
test.describe.configure({ timeout: 120_000 });

const READY_MS = 60_000;
const WORK_PACKAGE = "WP-5.3";
const HEIGHT = 740;

const python = (page: Page) => page.locator("[data-python]");
const views = (page: Page) => page.getByRole("tablist", { name: words.views });
const view = (page: Page, name: string) => views(page).getByRole("tab", { name });
const editor = (page: Page) => page.locator(".cm-content");
const consoleOutput = (page: Page) => page.getByTestId("console-output");

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

// NFR-A11Y-05: the page itself never scrolls sideways.
async function noSidewaysScroll(page: Page) {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
}

// NFR-A11Y-06: every control a finger can reach in the page's main region is
// at least 44 by 44 px (the shell's own controls are checked in phone.spec.ts).
async function touchTargets(page: Page) {
  const small = await page.evaluate(() =>
    [
      ...document.querySelectorAll<HTMLElement>(
        "main :is(a[href], button, input, select, textarea, [role='tab'], [role='link'], [role='button'])",
      ),
    ]
      .filter((element) => element.checkVisibility())
      // WCAG 2.5.8 exempts a link inside a sentence; its size is the text's.
      .filter((element) => element.closest("p") === null)
      .filter((element) => !element.closest("[aria-hidden='true'], nextjs-portal"))
      // The editor's text area is the whole editor, measured on its box.
      .filter((element) => !element.closest(".cm-editor"))
      .map((element) => {
        const box = element.getBoundingClientRect();
        return {
          what: `${element.tagName} ${element.textContent?.trim().slice(0, 40) ?? ""}`,
          width: Math.round(box.width),
          height: Math.round(box.height),
        };
      })
      .filter((box) => box.width < 44 || box.height < 44),
  );
  expect(small).toEqual([]);
}

// The page keeps room for the fixed bar: scrolled to its end, the last thing
// in the view ends above the bar.
async function endClearsTheBar(page: Page) {
  await page.evaluate(() => {
    window.scrollTo(0, document.documentElement.scrollHeight);
  });
  const gap = await page.evaluate(() => {
    const bar = document.querySelector("[data-workspace] .fixed");
    const shown = [...document.querySelectorAll("[data-workspace] *")].filter(
      (element) =>
        element.closest(".fixed") === null &&
        element.closest("[inert]") === null &&
        element.checkVisibility() &&
        element.children.length === 0,
    );
    const end = Math.max(...shown.map((element) => element.getBoundingClientRect().bottom));
    return (bar?.getBoundingClientRect().top ?? 0) - end;
  });
  expect(gap).toBeGreaterThanOrEqual(0);
}

async function screen(page: Page, name: string, width: number) {
  await settled(page);
  await saveScreen(page, name, width, { workPackage: WORK_PACKAGE, fullPage: false });
}

for (const width of [320, 375, 430]) {
  test(`[FR-WSP-13] [NFR-A11Y-05] [NFR-A11Y-06] [NFR-COMPAT-03] J-1 at ${width} px: read, write before Python is ready, run, see output`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: HEIGHT });
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

    // The Lesson view first, readable at once.
    await expect(view(page, words.viewLesson)).toHaveAttribute("aria-selected", "true");
    await expect(page.getByRole("heading", { name: "Your task" })).toBeVisible();
    await expect(editor(page)).toBeHidden();
    await noSidewaysScroll(page);
    await touchTargets(page);
    await noAxeViolations(page);
    await screen(page, "phone-lesson", width);

    // The Lesson view ends with the action that shows the Code view.
    await page.getByRole("button", { name: words.toCode }).tap();
    await expect(view(page, words.viewCode)).toHaveAttribute("aria-selected", "true");
    await expect(view(page, words.viewCode)).toBeFocused();
    await expect(page.getByRole("heading", { name: "Your task" })).toBeHidden();

    // The editor takes typing while Python is still starting.
    await expect(python(page)).toHaveAttribute("data-python", /idle|loading/);
    await editor(page).tap();
    await page.keyboard.press("ControlOrMeta+A");
    await page.keyboard.press("Delete");
    await page.keyboard.insertText('print("hello from a phone")\n');
    await expect(editor(page)).toContainText('print("hello from a phone")');

    // Run and Check sit in the bar at the bottom of the screen, over the view.
    const run = page.getByRole("button", { name: new RegExp(`^${words.run}`) });
    const bar = await run.boundingBox();
    expect(bar).not.toBeNull();
    expect((bar?.y ?? 0) + (bar?.height ?? 0)).toBeLessThanOrEqual(HEIGHT);
    expect(bar?.y ?? 0).toBeGreaterThan(HEIGHT / 2);
    await noSidewaysScroll(page);
    await touchTargets(page);
    await noAxeViolations(page);
    await screen(page, "phone-code", width);

    release();
    await expect(python(page)).toHaveAttribute("data-python", "ready", { timeout: READY_MS });

    // Run shows the Output view with the console.
    await run.tap();
    await expect(view(page, words.viewOutput)).toHaveAttribute("aria-selected", "true");
    await expect(consoleOutput(page)).toHaveText("hello from a phone\n");
    await expect(page.getByRole("tab", { name: words.console })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    await noSidewaysScroll(page);
    await touchTargets(page);
    await noAxeViolations(page);
    await screen(page, "phone-output", width);

    // Check shows the Output view with the tests.
    await page.getByRole("button", { name: new RegExp(`^${words.check}`) }).tap();
    await expect(page.locator("[data-summary]")).toHaveText(words.summary(0, 2));
    await expect(page.getByRole("tab", { name: words.tests })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    await noSidewaysScroll(page);
    await touchTargets(page);
    await noAxeViolations(page);
    await screen(page, "phone-tests", width);
    await endClearsTheBar(page);
    await view(page, words.viewLesson).tap();
    await endClearsTheBar(page);
  });
}

test("[FR-SYS-02] [FR-WSP-13] below 768 px, a browser that cannot run Python sees why, with no views", async ({
  page,
}) => {
  await page.addInitScript(() => {
    Reflect.deleteProperty(window, "Worker");
  });
  await page.setViewportSize({ width: 375, height: HEIGHT });
  await page.goto("/dev/workspace");
  await expect(page.getByText(words.unsupportedTitle)).toBeVisible();
  await expect(views(page)).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Your task" })).toBeVisible();
  await noSidewaysScroll(page);
  await noAxeViolations(page);
  await screen(page, "phone-unsupported", 375);
});
