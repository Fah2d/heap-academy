import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { adminArea, dashboard, secondStep } from "../src/messages/admin";
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
