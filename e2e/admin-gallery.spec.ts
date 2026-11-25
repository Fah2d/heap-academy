import AxeBuilder from "@axe-core/playwright";
import { expect, type Page, test } from "@playwright/test";
import {
  ADMIN_STATE_PATH,
  ADMIN_STATES,
  type AdminState,
} from "../src/features/admin/components/admin-states";
import { HARNESS_OUTPUT_LIMIT } from "../src/grader/harness";
import { CHECK_TEST_LIMIT } from "../src/grader/test-case";
import {
  adminArea,
  courseEditor,
  dashboard,
  lessonEditor,
  lessonStatus,
  secondStep,
  structure,
  testCaseList,
  validation,
} from "../src/messages/admin";
import { adminGallery } from "../src/messages/gallery";
import { lessonContent } from "../src/messages/lesson";
import { TIME_LIMIT_MS } from "../src/runtime/controller";
import { saveScreen } from "./screens";

// The admin states the J-12 journey cannot reach (WP-2.3 design review 1),
// on the development-only page /dev/admin, one state per page
// (/dev/admin?state=<state>). Runs in the `gallery` project, against the
// development server.

/**
 * axe's findings once no colour transition is running: a pending button is
 * read in its final colours, not halfway between two of them.
 */
async function axeViolations(page: Page) {
  await page.waitForFunction(() =>
    document
      .getAnimations()
      .every(
        (animation) => !(animation instanceof CSSTransition) || animation.playState !== "running",
      ),
  );
  return (await new AxeBuilder({ page }).analyze()).violations;
}

async function openState(page: Page, state: AdminState, title: string) {
  // A state the spec has clicked through is checked as it was left, before the next one opens.
  if (new URL(page.url()).searchParams.has("state")) {
    expect(await axeViolations(page)).toEqual([]);
  }
  await page.goto(`${ADMIN_STATE_PATH}?state=${state}`);
  const region = page.getByRole("region", { name: title });
  await expect(region).toBeVisible();
  return region;
}

// And the last state a test leaves, as it left it.
test.afterEach(async ({ page }) => {
  if (new URL(page.url()).searchParams.has("state")) {
    expect(await axeViolations(page)).toEqual([]);
  }
});

test("[FR-ADM-02] the gallery lists every admin state, each on its own page", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto(ADMIN_STATE_PATH);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(adminGallery.title);
  for (const { state, title } of ADMIN_STATES) {
    await expect(page.getByRole("link", { name: title, exact: true })).toHaveAttribute(
      "href",
      `${ADMIN_STATE_PATH}?state=${state}`,
    );
  }
  expect(await axeViolations(page)).toEqual([]);
});

// Each state alone, as an admin page would hold it: one view's landmarks.
for (const { state, title } of ADMIN_STATES) {
  test(`[FR-ADM-02] the "${state}" state shows, with no axe violation, at 1280 px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await openState(page, state, title);
    expect(await axeViolations(page)).toEqual([]);
  });
}

test("[FR-ADM-02] the course list's and the second step's states, at 1280 px", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  const empty = await openState(page, "empty", adminGallery.courseListEmpty);
  await expect(empty.getByText(dashboard.empty)).toBeVisible();
  const failed = await openState(page, "failed", adminGallery.courseListFailed);
  await expect(failed.getByText(dashboard.loadFailed)).toBeVisible();
  const rows = await openState(page, "rows", adminGallery.courseListRows);
  await expect(rows.getByRole("rowheader", { name: adminGallery.sampleCourse })).toBeVisible();
  await saveScreen(page, "admin-states", 1280, { workPackage: "WP-2.3" });

  const setup = await openState(page, "setup", adminGallery.setupFailed);
  await setup.getByRole("button", { name: secondStep.start }).click();
  await expect(
    setup.getByRole("alert").filter({ hasText: secondStep.setupUnavailable }),
  ).toBeVisible();

  const limited = await openState(page, "limited", adminGallery.codeLimited);
  await limited.getByRole("textbox", { name: secondStep.codeLabel }).fill("123456");
  await limited.getByRole("button", { name: secondStep.verify }).click();
  await expect(
    limited.getByRole("alert").filter({ hasText: secondStep.tooManyAttempts }),
  ).toBeVisible();
  expect(await axeViolations(page)).toEqual([]);

  const checking = await openState(page, "checking", adminGallery.codeChecking);
  await checking.getByRole("textbox", { name: secondStep.codeLabel }).fill("123456");
  await checking.getByRole("button", { name: secondStep.verify }).click();
  await expect(checking.getByRole("button", { name: secondStep.checking })).toBeDisabled();
  expect(await axeViolations(page)).toEqual([]);
});

test("[FR-ADM-03] [FR-ADM-10] the course editor's refusals and empty states, at 1280 px", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  const refusing = await openState(page, "editor-refusing", adminGallery.editorRefusing);
  await refusing.getByRole("button", { name: courseEditor.statusAction.published }).click();
  await expect(refusing.getByRole("alert")).toContainText(structure.failure.no_published_lesson);
  await refusing.getByRole("button", { name: courseEditor.save }).click();
  // The refused status change keeps its alert, so the stale save's is a second one.
  await expect(
    refusing.getByRole("alert").filter({ hasText: structure.failure.stale }),
  ).toBeVisible();
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

  const empty = await openState(page, "editor-empty", adminGallery.editorEmpty);
  await expect(empty.getByText(courseEditor.chaptersEmpty)).toBeVisible();
  const created = await openState(page, "new-course", adminGallery.newCourse);
  await created.getByRole("button", { name: courseEditor.create }).click();
  await expect(created.getByText(courseEditor.fieldInvalid.title)).toBeVisible();

  const rows = await openState(page, "rows", adminGallery.courseListRows);
  await rows.getByRole("button", { name: structure.moveDown(adminGallery.sampleCourse) }).click();
  await expect(rows.getByRole("alert")).toContainText(structure.failure.cannot_move);

  expect(await axeViolations(page)).toEqual([]);
  await saveScreen(page, "admin-course-states", 1280, { workPackage: "WP-4.1" });
});

test("[FR-ADM-03] [FR-ADM-09] [FR-ADM-10] the course editor's pending, saved, question and failure states, at 1280 px", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  const shot = (name: string) => saveScreen(page, name, 1280, { workPackage: "WP-4.1" });

  // A published course: its own moves, and each question before it acts.
  const published = await openState(page, "editor-published", adminGallery.editorPublished);
  await expect(
    published.getByText(courseEditor.statusNow(courseEditor.statusName.published)),
  ).toBeVisible();
  await expect(
    published.getByRole("button", { name: courseEditor.statusAction.draft }),
  ).toBeVisible();
  await published.getByRole("button", { name: courseEditor.statusAction.archived }).click();
  const archive = page.getByRole("dialog", { name: courseEditor.confirmStatusTitle.archived });
  await expect(archive).toContainText(courseEditor.confirmStatusBody.archived);
  expect(await axeViolations(page)).toEqual([]);
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
  expect(await axeViolations(page)).toEqual([]);
  await shot("admin-course-editor-pending");

  // Saves that succeed: the saved line, and focus on the new status.
  const saving = await openState(page, "editor-saving", adminGallery.editorSaving);
  await saving.getByLabel(courseEditor.summaryLabel, { exact: true }).fill("Saved here.");
  await saving.getByRole("button", { name: courseEditor.save }).click();
  await expect(saving.getByRole("status").filter({ hasText: courseEditor.saved })).toBeVisible();
  await saving.getByRole("button", { name: courseEditor.statusAction.published }).click();
  await expect(
    saving.getByText(courseEditor.statusNow(courseEditor.statusName.published)),
  ).toBeFocused();
  await shot("admin-course-editor-saved");

  const failed = await openState(page, "editor-failed", adminGallery.editorFailed);
  await expect(failed.getByText(courseEditor.loadFailed)).toBeVisible();
  const taken = await openState(page, "new-course-taken", adminGallery.newCourseTaken);
  await taken.getByLabel(courseEditor.titleLabel).fill("Taken");
  await taken.getByLabel(courseEditor.slugLabel).fill("sample-course");
  await taken
    .getByLabel(courseEditor.summaryLabel, { exact: true })
    .fill("A course whose address is taken.");
  await taken.getByRole("button", { name: courseEditor.create }).click();
  await expect(taken.getByLabel(courseEditor.slugLabel)).toBeFocused();
  await expect(taken.getByText(structure.failure.slug_taken)).toBeVisible();
  expect(await axeViolations(page)).toEqual([]);
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
    expect(await axeViolations(page)).toEqual([]);
    await saveScreen(page, "admin-narrow", width, { workPackage: "WP-2.3" });
  });
}

test("[FR-ADM-04] [FR-ADM-10] the lesson editor's states, at 1280 px", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  const shot = (name: string) => saveScreen(page, name, 1280, { workPackage: "WP-4.2" });

  // Saves that succeed, and a preview that renders as the learner sees it.
  const editing = await openState(page, "lesson-editor", adminGallery.lessonEditor);
  // The top bar's link to the lesson in the real workspace (FR-ADM-08).
  await expect(editing.getByRole("link", { name: lessonEditor.previewLesson })).toHaveAttribute(
    "href",
    /^\/admin\/lessons\/[^/]+\/preview$/,
  );
  await editing.getByRole("heading", { level: 2 }).first().scrollIntoViewIfNeeded();
  await saveScreen(page, "admin-lesson-editor-preview-link", 1280, {
    workPackage: "WP-5.4",
    fullPage: false,
  });
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
  const refusing = await openState(page, "lesson-refusing", adminGallery.lessonRefusing);
  await refusing.getByLabel(lessonEditor.instructionsLabel).fill("## Changed");
  await expect(refusing.getByText(lessonEditor.previewFailed)).toBeVisible();
  await refusing.getByRole("button", { name: lessonEditor.save }).click();
  await expect(refusing.getByRole("alert").first()).toContainText(lessonEditor.failure.stale);
  await expect(refusing.getByLabel(lessonEditor.instructionsLabel)).toHaveValue("## Changed");
  expect(await axeViolations(page)).toEqual([]);
  await shot("admin-lesson-editor-refused");

  // A published lesson says how its code changes are saved; a save that never answers stays pending.
  const published = await openState(page, "lesson-published", adminGallery.lessonPublished);
  await expect(published.getByText(lessonEditor.publishedCodeNote)).toBeVisible();
  await published.getByLabel(lessonEditor.titleLabel).fill("Pending");
  await published.getByRole("button", { name: lessonEditor.save }).click();
  await expect(published.getByRole("button", { name: lessonEditor.saving })).toBeVisible();
  await shot("admin-lesson-editor-pending");

  // An empty lesson: the empty preview and no wrong answers; invalid fields are named.
  const empty = await openState(page, "lesson-empty", adminGallery.lessonEmpty);
  await expect(empty.getByText(lessonEditor.previewEmpty)).toBeVisible();
  await expect(empty.getByText(lessonEditor.wrongAnswersEmpty)).toBeVisible();
  await empty.getByLabel(lessonEditor.titleLabel).fill("");
  await empty.getByRole("button", { name: lessonEditor.save }).click();
  await expect(empty.getByText(lessonEditor.fieldInvalid.title)).toBeVisible();
  expect(await axeViolations(page)).toEqual([]);
  await shot("admin-lesson-editor-empty");
});

test("[FR-ADM-04] [FR-ADM-10] the lesson editor's failures, limits and learner content, at 1280 px", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  const shot = (name: string) => saveScreen(page, name, 1280, { workPackage: "WP-4.2" });

  // Three wrong answers: no Add; a save that fails says so and keeps the text.
  const full = await openState(page, "lesson-full", adminGallery.lessonFull);
  await expect(full.getByRole("button", { name: lessonEditor.addWrongAnswer })).toHaveCount(0);
  await full.getByLabel(lessonEditor.titleLabel).fill("Kept");
  await full.getByRole("button", { name: lessonEditor.save }).click();
  await expect(full.getByRole("alert").first()).toContainText(lessonEditor.failure.unavailable);
  await expect(full.getByLabel(lessonEditor.titleLabel)).toHaveValue("Kept");
  await shot("admin-lesson-editor-save-failed");

  // A taken address is said once, under its field.
  const taken = await openState(page, "lesson-taken", adminGallery.lessonTaken);
  await taken.getByRole("button", { name: lessonEditor.save }).click();
  await expect(taken.getByText(lessonEditor.failure.slug_taken)).toHaveCount(1);
  await expect(taken.getByLabel(lessonEditor.slugLabel)).toHaveAttribute("aria-invalid", "true");
  await shot("admin-lesson-editor-slug-taken");

  // A starter over the limit: the editor itself is invalid, focused and described.
  const tooLong = await openState(page, "lesson-too-long", adminGallery.lessonTooLong);
  await tooLong.getByRole("button", { name: lessonEditor.save }).click();
  const starter = tooLong.getByRole("textbox", { name: lessonEditor.starterLabel });
  await expect(starter).toHaveAttribute("aria-invalid", "true");
  await expect(starter).toBeFocused();
  await expect(tooLong.getByText(lessonEditor.fieldInvalid.starterCode)).toBeVisible();
  expect(await axeViolations(page)).toEqual([]);
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
  const content = await openState(page, "lesson-content", adminGallery.lessonContent);
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
  const shot = (name: string) => saveScreen(page, name, 1280, { workPackage: "WP-4.3" });

  // No test case yet: the empty sentence, and Add opens a new one with its name focused.
  const empty = await openState(page, "lesson-empty", adminGallery.lessonEmpty);
  await expect(empty.getByText(testCaseList.empty)).toBeVisible();
  await shot("admin-test-cases-empty");
  await empty.getByRole("button", { name: testCaseList.add }).click();
  const added = empty.getByRole("group", { name: testCaseList.group(1) });
  await expect(added.getByRole("textbox", { name: testCaseList.nameLabel })).toBeFocused();
  await expect(empty.getByText(lessonEditor.unsaved)).toBeVisible();
  expect(await axeViolations(page)).toEqual([]);
  await shot("admin-test-case-open");

  // Twelve: no Add and no Duplicate, and the sentence that says why.
  const full = await openState(page, "lesson-tests-full", adminGallery.lessonTestCasesFull);
  await expect(full.getByText(testCaseList.full(CHECK_TEST_LIMIT))).toBeVisible();
  await expect(full.getByRole("button", { name: testCaseList.add })).toHaveCount(0);
  await full
    .getByRole("button", { name: testCaseList.title(1, adminGallery.sampleTestName) })
    .click();
  await expect(full.getByRole("button", { name: /^Duplicate: / })).toHaveCount(0);
  await shot("admin-test-cases-full");

  // Save opens the test case with problems, focuses its name, and names each field.
  const problem = await openState(page, "lesson-test-problem", adminGallery.lessonTestCaseProblem);
  await problem.getByRole("button", { name: lessonEditor.save }).click();
  const second = problem.getByRole("group", { name: testCaseList.group(2) });
  await expect(second.getByRole("textbox", { name: testCaseList.nameLabel })).toBeFocused();
  await expect(second.getByText(testCaseList.problem.nameMissing)).toBeVisible();
  await expect(second.getByText(testCaseList.problem.tooLong.expected(5_000))).toBeVisible();
  expect(await axeViolations(page)).toEqual([]);
  await shot("admin-test-case-problems");
});

test("[FR-ADM-06] [FR-ADM-07] Validate: Python loading, failed, validating, a failed rule with Fill from solution, and a pass, at 1280 px", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  const shot = (name: string) => saveScreen(page, name, 1280, { workPackage: "WP-4.3" });
  const validate = (region: ReturnType<typeof page.getByRole>) =>
    region.getByRole("button", { name: validation.validate }).click();
  const publishHeading = (region: ReturnType<typeof page.getByRole>) =>
    region.getByRole("heading", { level: 2, name: lessonEditor.publishHeading, exact: true });

  // Python loading: Validate waits for it, and Stop ends the wait.
  const loading = await openState(page, "lesson-python-loading", adminGallery.lessonPythonLoading);
  await expect(loading.getByText(validation.python.loading)).toBeVisible();
  await validate(loading);
  await expect(loading.getByRole("button", { name: validation.stop })).toBeVisible();
  await publishHeading(loading).scrollIntoViewIfNeeded();
  expect(await axeViolations(page)).toEqual([]);
  await shot("admin-validate-python-loading");
  await loading.getByRole("button", { name: validation.stop }).click();
  await expect(loading.getByText(validation.status.stopped)).toBeVisible();
  await publishHeading(loading).scrollIntoViewIfNeeded();
  expect(await axeViolations(page)).toEqual([]);
  await shot("admin-validation-stopped");

  // Python could not start: Try again, and Validate says nothing was checked.
  const failed = await openState(page, "lesson-python-failed", adminGallery.lessonPythonFailed);
  await expect(failed.getByRole("button", { name: validation.retry })).toBeVisible();
  await validate(failed);
  await expect(failed.getByText(validation.unavailableStart)).toBeVisible();
  await publishHeading(failed).scrollIntoViewIfNeeded();
  expect(await axeViolations(page)).toEqual([]);
  await shot("admin-validate-python-failed");

  // Validating: the pending Validate and Stop.
  const running = await openState(page, "lesson-validating", adminGallery.lessonValidating);
  await validate(running);
  await expect(running.getByText(validation.status.running)).toBeVisible();
  await publishHeading(running).scrollIntoViewIfNeeded();
  expect(await axeViolations(page)).toEqual([]);
  await shot("admin-validating");

  // Python started but could not run the programs: nothing was checked.
  const cannotRun = await openState(
    page,
    "lesson-python-cannot-run",
    adminGallery.lessonPythonCannotRun,
  );
  await validate(cannotRun);
  await expect(cannotRun.getByText(validation.unavailable)).toBeVisible();
  await publishHeading(cannotRun).scrollIntoViewIfNeeded();
  expect(await axeViolations(page)).toEqual([]);
  await shot("admin-validation-python-cannot-run");

  // A failed rule names the test case; its verdict shows what the solution printed.
  const wrong = await openState(
    page,
    "lesson-validation-failed",
    adminGallery.lessonValidationFailed,
  );
  await validate(wrong);
  await expect(wrong.getByText(validation.status.failed(1))).toBeVisible();
  await publishHeading(wrong).scrollIntoViewIfNeeded();
  expect(await axeViolations(page)).toEqual([]);
  await shot("admin-validation-failed");
  // Open, under the failed rule, opens the test case and focuses its title.
  await wrong
    .getByRole("button", {
      name: validation.openTestCase(validation.testCaseRef(2, adminGallery.sampleTestName2)),
    })
    .click();
  const second = wrong.getByRole("group", { name: testCaseList.group(2) });
  const secondTitle = wrong.getByRole("button", {
    name: testCaseList.title(2, adminGallery.sampleTestName2),
  });
  await expect(secondTitle).toBeFocused();
  await expect(secondTitle).toHaveAttribute("aria-expanded", "true");
  expect(await axeViolations(page)).toEqual([]);
  await shot("admin-test-case-opened");
  await expect(second.getByText(validation.reason.mismatch)).toBeVisible();
  await second.getByRole("heading", { name: validation.solutionHeading }).scrollIntoViewIfNeeded();
  expect(await axeViolations(page)).toEqual([]);
  await shot("admin-test-case-verdict");
  await second
    .getByRole("button", { name: validation.fillLabel(adminGallery.sampleTestName2) })
    .click();
  await expect(second.getByRole("textbox", { name: testCaseList.expectedLabel })).toBeFocused();
  await expect(second.getByText(validation.verdictOutdated)).toBeVisible();
  await expect(wrong.getByText(validation.outdated)).toBeVisible();
  await second.getByRole("heading", { name: validation.solutionHeading }).scrollIntoViewIfNeeded();
  expect(await axeViolations(page)).toEqual([]);
  await shot("admin-verdict-outdated");
  await publishHeading(wrong).scrollIntoViewIfNeeded();
  await shot("admin-validation-outdated");

  // Validate again: every rule passes.
  await validate(wrong);
  await expect(wrong.getByText(validation.status.passed)).toBeVisible();
  await publishHeading(wrong).scrollIntoViewIfNeeded();
  expect(await axeViolations(page)).toEqual([]);
  await shot("admin-validation-passed");

  // An empty lesson: rule 1 names what is missing, and nothing runs.
  const empty = await openState(page, "lesson-empty", adminGallery.lessonEmpty);
  await validate(empty);
  await expect(
    empty.getByText(validation.missing([validation.part.instructions, validation.part.test_cases])),
  ).toBeVisible();
  await publishHeading(empty).scrollIntoViewIfNeeded();
  expect(await axeViolations(page)).toEqual([]);
  await shot("admin-validation-missing");
});

test("[FR-ADM-06] [FR-ADM-07] [T-07] Validate: a time limit, an error on a line, cut and cleaned output, and Save on a published lesson validating first, at 1280 px", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  const shot = (name: string) => saveScreen(page, name, 1280, { workPackage: "WP-4.3" });
  const publishHeading = (region: ReturnType<typeof page.getByRole>) =>
    region.getByRole("heading", { level: 2, name: lessonEditor.publishHeading, exact: true });
  const save = (region: ReturnType<typeof page.getByRole>) =>
    region.getByRole("button", { name: lessonEditor.save }).click();

  // The starter reaches the time limit; the solution fails three ways.
  const odd = await openState(page, "lesson-odd-results", adminGallery.lessonOddResults);
  await odd.getByRole("button", { name: validation.validate }).click();
  await expect(
    odd.getByText(validation.timedOut(TIME_LIMIT_MS / 1000, [validation.program.starter])),
  ).toBeVisible();
  await publishHeading(odd).scrollIntoViewIfNeeded();
  expect(await axeViolations(page)).toEqual([]);
  await shot("admin-validation-time-limit");

  // Output with escape sequences is shown without them, and Fill is not offered.
  await odd
    .getByRole("button", { name: testCaseList.title(1, adminGallery.sampleTestName) })
    .click();
  const first = odd.getByRole("group", { name: testCaseList.group(1) });
  await expect(first.getByText(validation.cleaned)).toBeVisible();
  await expect(first.getByTestId("solution-output")).toHaveText(adminGallery.sampleTestExpected);
  await expect(
    first.getByRole("button", { name: validation.fillLabel(adminGallery.sampleTestName) }),
  ).toHaveCount(0);
  await first.getByRole("heading", { name: validation.solutionHeading }).scrollIntoViewIfNeeded();
  expect(await axeViolations(page)).toEqual([]);
  await shot("admin-verdict-cleaned");

  // An error names its line.
  await odd
    .getByRole("button", { name: testCaseList.title(2, adminGallery.sampleTestName2) })
    .click();
  const second = odd.getByRole("group", { name: testCaseList.group(2) });
  await expect(second.getByText(validation.reason.program_error)).toBeVisible();
  await expect(second.getByText(validation.error(adminGallery.oddErrorMessage, 2))).toBeVisible();
  await second.getByRole("heading", { name: validation.solutionHeading }).scrollIntoViewIfNeeded();
  expect(await axeViolations(page)).toEqual([]);
  await shot("admin-verdict-error-line");

  // Output past the limit is cut, said so, and not fillable.
  await odd.getByRole("button", { name: testCaseList.title(3, adminGallery.oddTestName3) }).click();
  const third = odd.getByRole("group", { name: testCaseList.group(3) });
  await expect(third.getByText(validation.reason.output_limit(HARNESS_OUTPUT_LIMIT))).toBeVisible();
  await expect(third.getByText(validation.truncated(HARNESS_OUTPUT_LIMIT))).toBeVisible();
  await expect(
    third.getByRole("button", { name: validation.fillLabel(adminGallery.oddTestName3) }),
  ).toHaveCount(0);
  // The whole cut output scrolls inside a box of a fixed height.
  const cut = await third
    .getByTestId("solution-output")
    .evaluate((box) => ({ shown: box.clientHeight, whole: box.scrollHeight }));
  expect(cut.whole).toBeGreaterThan(cut.shown);
  expect(cut.shown).toBeLessThan(400);
  await third.getByRole("heading", { name: validation.solutionHeading }).scrollIntoViewIfNeeded();
  expect(await axeViolations(page)).toEqual([]);
  await shot("admin-verdict-truncated");

  // Save on a published lesson validates first; Stop saves nothing.
  const validating = await openState(
    page,
    "lesson-save-validating",
    adminGallery.lessonSaveValidating,
  );
  await save(validating);
  await expect(validating.getByText(validation.status.running)).toBeVisible();
  await expect(validating.getByRole("button", { name: validation.stop })).toBeVisible();
  await publishHeading(validating).scrollIntoViewIfNeeded();
  expect(await axeViolations(page)).toEqual([]);
  await shot("admin-save-validating");
  await validating.getByRole("button", { name: validation.stop }).click();
  await expect(validating.getByText(lessonEditor.validateFirst.stopped)).toBeVisible();
  await validating.getByText(lessonEditor.validateFirst.stopped).scrollIntoViewIfNeeded();
  expect(await axeViolations(page)).toEqual([]);
  await shot("admin-save-refused-stopped");

  // Python could not start: nothing is saved, and the way out is named.
  const noPython = await openState(
    page,
    "lesson-save-python-failed",
    adminGallery.lessonSavePythonFailed,
  );
  await save(noPython);
  await expect(noPython.getByText(lessonEditor.validateFirst.unavailableStart)).toBeVisible();
  await noPython.getByText(lessonEditor.validateFirst.unavailableStart).scrollIntoViewIfNeeded();
  expect(await axeViolations(page)).toEqual([]);
  await shot("admin-save-refused-python");

  // Python started but could not run the programs: nothing is saved.
  const cannotRun = await openState(
    page,
    "lesson-save-python-cannot-run",
    adminGallery.lessonSavePythonCannotRun,
  );
  await save(cannotRun);
  await expect(cannotRun.getByText(lessonEditor.validateFirst.unavailable)).toBeVisible();
  await expect(cannotRun.getByText(validation.unavailable)).toBeVisible();
  await cannotRun.getByText(lessonEditor.validateFirst.unavailable).scrollIntoViewIfNeeded();
  expect(await axeViolations(page)).toEqual([]);
  await shot("admin-save-refused-cannot-run");

  // A rule failed: nothing is saved, and the checklist says what to fix.
  const ruleFailed = await openState(
    page,
    "lesson-save-rule-failed",
    adminGallery.lessonSaveRuleFailed,
  );
  await save(ruleFailed);
  await expect(ruleFailed.getByText(lessonEditor.validateFirst.failed)).toBeVisible();
  await expect(ruleFailed.getByText(validation.status.failed(1))).toBeVisible();
  await ruleFailed.getByText(lessonEditor.validateFirst.failed).scrollIntoViewIfNeeded();
  expect(await axeViolations(page)).toEqual([]);
  await shot("admin-save-refused-rule");
});

test("[FR-ADM-09] [FR-ADM-07] the lesson status: Publish after a pass, refused, published, archived, at 1280 px", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  const shot = (name: string) => saveScreen(page, name, 1280, { workPackage: "WP-4.3" });
  const statusGroup = (region: ReturnType<typeof page.getByRole>) =>
    region.getByRole("group", { name: lessonStatus.heading });
  const publish = (region: ReturnType<typeof page.getByRole>) =>
    region.getByRole("button", { name: lessonStatus.action.published });

  // A draft: Publish waits for a pass, then saves and publishes.
  const draft = await openState(page, "lesson-editor", adminGallery.lessonEditor);
  await expect(draft.getByText(lessonStatus.publishWaits)).toBeVisible();
  await expect(publish(draft)).toHaveCount(0);
  await draft.getByRole("button", { name: validation.validate }).click();
  await expect(draft.getByText(validation.status.passed)).toBeVisible();
  await statusGroup(draft).scrollIntoViewIfNeeded();
  expect(await axeViolations(page)).toEqual([]);
  await shot("admin-lesson-publish-ready");
  await publish(draft).click();
  // Read out by the live region; the focused status line shows it.
  await expect(draft.getByText(lessonStatus.changed(lessonStatus.name.published))).toBeAttached();
  // The note above Publish says the same words, so the check is on what has focus.
  await expect(draft.locator(":focus")).toContainText(
    lessonStatus.now(lessonStatus.name.published),
  );
  await shot("admin-lesson-published-now");

  // The status change is refused: the reason, in the Publish section.
  const refusing = await openState(page, "lesson-refusing", adminGallery.lessonRefusing);
  await refusing.getByRole("button", { name: lessonStatus.action.archived }).click();
  const confirm = page.getByRole("dialog", { name: lessonStatus.confirmTitle.archived });
  await expect(confirm.getByText(lessonStatus.confirmBody.archived)).toBeVisible();
  expect(await axeViolations(page)).toEqual([]);
  await shot("admin-lesson-archive-confirm");
  await confirm.getByRole("button", { name: lessonStatus.action.archived }).click();
  await expect(refusing.getByText(lessonStatus.failure.status_not_allowed)).toBeVisible();
  await statusGroup(refusing).scrollIntoViewIfNeeded();
  expect(await axeViolations(page)).toEqual([]);
  await shot("admin-lesson-status-refused");

  // A published lesson: Move back to draft asks and says what learners will see.
  const published = await openState(page, "lesson-published", adminGallery.lessonPublished);
  await published.getByRole("button", { name: lessonStatus.action.draft }).click();
  const unpublish = page.getByRole("dialog", { name: lessonStatus.confirmTitle.draft });
  await expect(unpublish.getByText(lessonStatus.confirmBody.draft)).toBeVisible();
  expect(await axeViolations(page)).toEqual([]);
  await shot("admin-lesson-unpublish-confirm");
  await unpublish.getByRole("button", { name: lessonStatus.cancel }).click();
  await statusGroup(published).scrollIntoViewIfNeeded();
  expect(await axeViolations(page)).toEqual([]);
  await shot("admin-lesson-published");

  // An archived lesson: only Move back to draft, which asks nothing.
  const archived = await openState(page, "lesson-archived", adminGallery.lessonArchived);
  await expect(archived.getByRole("button", { name: lessonStatus.action.draft })).toBeVisible();
  await expect(publish(archived)).toHaveCount(0);
  await statusGroup(archived).scrollIntoViewIfNeeded();
  expect(await axeViolations(page)).toEqual([]);
  await shot("admin-lesson-archived");
});
