import { expect, test, type Page } from "@playwright/test";
import { profileGallery } from "../src/messages/gallery";
import { profile } from "../src/messages/profile";
import { errorPage } from "../src/messages/system";
import { noAxeViolations } from "./journeys";
import { saveScreen } from "./screens";

// The profile's states (docs/spec/03-experience.md sections 5.5 and 8) on the
// development-only page /dev/profile, with sample numbers and answers that
// never reach a server, so each state can be checked with axe and seen
// (WP-8.1 design review, B3). The real page, with a real account and a real
// deletion, is J-10 (e2e/j10-delete-account-journey.spec.ts). Runs in the
// `gallery` project, against the development server.

const WORK_PACKAGE = "WP-8.2";
// 320 px is the narrowest width NFR-A11Y-05 names; the rest are the screenshot widths.
const WIDTHS = [320, 375, 768, 1280];
// A dialog is saved at the window's size: a full-page capture paints its
// fixed backdrop as a band (e2e/screens.ts).
const DIALOG_WIDTHS = [375, 1280];

async function noSidewaysScroll(page: Page) {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBe(0);
}

for (const width of WIDTHS) {
  test(`[FR-PRF-01] [NFR-A11Y-05] a learner's profile with progress at ${String(width)} px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/dev/profile");
    await expect(page.getByRole("heading", { level: 1, name: profile.heading })).toBeVisible();
    await expect(page.getByText(profileGallery.sampleName, { exact: true })).toBeVisible();
    await expect(
      page.getByRole("heading", { level: 2, name: profile.coursesHeading }),
    ).toBeVisible();
    await expect(page.getByText(profile.empty)).toHaveCount(0);
    await noSidewaysScroll(page);
    await noAxeViolations(page);
    if (width !== 320)
      await saveScreen(page, "profile-filled", width, { workPackage: WORK_PACKAGE });
  });

  test(`[FR-PRF-01] [NFR-A11Y-05] a new learner's profile at ${String(width)} px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/dev/profile?state=empty");
    await expect(page.getByText(profile.empty)).toBeVisible();
    await expect(page.getByRole("link", { name: profile.coursesLink })).toBeVisible();
    await expect(page.getByRole("heading", { level: 2, name: profile.coursesHeading })).toHaveCount(
      0,
    );
    await noSidewaysScroll(page);
    await noAxeViolations(page);
    if (width !== 320)
      await saveScreen(page, "profile-empty", width, { workPackage: WORK_PACKAGE });
  });

  test(`[FR-PRF-02] [NFR-A11Y-05] a display name that cannot be saved says why at ${String(width)} px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/dev/profile");
    await page.getByRole("button", { name: profile.changeName }).click();
    const field = page.getByRole("textbox", { name: profile.nameLabel });
    await field.fill("");
    await page.getByRole("button", { name: profile.saveName }).click();
    await expect(field).toHaveAttribute("aria-invalid", "true");
    await expect(page.getByText(profile.nameProblem.empty)).toBeVisible();
    await noSidewaysScroll(page);
    await noAxeViolations(page);
    if (width !== 320) {
      await saveScreen(page, "profile-name-error", width, { workPackage: WORK_PACKAGE });
    }
  });
}

async function openDeletion(page: Page, width: number, deletion: string) {
  await page.setViewportSize({ width, height: 800 });
  await page.goto(`/dev/profile?deletion=${deletion}`);
  await page.getByRole("button", { name: profile.deleteAccount }).click();
  const dialog = page.getByRole("dialog", { name: profile.deleteTitle });
  await expect(dialog.getByText(profile.deleteWarning, { exact: true })).toBeVisible();
  return dialog;
}

for (const width of DIALOG_WIDTHS) {
  test(`[FR-PRF-03] the delete dialog, and a mistyped word, at ${String(width)} px`, async ({
    page,
  }) => {
    const dialog = await openDeletion(page, width, "succeeds");
    await noAxeViolations(page);
    await saveScreen(page, "profile-delete-dialog", width, {
      workPackage: WORK_PACKAGE,
      fullPage: false,
    });
    await dialog.getByRole("textbox", { name: profile.confirmLabel }).fill("delete");
    await dialog.getByRole("button", { name: profile.deleteAccount }).click();
    await expect(dialog.getByText(profile.confirmProblem, { exact: true })).toBeVisible();
    await noAxeViolations(page);
    await saveScreen(page, "profile-delete-mistyped", width, {
      workPackage: WORK_PACKAGE,
      fullPage: false,
    });
  });

  for (const { deletion, name, shows } of [
    { deletion: "hangs", name: "profile-deleting", shows: profile.deleting },
    { deletion: "succeeds", name: "profile-deleted", shows: profile.deleted },
    { deletion: "fails", name: "profile-delete-failed", shows: profile.deleteFailed },
  ]) {
    test(`[FR-PRF-03] the deletion state ${name} at ${String(width)} px`, async ({ page }) => {
      const dialog = await openDeletion(page, width, deletion);
      await dialog.getByRole("textbox", { name: profile.confirmLabel }).fill(profile.deleteWord);
      await dialog.getByRole("button", { name: profile.deleteAccount }).click();
      // A failure is a notice, which names its kind before the sentence.
      await expect(dialog).toContainText(shows);
      await noAxeViolations(page);
      await saveScreen(page, name, width, { workPackage: WORK_PACKAGE, fullPage: false });
    });
  }
}

// A profile that cannot be read ends on the shared error page with Try again
// (src/features/profile/components/profile-page.tsx; section 8). The
// development page that fails on purpose shows that same page.
for (const width of [375, 1280]) {
  test(`[FR-SYS-01] a profile that could not load shows the shared error page at ${String(width)} px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/dev/error");
    await expect(page.getByRole("heading", { level: 1, name: errorPage.heading })).toBeVisible();
    await expect(page.getByRole("button", { name: errorPage.retry })).toBeVisible();
    await noAxeViolations(page);
    await saveScreen(page, "profile-could-not-load", width, { workPackage: WORK_PACKAGE });
  });
}
