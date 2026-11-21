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
