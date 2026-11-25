import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { courseEditor, dashboard, structure } from "../src/messages/admin";
import { removeAdmin, signInAsAdmin } from "./admin-helpers";
import { saveScreen } from "./screens";

// WP-4.1 against the local stack (FR-ADM-03, FR-ADM-09, FR-ADM-10,
// FR-ADM-11): an admin at aal2 creates a course, adds and reorders chapters,
// is refused publishing it with no published lesson, has a stale save
// refused, is asked before leaving unsaved changes, and archives it.
// Screens at 1280 px.

test.describe.configure({ mode: "serial" });

test("[FR-ADM-03] [FR-ADM-09] [FR-ADM-10] create, edit, reorder, and archive a course", async ({
  page,
  request,
  browser,
}) => {
  test.setTimeout(180_000);
  const address = `admin-structure-${Date.now()}@example.test`;
  const slug = `structure-${Date.now()}`;
  await signInAsAdmin(page, request, address);

  await page.getByRole("link", { name: dashboard.newCourse }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(courseEditor.newTitle);
  await page.getByRole("button", { name: courseEditor.create }).click();
  await expect(page.getByText(courseEditor.fieldInvalid.title)).toBeVisible();
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await saveScreen(page, "admin-new-course-invalid", 1280, { workPackage: "WP-4.1" });

  await page.getByLabel(courseEditor.titleLabel, { exact: true }).fill("Structure check");
  await page.getByLabel(courseEditor.slugLabel).fill(slug);
  await page
    .getByLabel(courseEditor.summaryLabel, { exact: true })
    .fill("A course made by the journey.");
  await page.getByLabel(courseEditor.outcomeLabel(1)).fill("Name the parts of a course");
  await page.getByRole("button", { name: courseEditor.create }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    courseEditor.editTitle("Structure check"),
  );
  await expect(page.getByText(courseEditor.chaptersEmpty)).toBeVisible();

  // Two chapters, then the second moved above the first.
  for (const title of ["First", "Second"]) {
    await page.getByLabel(courseEditor.newChapterTitleLabel).fill(title);
    await page.getByRole("button", { name: courseEditor.addChapter }).click();
    await expect(page.getByRole("heading", { level: 3, name: title })).toBeVisible();
  }
  await page.getByRole("button", { name: structure.moveUp("Second") }).click();
  await expect(page.getByRole("heading", { level: 3 }).first()).toHaveText("Second");
  await expect(page.getByRole("button", { name: structure.moveDown("Second") })).toBeFocused();
  await page.reload();
  await expect(page.getByRole("heading", { level: 3 }).first()).toHaveText("Second");

  // No published lesson: publishing is refused with the reason.
  await page.getByRole("button", { name: courseEditor.statusAction.published }).click();
  const statusGroup = page.getByRole("group", { name: courseEditor.statusHeading, exact: true });
  await expect(statusGroup.getByRole("alert")).toContainText(structure.failure.no_published_lesson);
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await saveScreen(page, "admin-course-editor-publish-refused", 1280, { workPackage: "WP-4.1" });

  // A second tab saves first; this tab's save is refused with a prompt.
  const other = await browser.newContext({ storageState: await page.context().storageState() });
  const otherPage = await other.newPage();
  await otherPage.goto(page.url());
  await otherPage
    .getByLabel(courseEditor.summaryLabel, { exact: true })
    .fill("Saved in the other tab.");
  await otherPage.getByRole("button", { name: courseEditor.save }).click();
  await expect(otherPage.getByRole("status").filter({ hasText: courseEditor.saved })).toBeVisible();
  await other.close();
  await page.getByLabel(courseEditor.summaryLabel, { exact: true }).fill("Saved in this tab.");
  await page.getByRole("button", { name: courseEditor.save }).click();
  // The refusal shows with the details it refused; the Status keeps its own.
  const details = page.getByRole("group", { name: courseEditor.detailsHeading, exact: true });
  await expect(details.getByRole("alert")).toContainText(structure.failure.stale);
  await expect(page.getByRole("button", { name: structure.reload })).toBeVisible();
  await saveScreen(page, "admin-course-editor-stale", 1280, { workPackage: "WP-4.1" });

  // Leaving with the unsaved change asks first; staying keeps the page.
  page.once("dialog", (dialog) => {
    expect(dialog.message()).toBe(courseEditor.unsavedWarning);
    void dialog.dismiss();
  });
  await page.getByRole("link", { name: courseEditor.backToCourses }).click();
  await expect(page.getByLabel(courseEditor.summaryLabel, { exact: true })).toHaveValue(
    "Saved in this tab.",
  );

  page.once("dialog", (dialog) => void dialog.accept());
  await page.reload();
  await expect(page.getByLabel(courseEditor.summaryLabel, { exact: true })).toHaveValue(
    "Saved in the other tab.",
  );

  // Archive asks first and says what learners will see.
  await page.getByRole("button", { name: courseEditor.statusAction.archived }).click();
  const dialog = page.getByRole("dialog", { name: courseEditor.confirmStatusTitle.archived });
  await expect(dialog).toContainText(courseEditor.confirmStatusBody.archived);
  await dialog.getByRole("button", { name: courseEditor.statusAction.archived }).click();
  await expect(
    page.getByText(courseEditor.statusNow(courseEditor.statusName.archived)),
  ).toBeVisible();

  await page.getByRole("link", { name: courseEditor.backToCourses }).click();
  const row = page.getByRole("row", { name: /Structure check/ });
  await expect(row).toContainText(dashboard.status.archived);
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await saveScreen(page, "admin-courses", 1280, { workPackage: "WP-4.1" });

  removeAdmin(address);
});

test("[FR-ADM-03] courses move up and down in the list, and the order stays", async ({
  page,
  request,
}) => {
  test.setTimeout(120_000);
  const address = `admin-order-${Date.now()}@example.test`;
  await signInAsAdmin(page, request, address);
  const titles = await page.getByRole("rowheader").allInnerTexts();
  // The seed's course and the one the test above made.
  expect(titles.length).toBeGreaterThanOrEqual(2);
  const [first, second] = titles as [string, string];
  await page.getByRole("button", { name: structure.moveDown(first) }).click();
  await expect(page.getByRole("rowheader").first()).toHaveText(second);
  // Focus stays with the moved course's buttons.
  await expect(page.locator(":focus")).toHaveAttribute("aria-label", new RegExp(`: ${first}$`));
  await page.reload();
  await expect(page.getByRole("rowheader").first()).toHaveText(second);
  // Put it back for the next run.
  await page.getByRole("button", { name: structure.moveUp(first) }).click();
  await expect(page.getByRole("rowheader").first()).toHaveText(first);
  removeAdmin(address);
});
