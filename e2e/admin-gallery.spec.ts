import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { adminArea, courseEditor, dashboard, secondStep, structure } from "../src/messages/admin";
import { adminGallery } from "../src/messages/gallery";
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
  await published.getByLabel(courseEditor.summaryLabel, { exact: true }).fill("Changed.");
  await published.getByRole("button", { name: courseEditor.save }).click();
  await expect(published.getByRole("button", { name: courseEditor.saving })).toBeFocused();
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await shot("admin-course-editor-pending");

  // Saves that succeed: the saved line, and focus on the new status.
  const saving = page.getByRole("region", { name: adminGallery.editorSaving });
  await saving.getByLabel(courseEditor.summaryLabel, { exact: true }).fill("Saved here.");
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
  await taken.getByLabel(courseEditor.titleLabel, { exact: true }).fill("Taken");
  await taken.getByLabel(courseEditor.slugLabel).fill("sample-course");
  await taken
    .getByLabel(courseEditor.summaryLabel, { exact: true })
    .fill("A course whose address is taken.");
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
