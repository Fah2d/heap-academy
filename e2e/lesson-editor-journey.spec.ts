import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { MALICIOUS } from "../src/content/markdown/malicious-fixtures";
import { courseEditor, dashboard, lessonEditor, lessonRows } from "../src/messages/admin";
import { removeAdmin, signInAsAdmin } from "./admin-helpers";
import { saveScreen } from "./screens";

// WP-4.2 against the local stack (FR-ADM-04, FR-ADM-10, NFR-SEC-07, T-06): an
// admin at aal2 adds a lesson to a new chapter, writes its instructions while
// the preview renders them through the server's renderer, is shown none of
// the hostile Markdown as markup, types code in the code editor with no
// policy violation, saves, has a stale save refused, and is asked before
// leaving unsaved changes. Screens at 1280 px.

/** Every policy violation the page reports, from before its first script (as e2e/csp.spec.ts). */
async function watchViolations(page: Page): Promise<() => Promise<string[]>> {
  await page.addInitScript(() => {
    const seen: string[] = [];
    Object.assign(window, { __violations: seen });
    document.addEventListener("securitypolicyviolation", (event) => {
      seen.push(`${event.effectiveDirective} ${event.blockedURI}`);
    });
  });
  return () => page.evaluate(() => (window as unknown as { __violations: string[] }).__violations);
}

test("[FR-ADM-04] [FR-ADM-10] [NFR-SEC-07] [T-06] add a lesson, write it with a live preview, save it, and meet a stale save", async ({
  page,
  request,
  browser,
}) => {
  test.setTimeout(180_000);
  const address = `admin-lesson-${Date.now()}@example.test`;
  const violations = await watchViolations(page);
  const dialogs: string[] = [];
  await signInAsAdmin(page, request, address);

  await page.getByRole("link", { name: dashboard.newCourse }).click();
  await page.getByLabel(courseEditor.titleLabel).fill("Lesson check");
  await page.getByLabel(courseEditor.slugLabel).fill(`lesson-check-${Date.now()}`);
  await page.getByLabel(courseEditor.summaryLabel).fill("A course made by the lesson journey.");
  await page.getByLabel(courseEditor.outcomeLabel(1)).fill("Write a lesson");
  await page.getByRole("button", { name: courseEditor.create }).click();
  await page.getByLabel(courseEditor.newChapterTitleLabel).fill("Basics");
  await page.getByRole("button", { name: courseEditor.addChapter }).click();

  // Add lesson opens the new lesson's editor.
  await page.getByLabel(lessonRows.newLessonTitleLabel("Basics")).fill("Ask, then answer");
  await page.getByRole("button", { name: lessonRows.addLesson }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    lessonEditor.editTitle("Ask, then answer"),
  );
  await expect(page.getByLabel(lessonEditor.slugLabel)).toHaveValue("ask-then-answer");
  await expect(page.getByText(lessonEditor.previewEmpty)).toBeVisible();

  // Hostile Markdown: the preview shows text, never markup, and nothing runs.
  page.on("dialog", (dialog) => {
    dialogs.push(dialog.message());
    void dialog.dismiss();
  });
  const instructions = page.getByLabel(lessonEditor.instructionsLabel);
  const preview = page.getByTestId("instructions-preview");
  for (const [name, markdown] of MALICIOUS) {
    await instructions.fill(`${markdown}\n\nMarker ${name}`);
    await expect(preview, name).toContainText(`Marker ${name}`);
    const found = await preview.evaluate((root) => ({
      elements: root.querySelectorAll("script, iframe, img, object, embed, style, svg, form, input")
        .length,
      handlers: [...root.querySelectorAll("*")].flatMap((element) =>
        element.getAttributeNames().filter((attribute) => attribute.startsWith("on")),
      ),
      links: [...root.querySelectorAll("a")]
        .map((link) => link.getAttribute("href") ?? "")
        .filter((href) => !href.startsWith("https://")),
    }));
    expect(found, name).toEqual({ elements: 0, handlers: [], links: [] });
  }
  expect(dialogs).toEqual([]);

  await instructions.fill(
    "## Ask, then answer\n\nAsk for a name with `input()`, then greet that person.\n\n```python\nname = input()\n```",
  );
  await expect(preview.getByRole("heading", { level: 2 })).toHaveText("Ask, then answer");

  // The code editor: typed code is kept, and its styles break no policy.
  const solution = page.getByRole("textbox", { name: lessonEditor.solutionLabel });
  await solution.click();
  await page.keyboard.type('name = input("Name? ")\nprint(f"Hello, {name}!")');
  await expect(solution).toContainText('print(f"Hello, {name}!")');
  await page.getByRole("button", { name: lessonEditor.save }).click();
  await expect(page.getByRole("status").filter({ hasText: lessonEditor.saved })).toBeVisible();
  await expect(page.getByText(lessonEditor.allSaved)).toBeVisible();
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await saveScreen(page, "admin-lesson-editor", 1280, { workPackage: "WP-4.2" });

  // A second tab saves first; this tab's save is refused with a prompt.
  const other = await browser.newContext({ storageState: await page.context().storageState() });
  const otherPage = await other.newPage();
  await otherPage.goto(page.url());
  await otherPage.getByLabel(lessonEditor.titleLabel).fill("Saved in the other tab");
  await otherPage.getByRole("button", { name: lessonEditor.save }).click();
  await expect(otherPage.getByRole("status").filter({ hasText: lessonEditor.saved })).toBeVisible();
  await other.close();
  await page.getByLabel(lessonEditor.titleLabel).fill("Saved in this tab");
  await page.getByRole("button", { name: lessonEditor.save }).click();
  await expect(page.getByRole("alert")).toContainText(lessonEditor.failure.stale);
  await expect(page.getByText(lessonEditor.unsaved)).toBeVisible();
  await saveScreen(page, "admin-lesson-editor-stale", 1280, { workPackage: "WP-4.2" });

  // Leaving with the unsaved change asks first; staying keeps the page.
  page.removeAllListeners("dialog");
  page.once("dialog", (dialog) => {
    expect(dialog.message()).toBe(lessonEditor.unsavedWarning);
    void dialog.dismiss();
  });
  await page.getByRole("link", { name: lessonEditor.backToCourse("Lesson check") }).click();
  await expect(page.getByLabel(lessonEditor.titleLabel)).toHaveValue("Saved in this tab");
  page.once("dialog", (dialog) => void dialog.accept());
  await page.reload();
  await expect(page.getByLabel(lessonEditor.titleLabel)).toHaveValue("Saved in the other tab");

  expect(await violations()).toEqual([]);
  removeAdmin(address);
});
