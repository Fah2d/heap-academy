import AxeBuilder from "@axe-core/playwright";
import { expect, type Page, test } from "@playwright/test";
import { secondStep, dashboard } from "../src/messages/admin";
import { account } from "../src/messages/sign-in";
import { notFound } from "../src/messages/system";
import { accessToken, nextStep, PUBLISHABLE_KEY, sql, SUPABASE, totp } from "./admin-helpers";
import { saveScreen } from "./screens";
import { signInWithCode } from "./sign-in-helpers";

// J-12 against the local stack (WP-2.3; FR-ADM-01, FR-ADM-02, NFR-SEC-06,
// T-19, T-20). A learner gets the not-found page at every /admin address and
// cannot write content through the database interface; an admin before the
// second step is sent to setup or verify and cannot write either; after the
// code the session is at aal2 and the dashboard opens; repeated wrong codes
// are limited. The admin row is added the way the runbook adds it: by SQL,
// here through the stack's database container.

test.describe.configure({ mode: "serial" });

const ADMIN_ADDRESSES = ["/admin", "/admin/setup", "/admin/verify", "/admin/courses/anything"];

/** A direct write through the database interface with this page's session. */
async function directWrites(page: Page) {
  const headers = {
    apikey: PUBLISHABLE_KEY,
    authorization: `Bearer ${await accessToken(page)}`,
    "content-type": "application/json",
    prefer: "return=representation",
  };
  const insert = await page.request.post(`${SUPABASE}/rest/v1/courses`, {
    headers,
    data: { slug: `gate-${Date.now()}`, title: "Gate", summary: "Gate" },
  });
  const update = await page.request.patch(`${SUPABASE}/rest/v1/lessons?slug=eq.say-hello-by-name`, {
    headers,
    data: { title: "Changed by a stranger" },
  });
  return {
    insertStatus: insert.status(),
    updateStatus: update.status(),
    updated: update.ok() ? ((await update.json()) as unknown[]).length : 0,
  };
}

async function expectRefused(page: Page) {
  const result = await directWrites(page);
  expect([401, 403]).toContain(result.insertStatus);
  // Row level security hides every row from an update it does not allow.
  expect(result.updated).toBe(0);
}

async function expectNotFoundEverywhere(page: Page) {
  for (const address of ADMIN_ADDRESSES) {
    const response = await page.goto(address);
    expect(response?.status(), address).toBe(404);
    expect(response?.headers()["cache-control"], address).toContain("no-store");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(notFound.heading);
  }
}

test("[FR-ADM-01] [T-19] [T-20] a learner gets not-found at every /admin address and cannot write content", async ({
  page,
  request,
}) => {
  await signInWithCode(page, request, `learner-gate-${Date.now()}@example.test`);
  await expectNotFoundEverywhere(page);
  await expectRefused(page);
});

test("[FR-ADM-01] [FR-ADM-02] [NFR-SEC-06] [T-19] an admin passes setup, then verify in a new session", async ({
  page,
  request,
}) => {
  test.setTimeout(180_000);
  const address = `admin-gate-${Date.now()}@example.test`;
  await signInWithCode(page, request, address);
  sql(`insert into public.admins (user_id) select id from auth.users where email = '${address}'`);

  // On the list, with no app: every admin address leads to setup, the
  // course editor's too, before it reads its address.
  for (const start of ["/admin", "/admin/verify", "/admin/courses/anything"]) {
    await page.goto(start);
    await expect(page).toHaveURL(/\/admin\/setup$/);
  }
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(secondStep.setupTitle);
  // Rendering the page made no factor; the press does.
  await expect(page.getByRole("img", { name: secondStep.qrAlt })).toHaveCount(0);
  const setupResponse = await page.goto("/admin/setup");
  expect(setupResponse?.headers()["cache-control"]).toContain("no-store");
  await page.getByRole("button", { name: secondStep.start }).click();
  await expect(page.getByRole("img", { name: secondStep.qrAlt })).toBeVisible();
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await saveScreen(page, "admin-setup", 1280, { workPackage: "WP-2.3" });

  // At aal1 the database refuses every write.
  await expectRefused(page);

  const secret = (await page.locator("dd").innerText()).replace(/\s/g, "");
  const field = page.getByRole("textbox", { name: secondStep.codeLabel });
  const wrong = totp(secret) === "000000" ? "111111" : "000000";
  await field.fill(wrong);
  await page.getByRole("button", { name: secondStep.confirm }).click();
  await expect(page.getByRole("main").getByRole("alert")).toContainText(secondStep.codeRejected);
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await saveScreen(page, "admin-setup-code-rejected", 1280, { workPackage: "WP-2.3" });

  await field.fill(totp(secret));
  await page.getByRole("button", { name: secondStep.confirm }).click();
  await expect(page).toHaveURL(/\/admin$/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(dashboard.title);
  await expect(page.getByRole("rowheader", { name: "Sample course" })).toBeVisible();
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await saveScreen(page, "admin-dashboard", 1280, { workPackage: "WP-2.3" });

  // At aal2, setup and verify lead back to the dashboard.
  for (const stage of ["/admin/setup", "/admin/verify"]) {
    await page.goto(stage);
    await expect(page).toHaveURL(/\/admin$/);
  }

  // A new session starts at aal1 and is asked for a code.
  await page.getByRole("button", { name: account.signOut }).click();
  await page.waitForTimeout(61_000); // one code email a minute per address
  await signInWithCode(page, request, address);
  await page.goto("/admin");
  await expect(page).toHaveURL(/\/admin\/verify$/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(secondStep.verifyTitle);
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await saveScreen(page, "admin-verify", 1280, { workPackage: "WP-2.3" });
  await expectRefused(page);

  await nextStep(page);
  await page.getByRole("textbox", { name: secondStep.codeLabel }).fill(totp(secret));
  await page.getByRole("button", { name: secondStep.verify }).click();
  await expect(page).toHaveURL(/\/admin$/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(dashboard.title);

  sql(
    `delete from public.admins where user_id = (select id from auth.users where email = '${address}')`,
  );
});

// Last in the file: the provider's limit is counted per network address for a
// minute, and every request reaches it from the app server.
// The local stack does not apply the hosted MFA verify limit, so this check
// cannot pass in CI. Check it on staging before launch (follow-up to WP-2.3).
test.fixme("[T-19] repeated wrong codes are limited", async ({ page, request }) => {
  test.setTimeout(120_000);
  const address = `admin-limit-${Date.now()}@example.test`;
  await signInWithCode(page, request, address);
  sql(`insert into public.admins (user_id) select id from auth.users where email = '${address}'`);
  await page.goto("/admin/setup");
  await page.getByRole("button", { name: secondStep.start }).click();
  const secret = (await page.locator("dd").innerText()).replace(/\s/g, "");
  const field = page.getByRole("textbox", { name: secondStep.codeLabel });
  const button = page.getByRole("button", { name: secondStep.confirm });
  let limited = false;
  // 15 a minute with bursts up to 30 (Supabase "Rate limits", read 2026-11-21).
  for (let attempt = 0; attempt < 40 && !limited; attempt += 1) {
    await field.fill(totp(secret) === "000000" ? "111111" : "000000");
    const answered = page.waitForResponse(
      (response) =>
        response.request().method() === "POST" && response.url().endsWith("/admin/setup"),
    );
    await button.click();
    await answered;
    const alert = page.getByRole("main").getByRole("alert");
    await expect(alert).toBeVisible();
    limited = (await alert.innerText()).includes(secondStep.tooManyAttempts);
  }
  expect(limited).toBe(true);
  sql(
    `delete from public.admins where user_id = (select id from auth.users where email = '${address}')`,
  );
});
