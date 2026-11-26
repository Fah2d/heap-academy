import { expect, test, type Page } from "@playwright/test";
import {
  courseEditor,
  dashboard,
  lessonEditor,
  lessonRows,
  lessonStatus,
  testCaseList,
  validation,
} from "../src/messages/admin";
import { TIME_LIMIT_MS } from "../src/runtime/controller";
import { removeAdmin, signInAsAdmin } from "./admin-helpers";
import { noAxeViolations } from "./journeys";

// J-13 against the local stack (FR-GRD-05, FR-ADM-06, FR-ADM-07, FR-ADM-09):
// an admin at aal2 writes a lesson whose solution fails its test case, then one
// whose starter already passes. Validate refuses both with the reason, and
// Publish never appears. Once every rule passes, Publish puts the lesson on
// the site, the status survives a reload, and Move back to draft asks first.
// Validation runs in the learners' Python, so the first one waits for it to
// load.

const PYTHON_READY_MS = 60_000;
// Once Python is loaded, a validation here runs the solution and the starter,
// and the runtime lets each run for up to the time limit before it stops it.
const VALIDATION_MS = 2 * TIME_LIMIT_MS;
const TEST_NAME = "Greets Ada";

/** Replaces the whole content of one code editor with `code`. */
async function setCode(page: Page, label: string, code: string) {
  const editor = page.getByRole("textbox", { name: label, exact: true });
  await editor.click();
  await page.keyboard.press("ControlOrMeta+A");
  await page.keyboard.type(code);
  await expect(editor).toHaveText(code);
}

function rule(page: Page, text: string) {
  return page
    .getByRole("list", { name: validation.checklistLabel })
    .getByRole("listitem")
    .filter({ hasText: text });
}

const publishButton = (page: Page) =>
  page.getByRole("button", { name: lessonStatus.action.published, exact: true });
/** The status sentence, which names the status and says who can see the lesson. */
const statusLine = (status: "draft" | "published") =>
  `${lessonStatus.now(lessonStatus.name[status])} ${lessonStatus.explain[status]}`;

test("[J-13] [FR-GRD-05] [T-22] [FR-ADM-06] [FR-ADM-07] [FR-ADM-09] a broken lesson cannot go live; a validated one is published and moved back to draft", async ({
  page,
  request,
}) => {
  test.setTimeout(180_000);
  const address = `admin-publish-${Date.now()}@example.test`;
  await signInAsAdmin(page, request, address);

  await page.getByRole("link", { name: dashboard.newCourse }).click();
  await page.getByLabel(courseEditor.titleLabel).fill("Publish check");
  await page.getByLabel(courseEditor.slugLabel).fill(`publish-check-${Date.now()}`);
  await page.getByLabel(courseEditor.summaryLabel).fill("A course made by the publish journey.");
  await page.getByLabel(courseEditor.outcomeLabel(1)).fill("Publish a lesson");
  await page.getByRole("button", { name: courseEditor.create }).click();
  await page.getByLabel(courseEditor.newChapterTitleLabel).fill("Basics");
  await page.getByRole("button", { name: courseEditor.addChapter }).click();
  await page.getByLabel(lessonRows.newLessonTitleLabel("Basics")).fill("Greet Ada");
  await page.getByRole("button", { name: lessonRows.addLesson }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    lessonEditor.editTitle("Greet Ada"),
  );

  await page
    .getByLabel(lessonEditor.instructionsLabel)
    .fill("## Greet Ada\n\nPrint `Hello, Ada!` on one line.");
  await page.getByRole("button", { name: testCaseList.add }).click();
  const testCase = page.getByRole("group", { name: testCaseList.group(1) });
  await testCase.getByLabel(testCaseList.nameLabel, { exact: true }).fill(TEST_NAME);
  await testCase.getByLabel(testCaseList.expectedLabel, { exact: true }).fill("Hello, Ada!");

  // 1. The solution fails its test case: refused, with the test case named.
  await setCode(page, lessonEditor.starterLabel, "# Print the greeting here");
  await setCode(page, lessonEditor.solutionLabel, 'print("Hello, Ada")');
  await page.getByRole("button", { name: validation.validate }).click();
  await expect(page.getByText(validation.status.failed(1))).toBeVisible({
    timeout: PYTHON_READY_MS,
  });
  await expect(rule(page, validation.rule.solution_passes)).toContainText(validation.state.failed);
  await expect(rule(page, validation.rule.solution_passes)).toContainText(
    validation.solutionFailed([validation.testCaseRef(1, TEST_NAME)]),
  );
  await expect(publishButton(page)).toHaveCount(0);
  await expect(page.getByText(lessonStatus.publishWaits)).toBeVisible();
  await noAxeViolations(page);

  // 2. The starter already passes: refused, because a learner has nothing to do.
  await setCode(page, lessonEditor.solutionLabel, 'print("Hello, Ada!")');
  await setCode(page, lessonEditor.starterLabel, 'print("Hello, Ada!")');
  await page.getByRole("button", { name: validation.validate }).click();
  await expect(page.getByText(validation.status.failed(1))).toBeVisible({ timeout: VALIDATION_MS });
  await expect(rule(page, validation.rule.solution_passes)).toContainText(validation.state.passed);
  await expect(rule(page, validation.rule.starter_fails)).toContainText(validation.state.failed);
  await expect(rule(page, validation.rule.starter_fails)).toContainText(validation.starterPasses);
  await expect(publishButton(page)).toHaveCount(0);

  // 3. Every rule passes: Publish appears, saves, and puts the lesson on the site.
  await setCode(page, lessonEditor.starterLabel, 'print("Hello")');
  await page.getByRole("button", { name: validation.validate }).click();
  await expect(page.getByText(validation.status.passed)).toBeVisible({ timeout: VALIDATION_MS });
  await publishButton(page).click();
  // Read out by the live region; the focused status line shows it.
  await expect(page.getByText(lessonStatus.changed(lessonStatus.name.published))).toBeAttached();
  await expect(page.getByText(statusLine("published"), { exact: true })).toBeVisible();
  await expect(page.getByText(lessonEditor.allSaved)).toBeVisible();
  await noAxeViolations(page);

  // The database holds the status: it survives a reload.
  await page.reload();
  await expect(page.getByText(statusLine("published"), { exact: true })).toBeVisible();

  // 4. Moving it back to draft asks first and says what learners will see.
  await page.getByRole("button", { name: lessonStatus.action.draft, exact: true }).click();
  const dialog = page.getByRole("dialog", { name: lessonStatus.confirmTitle.draft });
  await expect(dialog).toContainText(lessonStatus.confirmBody.draft);
  await noAxeViolations(page);
  await dialog.getByRole("button", { name: lessonStatus.action.draft, exact: true }).click();
  await expect(page.getByText(statusLine("draft"), { exact: true })).toBeVisible();

  removeAdmin(address);
});
