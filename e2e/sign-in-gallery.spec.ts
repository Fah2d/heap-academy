import { expect, test, type Page } from "@playwright/test";
import { signInGallery } from "../src/messages/gallery";
import { signIn } from "../src/messages/sign-in";
import { noAxeViolations } from "./journeys";
import { saveScreen } from "./screens";

// The sign-in states that wait on the auth service (docs/spec/03-experience.md
// sections 5.4 and 8): sending, too many codes, the code step, checking, a
// code not accepted, and too many tries, on the development-only page
// /dev/sign-in, whose answers never reach a server (WP-8.1 design review, M2
// and m2). The journey that signs in for real is e2e/sign-in-journey.spec.ts.
// Runs in the `gallery` project, against the development server.

const WORK_PACKAGE = "WP-8.2";
const WIDTHS = [375, 768, 1280];

// The page is a development page inside the real layout, whose header does
// not mark Sign in as current at /dev/sign-in. So the screens are of the main
// region only; the real page's header is in WP-2.2's screens (WP-9.1 design
// review, m3).
const main = (page: Page) => page.getByRole("main");

async function sendCode(page: Page, width: number, query: string) {
  await page.setViewportSize({ width, height: 900 });
  await page.goto(`/dev/sign-in?${query}`);
  await page.getByRole("textbox", { name: signIn.emailLabel }).fill(signInGallery.sampleEmail);
  await page.getByRole("button", { name: signIn.sendCode }).click();
}

async function enterCode(page: Page) {
  const step = page.getByRole("region", { name: signIn.codeHeading });
  await step.getByRole("textbox", { name: signIn.codeLabel }).fill("123456");
  await step.getByRole("button", { name: signIn.verify, exact: true }).click();
  return step;
}

async function noSidewaysScroll(page: Page) {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBe(0);
}

for (const width of WIDTHS) {
  test(`[FR-AUTH-02] sending a code holds the button and says so at ${String(width)} px`, async ({
    page,
  }) => {
    await sendCode(page, width, "send=hangs");
    await expect(page.getByRole("button", { name: signIn.sending })).toBeDisabled();
    await noSidewaysScroll(page);
    await noAxeViolations(page);
    await saveScreen(page, "sign-in-sending", width, {
      workPackage: WORK_PACKAGE,
      element: main(page),
    });
  });

  test(`[FR-AUTH-02] too many codes asked for says so at ${String(width)} px`, async ({ page }) => {
    await sendCode(page, width, "send=limited");
    // Scoped to the email step: Next.js's route announcer is an alert too.
    const step = page.getByRole("region", { name: signIn.emailHeading });
    await expect(step.getByRole("alert")).toContainText(signIn.sendRateLimited);
    await noSidewaysScroll(page);
    await noAxeViolations(page);
    await saveScreen(page, "sign-in-too-many-codes", width, {
      workPackage: WORK_PACKAGE,
      element: main(page),
    });
  });

  test(`[FR-AUTH-02] the code step at ${String(width)} px`, async ({ page }) => {
    await sendCode(page, width, "send=sent");
    const step = page.getByRole("region", { name: signIn.codeHeading });
    await expect(step.getByRole("textbox", { name: signIn.codeLabel })).toBeFocused();
    await expect(step.getByText(signIn.codeSentTo(signInGallery.sampleEmail))).toBeVisible();
    await noSidewaysScroll(page);
    await noAxeViolations(page);
    await saveScreen(page, "sign-in-code-step", width, {
      workPackage: WORK_PACKAGE,
      element: main(page),
    });
  });

  test(`[FR-AUTH-02] checking a code holds the button and says so at ${String(width)} px`, async ({
    page,
  }) => {
    await sendCode(page, width, "send=sent&verify=hangs");
    const step = await enterCode(page);
    await expect(step.getByRole("button", { name: signIn.verifying })).toBeDisabled();
    await noAxeViolations(page);
    await saveScreen(page, "sign-in-verifying", width, {
      workPackage: WORK_PACKAGE,
      element: main(page),
    });
  });

  test(`[FR-AUTH-02] a code not accepted marks the field and says why at ${String(width)} px`, async ({
    page,
  }) => {
    await sendCode(page, width, "send=sent&verify=rejected");
    const step = await enterCode(page);
    const field = step.getByRole("textbox", { name: signIn.codeLabel });
    await expect(field).toHaveAttribute("aria-invalid", "true");
    await expect(step.getByRole("alert")).toContainText(signIn.codeRejected);
    await noAxeViolations(page);
    await saveScreen(page, "sign-in-code-rejected", width, {
      workPackage: WORK_PACKAGE,
      element: main(page),
    });
  });

  test(`[FR-AUTH-02] too many tries says so at ${String(width)} px`, async ({ page }) => {
    await sendCode(page, width, "send=sent&verify=limited");
    const step = await enterCode(page);
    await expect(step.getByRole("alert")).toContainText(signIn.tooManyAttempts);
    await noAxeViolations(page);
    await saveScreen(page, "sign-in-too-many-tries", width, {
      workPackage: WORK_PACKAGE,
      element: main(page),
    });
  });
}
