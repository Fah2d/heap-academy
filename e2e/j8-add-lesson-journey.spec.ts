import AxeBuilder from "@axe-core/playwright";
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
import { notFound } from "../src/messages/system";
import { workspace } from "../src/messages/workspace";
import { removeAdmin, signInAsAdmin, sqlRows } from "./admin-helpers";
import { saveScreen } from "./screens";

// J-8 against the local stack (FR-ADM-08, FR-ADM-11; G-5): an admin at aal2
// creates a course and a lesson, writes its instructions, starter, solution
// and a test case, fills the expected output from the solution, validates,
// previews it in the real workspace, and publishes the lesson and the course.
// A guest then sees the lesson within one minute, with no deploy, and gets the
// not-found page at the preview's address. Validation runs in the learners'
// Python, so the first one waits for it to load.

const PYTHON_READY_MS = 60_000;
/** FR-ADM-11: a published change is on the site within one minute. */
const ON_SITE_MS = 60_000;
const TEST_NAME = "Greets Ada";
const SOLUTION = 'name = input()\nprint("Hello, " + name + "!")';

/** Replaces the whole content of one code editor with `code`. */
async function setCode(page: Page, label: string, code: string) {
  const editor = page.getByRole("textbox", { name: label, exact: true });
  await editor.click();
  await page.keyboard.press("ControlOrMeta+A");
  await page.keyboard.insertText(code);
  await expect(editor).toHaveText(code.replaceAll("\n", ""));
}

const statusLine = (status: "draft" | "published") =>
  `${lessonStatus.now(lessonStatus.name[status])} ${lessonStatus.explain[status]}`;

test("[J-8] [FR-ADM-08] [FR-ADM-11] the owner adds a lesson, previews it, publishes it, and a guest sees it within a minute", async ({
  page,
  request,
  browser,
}) => {
  test.setTimeout(240_000);
  const stamp = String(Date.now());
  const address = `admin-j8-${stamp}@example.test`;
  const courseSlug = `j8-${stamp}`;
  await signInAsAdmin(page, request, address);

  await page.getByRole("link", { name: dashboard.newCourse }).click();
  await page.getByLabel(courseEditor.titleLabel).fill("Add a lesson");
  await page.getByLabel(courseEditor.slugLabel).fill(courseSlug);
  await page.getByLabel(courseEditor.summaryLabel).fill("A course made by the J-8 journey.");
  await page.getByLabel(courseEditor.outcomeLabel(1)).fill("Greet someone by name");
  await page.getByRole("button", { name: courseEditor.create }).click();
  await page.getByLabel(courseEditor.newChapterTitleLabel).fill("Basics");
  await page.getByRole("button", { name: courseEditor.addChapter }).click();
  await page.getByLabel(lessonRows.newLessonTitleLabel("Basics")).fill("Greet by name");
  await page.getByRole("button", { name: lessonRows.addLesson }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    lessonEditor.editTitle("Greet by name"),
  );
  const editorAddress = page.url();
  const [lessonRow] = sqlRows(
    `select l.id, l.slug from public.lessons l join public.courses c on c.id = l.course_id where c.slug = '${courseSlug}'`,
  );
  const [lessonId, lessonSlug] = lessonRow ?? [];
  expect(lessonId).toBeDefined();

  // Instructions, starter, solution, and a test case with no expected output yet.
  await page
    .getByLabel(lessonEditor.instructionsLabel)
    .fill("## Greet by name\n\nAsk for a name, then print `Hello, ` and the name with `!`.");
  await setCode(page, lessonEditor.starterLabel, "name = input()");
  await setCode(page, lessonEditor.solutionLabel, SOLUTION);
  await page.getByRole("button", { name: testCaseList.add }).click();
  const testCase = page.getByRole("group", { name: testCaseList.group(1) });
  await testCase.getByLabel(testCaseList.nameLabel, { exact: true }).fill(TEST_NAME);
  await testCase.getByLabel(testCaseList.stdinLabel, { exact: true }).fill("Ada");

  // Validate, then fill the expected output from the solution's actual output.
  await page.getByRole("button", { name: validation.validate }).click();
  const fill = page.getByRole("button", { name: validation.fillLabel(TEST_NAME) });
  await expect(fill).toBeVisible({ timeout: PYTHON_READY_MS });
  await fill.click();
  // Exactly what the solution printed, with print's line break
  // (04-content-system.md section 3).
  await expect(testCase.getByLabel(testCaseList.expectedLabel, { exact: true })).toHaveValue(
    "Hello, Ada!\n",
  );
  await page.getByRole("button", { name: validation.validate }).click();
  await expect(page.getByText(validation.status.passed)).toBeVisible({ timeout: PYTHON_READY_MS });
  await page.getByRole("button", { name: lessonEditor.save }).click();
  await expect(page.getByText(lessonEditor.allSaved)).toBeVisible();

  // Preview: the saved lesson in the real workspace, recording nothing.
  await page.getByRole("link", { name: lessonEditor.previewLesson }).click();
  await expect(page).toHaveURL(`${editorAddress}/preview`);
  await expect(page.getByText(workspace.previewBody)).toBeVisible();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Greet by name");
  await expect(page.locator("[data-python]")).toHaveAttribute("data-python", "ready", {
    timeout: PYTHON_READY_MS,
  });
  await page.locator(".cm-content").click();
  await page.keyboard.press("ControlOrMeta+A");
  await page.keyboard.insertText(SOLUTION);
  await page.getByRole("button", { name: new RegExp(`^${workspace.check}`) }).click();
  await expect(page.locator("[data-completion]")).toHaveText(workspace.previewComplete);
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await saveScreen(page, "admin-preview-route", 1280, { workPackage: "WP-5.4" });
  await page.getByRole("link", { name: lessonEditor.backToEditor }).click();
  await expect(page).toHaveURL(editorAddress);

  // Publish the lesson (Publish needs a validation of the content now in the editor).
  await page.getByRole("button", { name: validation.validate }).click();
  await expect(page.getByText(validation.status.passed)).toBeVisible({ timeout: PYTHON_READY_MS });
  await page.getByRole("button", { name: lessonStatus.action.published, exact: true }).click();
  await expect(page.getByText(statusLine("published"), { exact: true })).toBeVisible();

  // Publish the course from its editor.
  await page.getByRole("link", { name: lessonEditor.backToCourse("Add a lesson") }).click();
  await page.getByRole("button", { name: courseEditor.statusAction.published }).click();
  await expect(
    page.getByRole("group", { name: courseEditor.statusHeading, exact: true }).getByRole("status"),
  ).toHaveText(courseEditor.statusChanged(courseEditor.statusName.published));
  const publishedAt = Date.now();

  // A guest sees the lesson within a minute, with no deploy.
  const guestContext = await browser.newContext();
  const guest = await guestContext.newPage();
  const lessonAddress = `/learn/${courseSlug}/${lessonSlug ?? ""}`;
  await expect
    .poll(
      async () => {
        await guest.goto(lessonAddress);
        return guest.getByRole("heading", { level: 1 }).textContent();
      },
      { timeout: ON_SITE_MS },
    )
    .toBe("Greet by name");
  expect(Date.now() - publishedAt).toBeLessThanOrEqual(ON_SITE_MS);

  // The preview is not a public address: a guest gets the not-found page.
  const previewResponse = await guest.goto(`/admin/lessons/${lessonId ?? ""}/preview`);
  expect(previewResponse?.status()).toBe(404);
  await expect(guest.getByRole("heading", { level: 1 })).toHaveText(notFound.heading);
  await guestContext.close();

  removeAdmin(address);
});
