import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import {
  adminArea,
  courseEditor,
  dashboard,
  lessonEditor,
  secondStep,
  structure,
  testCaseList,
} from "../src/messages/admin";
import { adminGallery } from "../src/messages/gallery";
import { lessonContent } from "../src/messages/lesson";
import { saveScreen } from "./screens";

// The admin states the J-12 journey cannot reach (WP-2.3 design review 1),
// on the development-only page /dev/admin. Runs in the `gallery` project,
// against the development server.

test("[FR-ADM-02] every admin state shows, with no axe violation, at 1280 px", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/dev/admin");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(adminGallery.title);
  await expect(page.getByText(dashboard.empty)).toBeVisible();
  await expect(page.getByText(dashboard.loadFailed)).toBeVisible();
  await expect(page.getByRole("rowheader", { name: adminGallery.sampleCourse })).toBeVisible();

  await page.getByRole("button", { name: secondStep.start }).click();
  await expect(
    page.getByRole("alert").filter({ hasText: secondStep.setupUnavailable }),
  ).toBeVisible();

  const forms = page.getByRole("textbox", { name: secondStep.codeLabel });
  const buttons = page.getByRole("button", { name: secondStep.verify });
  await forms.nth(0).fill("123456");
  await buttons.nth(0).click();
  await expect(
    page.getByRole("alert").filter({ hasText: secondStep.tooManyAttempts }),
  ).toBeVisible();
  await forms.nth(1).fill("123456");
  await buttons.nth(1).click();
  await expect(page.getByRole("button", { name: secondStep.checking })).toBeDisabled();

  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await saveScreen(page, "admin-states", 1280, { workPackage: "WP-2.3" });
});

test("[FR-ADM-03] [FR-ADM-10] the course editor's refusals and empty states, at 1280 px", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/dev/admin");
  const refusing = page.getByRole("region", { name: adminGallery.editorRefusing });
  await refusing.getByRole("button", { name: courseEditor.statusAction.published }).click();
  await expect(refusing.getByRole("alert")).toContainText(structure.failure.no_published_lesson);
  await refusing.getByRole("button", { name: courseEditor.save }).click();
  await expect(refusing.getByRole("alert").first()).toContainText(structure.failure.stale);
  await expect(refusing.getByRole("button", { name: structure.reload })).toBeVisible();
  await refusing
    .getByRole("button", { name: structure.moveDown(adminGallery.sampleChapter) })
    .click();
  await expect(
    refusing.getByRole("alert").filter({ hasText: structure.failure.cannot_move }),
  ).toBeVisible();
  // A chapter with lessons offers no Delete; an empty one does.
  await expect(
    refusing.getByRole("button", { name: courseEditor.deleteChapter(adminGallery.sampleChapter) }),
  ).toHaveCount(0);
  await expect(
    refusing.getByRole("button", { name: courseEditor.deleteChapter(adminGallery.secondChapter) }),
  ).toBeVisible();

  const empty = page.getByRole("region", { name: adminGallery.editorEmpty });
  await expect(empty.getByText(courseEditor.chaptersEmpty)).toBeVisible();
  const created = page.getByRole("region", { name: adminGallery.newCourse });
  await created.getByRole("button", { name: courseEditor.create }).click();
  await expect(created.getByText(courseEditor.fieldInvalid.title)).toBeVisible();

  const rows = page.getByRole("region", { name: adminGallery.courseListRows });
  await rows.getByRole("button", { name: structure.moveDown(adminGallery.sampleCourse) }).click();
  await expect(rows.getByRole("alert")).toContainText(structure.failure.cannot_move);

  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await saveScreen(page, "admin-course-states", 1280, { workPackage: "WP-4.1" });
});

test("[FR-ADM-03] [FR-ADM-09] [FR-ADM-10] the course editor's pending, saved, question and failure states, at 1280 px", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/dev/admin");
  const shot = (name: string) => saveScreen(page, name, 1280, { workPackage: "WP-4.1" });

  // A published course: its own moves, and each question before it acts.
  const published = page.getByRole("region", { name: adminGallery.editorPublished });
  await expect(
    published.getByText(courseEditor.statusNow(courseEditor.statusName.published)),
  ).toBeVisible();
  await expect(
    published.getByRole("button", { name: courseEditor.statusAction.draft }),
  ).toBeVisible();
  await published.getByRole("button", { name: courseEditor.statusAction.archived }).click();
  const archive = page.getByRole("dialog", { name: courseEditor.confirmStatusTitle.archived });
  await expect(archive).toContainText(courseEditor.confirmStatusBody.archived);
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await shot("admin-course-archive-question");
  await archive.getByRole("button", { name: courseEditor.cancel }).click();
  await published.getByRole("button", { name: courseEditor.statusAction.draft }).click();
  const draft = page.getByRole("dialog", { name: courseEditor.confirmStatusTitle.draft });
  await expect(draft).toContainText(courseEditor.confirmStatusBody.draft);
  await shot("admin-course-draft-question");
  await draft.getByRole("button", { name: courseEditor.cancel }).click();
  await published
    .getByRole("button", { name: courseEditor.deleteChapter(adminGallery.secondChapter) })
    .click();
  const remove = page.getByRole("dialog", { name: courseEditor.deleteConfirmTitle });
  await expect(remove).toContainText(courseEditor.deleteConfirmBody(adminGallery.secondChapter));
  await shot("admin-chapter-delete-question");
  await remove.getByRole("button", { name: courseEditor.cancel }).click();

  // Rename in place takes focus; the saves never answer, so the pending states stay.
  await published
    .getByRole("button", { name: courseEditor.renameChapter(adminGallery.sampleChapter) })
    .click();
  await expect(
    published.getByLabel(courseEditor.renameTitleLabel(adminGallery.sampleChapter)),
  ).toBeFocused();
  await published.getByRole("button", { name: courseEditor.saveChapter }).click();
  await expect(published.getByRole("button", { name: courseEditor.savingChapter })).toBeFocused();
  await published.getByLabel(courseEditor.summaryLabel).fill("Changed.");
  await published.getByRole("button", { name: courseEditor.save }).click();
  await expect(published.getByRole("button", { name: courseEditor.saving })).toBeFocused();
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await shot("admin-course-editor-pending");

  // Saves that succeed: the saved line, and focus on the new status.
  const saving = page.getByRole("region", { name: adminGallery.editorSaving });
  await saving.getByLabel(courseEditor.summaryLabel).fill("Saved here.");
  await saving.getByRole("button", { name: courseEditor.save }).click();
  await expect(saving.getByRole("status").filter({ hasText: courseEditor.saved })).toBeVisible();
  await saving.getByRole("button", { name: courseEditor.statusAction.published }).click();
  await expect(
    saving.getByText(courseEditor.statusNow(courseEditor.statusName.published)),
  ).toBeFocused();
  await shot("admin-course-editor-saved");

  const failed = page.getByRole("region", { name: adminGallery.editorFailed });
  await expect(failed.getByText(courseEditor.loadFailed)).toBeVisible();
  const taken = page.getByRole("region", { name: adminGallery.newCourseTaken });
  await taken.getByLabel(courseEditor.titleLabel).fill("Taken");
  await taken.getByLabel(courseEditor.slugLabel).fill("sample-course");
  await taken.getByLabel(courseEditor.summaryLabel).fill("A course whose address is taken.");
  await taken.getByRole("button", { name: courseEditor.create }).click();
  await expect(taken.getByLabel(courseEditor.slugLabel)).toBeFocused();
  await expect(taken.getByText(structure.failure.slug_taken)).toBeVisible();
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await shot("admin-course-failures");
});

for (const width of [375, 800]) {
  test(`[FR-ADM-01] below 1024 px the admin frame asks for a wider window (${width} px)`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 800 });
    await page.goto("/dev/admin");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(adminArea.narrowHeading);
    await expect(page.getByText(adminArea.narrowScreen)).toBeVisible();
    expect(await page.getByRole("heading", { level: 1 }).count()).toBe(1);
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
    await saveScreen(page, "admin-narrow", width, { workPackage: "WP-2.3" });
  });
}

test("[FR-ADM-04] [FR-ADM-10] the lesson editor's states, at 1280 px", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/dev/admin");
  const shot = (name: string) => saveScreen(page, name, 1280, { workPackage: "WP-4.2" });

  // Saves that succeed, and a preview that renders as the learner sees it.
  const editing = page.getByRole("region", { name: adminGallery.lessonEditor });
  await expect(editing.getByTestId("instructions-preview").getByRole("heading")).toHaveText(
    adminGallery.previewHeading,
  );
  await editing.getByLabel(lessonEditor.titleLabel).fill("Renamed");
  await expect(editing.getByText(lessonEditor.unsaved)).toBeVisible();
  await editing.getByRole("button", { name: lessonEditor.save }).click();
  await expect(editing.getByRole("status").filter({ hasText: lessonEditor.saved })).toBeVisible();
  await expect(editing.getByText(lessonEditor.allSaved)).toBeVisible();
  await shot("admin-lesson-editor-saved");

  // A refused save and a preview that fails keep what was typed.
  const refusing = page.getByRole("region", { name: adminGallery.lessonRefusing });
  await refusing.getByLabel(lessonEditor.instructionsLabel).fill("## Changed");
  await expect(refusing.getByText(lessonEditor.previewFailed)).toBeVisible();
  await refusing.getByRole("button", { name: lessonEditor.save }).click();
  await expect(refusing.getByRole("alert").first()).toContainText(lessonEditor.failure.stale);
  await expect(refusing.getByLabel(lessonEditor.instructionsLabel)).toHaveValue("## Changed");
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await shot("admin-lesson-editor-refused");

  // A published lesson says how its code changes are saved; a save that never answers stays pending.
  const published = page.getByRole("region", { name: adminGallery.lessonPublished });
  await expect(published.getByText(lessonEditor.publishedCodeNote)).toBeVisible();
  await published.getByLabel(lessonEditor.titleLabel).fill("Pending");
  await published.getByRole("button", { name: lessonEditor.save }).click();
  await expect(published.getByRole("button", { name: lessonEditor.saving })).toBeVisible();
  await shot("admin-lesson-editor-pending");

  // An empty lesson: the empty preview and no wrong answers; invalid fields are named.
  const empty = page.getByRole("region", { name: adminGallery.lessonEmpty });
  await expect(empty.getByText(lessonEditor.previewEmpty)).toBeVisible();
  await expect(empty.getByText(lessonEditor.wrongAnswersEmpty)).toBeVisible();
  await empty.getByLabel(lessonEditor.titleLabel).fill("");
  await empty.getByRole("button", { name: lessonEditor.save }).click();
  await expect(empty.getByText(lessonEditor.fieldInvalid.title)).toBeVisible();
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await shot("admin-lesson-editor-empty");
});

test("[FR-ADM-04] [FR-ADM-10] the lesson editor's failures, limits and learner content, at 1280 px", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/dev/admin");
  const shot = (name: string) => saveScreen(page, name, 1280, { workPackage: "WP-4.2" });

  // Three wrong answers: no Add; a save that fails says so and keeps the text.
  const full = page.getByRole("region", { name: adminGallery.lessonFull });
  await expect(full.getByRole("button", { name: lessonEditor.addWrongAnswer })).toHaveCount(0);
  await full.getByLabel(lessonEditor.titleLabel).fill("Kept");
  await full.getByRole("button", { name: lessonEditor.save }).click();
  await expect(full.getByRole("alert").first()).toContainText(lessonEditor.failure.unavailable);
  await expect(full.getByLabel(lessonEditor.titleLabel)).toHaveValue("Kept");
  await shot("admin-lesson-editor-save-failed");

  // A taken address is said once, under its field.
  const taken = page.getByRole("region", { name: adminGallery.lessonTaken });
  await taken.getByRole("button", { name: lessonEditor.save }).click();
  await expect(taken.getByText(lessonEditor.failure.slug_taken)).toHaveCount(1);
  await expect(taken.getByLabel(lessonEditor.slugLabel)).toHaveAttribute("aria-invalid", "true");
  await shot("admin-lesson-editor-slug-taken");

  // A starter over the limit: the editor itself is invalid, focused and described.
  const tooLong = page.getByRole("region", { name: adminGallery.lessonTooLong });
  await tooLong.getByRole("button", { name: lessonEditor.save }).click();
  const starter = tooLong.getByRole("textbox", { name: lessonEditor.starterLabel });
  await expect(starter).toHaveAttribute("aria-invalid", "true");
  await expect(starter).toBeFocused();
  await expect(tooLong.getByText(lessonEditor.fieldInvalid.starterCode)).toBeVisible();
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await shot("admin-lesson-editor-code-invalid");

  // The editor's chrome is the design's, not CodeMirror's light theme
  // (DESIGN.md section 4.4): a focused editor has the 2 px focus ring, the
  // gutter sits on the editor surface, and the text is in the mono face.
  const editor = starter.locator("xpath=ancestor::*[contains(@class, 'cm-editor')][1]");
  const chrome = await editor.evaluate((element) => {
    const surface = getComputedStyle(element).backgroundColor;
    const gutters = element.querySelector(".cm-gutters");
    const scroller = element.querySelector(".cm-scroller");
    const style = getComputedStyle(element);
    return {
      surface,
      gutter: gutters === null ? "" : getComputedStyle(gutters).backgroundColor,
      outlineStyle: style.outlineStyle,
      outlineWidth: style.outlineWidth,
      font: scroller === null ? "" : getComputedStyle(scroller).fontFamily,
      dark: element.classList.contains("cm-light") === false,
    };
  });
  expect(chrome.gutter).toBe(chrome.surface);
  expect(chrome.outlineStyle).toBe("solid");
  expect(chrome.outlineWidth).toBe("2px");
  expect(chrome.font).not.toBe("monospace");
  expect(chrome.dark).toBe(true);

  // A lesson's instructions as learners see them.
  const content = page.getByRole("region", { name: adminGallery.lessonContent });
  await expect(
    content.getByRole("group", { name: lessonContent.codeBlock("Python") }),
  ).toBeVisible();
  await expect(content.getByRole("region", { name: lessonContent.table })).toBeVisible();
  await expect(content.getByRole("button", { name: lessonContent.copyCode })).toBeVisible();
  await expect(content.getByRole("link")).toContainText(lessonContent.opensInNewTab);
  await shot("admin-lesson-content");
});

test("[FR-ADM-05] the test case list: empty, full, and a test case with problems, at 1280 px", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/dev/admin");
  const shot = (name: string) => saveScreen(page, name, 1280, { workPackage: "WP-4.3" });

  // No test case yet: the empty sentence, and Add opens a new one with its name focused.
  const empty = page.getByRole("region", { name: adminGallery.lessonEmpty });
  await expect(empty.getByText(testCaseList.empty)).toBeVisible();
  await shot("admin-test-cases-empty");
  await empty.getByRole("button", { name: testCaseList.add }).click();
  const added = empty.getByRole("group", { name: testCaseList.group(1) });
  await expect(added.getByRole("textbox", { name: testCaseList.nameLabel })).toBeFocused();
  await expect(empty.getByText(lessonEditor.unsaved)).toBeVisible();
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await shot("admin-test-case-open");

  // Twelve: no Add and no Duplicate, and the sentence that says why.
  const full = page.getByRole("region", { name: adminGallery.lessonTestCasesFull });
  await expect(full.getByText(testCaseList.full)).toBeVisible();
  await expect(full.getByRole("button", { name: testCaseList.add })).toHaveCount(0);
  await full
    .getByRole("button", { name: testCaseList.title(1, adminGallery.sampleTestName) })
    .click();
  await expect(full.getByRole("button", { name: /^Duplicate: / })).toHaveCount(0);
  await shot("admin-test-cases-full");

  // Save opens the test case with problems, focuses its name, and names each field.
  const problem = page.getByRole("region", { name: adminGallery.lessonTestCaseProblem });
  await problem.getByRole("button", { name: lessonEditor.save }).click();
  const second = problem.getByRole("group", { name: testCaseList.group(2) });
  await expect(second.getByRole("textbox", { name: testCaseList.nameLabel })).toBeFocused();
  await expect(second.getByText(testCaseList.problem.nameMissing)).toBeVisible();
  await expect(second.getByText(testCaseList.problem.tooLong.expected(5_000))).toBeVisible();
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await shot("admin-test-case-problems");
});
