import { expect, test, type Page } from "@playwright/test";
import { workspace as words } from "../src/messages/workspace";
import { noAxeViolations, READY_MS } from "./journeys";
import { saveScreen } from "./screens";

// WP-7.5, FR-GRD-07: a Check whose output almost matches names the one
// difference, on the seed's published lesson, in the real worker and harness
// of the production build. Axe on the result, screens at 375, 768 and 1280
// px. Runs in the `stack` project. The seed's expected outputs are one line
// each, so a missing last line is checked in src/grader/compare.test.ts and
// the tests panel's component test.
test.describe.configure({ timeout: 120_000 });

const LESSON = "/learn/sample-course/say-hello-by-name";
const WORK_PACKAGE = "WP-7.5";

const python = (page: Page) => page.locator("[data-python]");
const editor = (page: Page) => page.locator(".cm-content");
const button = (page: Page, name: string) =>
  page.getByRole("button", { name: new RegExp(`^${name}`) });
const view = (page: Page, name: string) =>
  page.getByRole("tablist", { name: words.views }).getByRole("tab", { name });

async function write(page: Page, code: string, phone: boolean) {
  if (phone) await view(page, words.viewCode).click();
  await editor(page).click();
  await page.keyboard.press("ControlOrMeta+A");
  await page.keyboard.press("Delete");
  await page.keyboard.insertText(code);
}

const CASES = [
  {
    kind: "letter_case",
    width: 1280,
    code: 'name = input("What is your name? ")\nprint("hello, " + name + "!")\n',
  },
  {
    kind: "punctuation",
    width: 768,
    code: 'name = input("What is your name? ")\nprint("Hello " + name)\n',
  },
  {
    kind: "spaces",
    width: 375,
    code: 'name = input("What is your name? ")\nprint("Hello," + name + "!")\n',
  },
] as const;

for (const { kind, width, code } of CASES) {
  test(`[FR-GRD-07] at ${String(width)} px a check that differs only in ${kind} says so`, async ({
    page,
  }) => {
    const phone = width < 768;
    await page.setViewportSize({ width, height: 900 });
    await page.goto(LESSON);
    await write(page, code, phone);
    await expect(python(page)).toHaveAttribute("data-python", "ready", { timeout: READY_MS });
    await button(page, words.check).click();
    await expect(page.getByRole("heading", { name: words.summary(0, 2) })).toBeVisible();
    // Both test cases miss the same way; the first failure is the open one.
    await expect(
      page.getByText(`${words.failure("mismatch", 5)} ${words.nearMiss(kind)}`).first(),
    ).toBeVisible();
    await noAxeViolations(page);
    await saveScreen(page, `near-miss-${kind}`, width, { workPackage: WORK_PACKAGE });
  });
}
