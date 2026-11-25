import AxeBuilder from "@axe-core/playwright";
import { expect, type APIRequestContext, type Page, test } from "@playwright/test";
import { account, signIn } from "../src/messages/sign-in";
import { saveScreen } from "./screens";

// The email code journey against the local stack and its mail catcher
// (WP-2.2; FR-AUTH-02, FR-AUTH-04, FR-AUTH-05, T-11). Runs in the `stack`
// project only, which the `e2e` job starts after `supabase start`. The bot
// challenge uses Cloudflare's published test keys, which always pass.

const MAIL = "http://127.0.0.1:54324";

async function latestCode(request: APIRequestContext, address: string): Promise<string> {
  let code = "";
  await expect
    .poll(
      async () => {
        const search = await request.get(
          `${MAIL}/api/v1/search?query=${encodeURIComponent(`to:"${address}"`)}`,
        );
        const found = (await search.json()) as { messages?: { ID: string }[] };
        const id = found.messages?.[0]?.ID;
        if (id === undefined) return "";
        const message = (await (await request.get(`${MAIL}/api/v1/message/${id}`)).json()) as {
          Text?: string;
        };
        code = /\b(\d{6})\b/.exec(message.Text ?? "")?.[1] ?? "";
        return code;
      },
      { message: `a code email to ${address}`, timeout: 15_000 },
    )
    .toMatch(/^\d{6}$/);
  return code;
}

// The body of a server action's response also holds the page rendered again,
// with this request's own nonce, so only the action's result can be compared.
function actionResult(body: string): string | undefined {
  const row = /^0:\{"a":"\$@(\w+)"/m.exec(body)?.[1];
  return row === undefined ? undefined : new RegExp(`^${row}:(.*)$`, "m").exec(body)?.[1];
}

async function requestCode(page: Page, address: string) {
  await page.getByRole("textbox", { name: signIn.emailLabel }).fill(address);
  // Turnstile puts its token here. A press before then only shows the
  // "wait for the check" notice.
  await expect(page.locator('input[name="cf-turnstile-response"]')).toHaveValue(/.+/, {
    timeout: 15_000,
  });
  await page.getByRole("button", { name: signIn.sendCode }).click();
  await expect(page.getByText(signIn.codeSentTo(address))).toBeVisible();
}

test("[FR-AUTH-02] [FR-AUTH-04] [FR-AUTH-05] signs in with an email code in one tab, returns, and signs out", async ({
  page,
  request,
}) => {
  const address = `learner-${Date.now()}@example.test`;
  await page.goto("/no-such-page");
  await page.getByRole("link", { name: account.signIn }).click();
  await expect(page).toHaveURL(/\/sign-in\?returnTo=%2Fno-such-page$/);

  await requestCode(page, address);
  const code = await latestCode(request, address);
  await page.getByRole("textbox", { name: signIn.codeLabel }).fill(code);
  await page.getByRole("button", { name: signIn.verify, exact: true }).click();

  await expect(page).toHaveURL(/\/no-such-page$/);
  await expect(page.getByRole("button", { name: account.signOut })).toBeVisible();

  await page.getByRole("button", { name: account.signOut }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole("link", { name: account.signIn })).toBeVisible();
});

test("[FR-AUTH-02] a wrong code is refused and the learner stays on the code step", async ({
  page,
  request,
}) => {
  const address = `wrong-${Date.now()}@example.test`;
  await page.goto("/sign-in");
  await requestCode(page, address);
  const code = await latestCode(request, address);
  const wrong = code === "000000" ? "111111" : "000000";
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await saveScreen(page, "sign-in-code", 1280, { workPackage: "WP-2.2" });
  await page.getByRole("textbox", { name: signIn.codeLabel }).fill(wrong);
  await page.getByRole("button", { name: signIn.verify, exact: true }).click();
  // Scoped to the step: Next.js's route announcer is an alert too.
  const step = page.getByRole("region", { name: signIn.codeHeading });
  await expect(step.getByRole("alert")).toContainText(signIn.codeRejected);
  await expect(page.getByRole("textbox", { name: signIn.codeLabel })).toBeVisible();
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await saveScreen(page, "sign-in-code-rejected", 1280, { workPackage: "WP-2.2" });
});

test("[T-11] the answer is the same for an address with an account and one without", async ({
  page,
  request,
}) => {
  // The provider sends at most one code a minute to one address.
  test.setTimeout(150_000);
  const known = `known-${Date.now()}@example.test`;
  await page.goto("/sign-in");
  await requestCode(page, known);
  await page
    .getByRole("textbox", { name: signIn.codeLabel })
    .fill(await latestCode(request, known));
  await page.getByRole("button", { name: signIn.verify, exact: true }).click();
  await page.getByRole("button", { name: account.signOut }).click();
  await page.waitForTimeout(61_000);

  const answers: { status: number; result: string | undefined }[] = [];
  for (const address of [known, `unknown-${Date.now()}@example.test`]) {
    await page.goto("/sign-in");
    const response = page.waitForResponse(
      (candidate) =>
        candidate.request().method() === "POST" && candidate.url().endsWith("/sign-in"),
    );
    await requestCode(page, address);
    const answer = await response;
    answers.push({ status: answer.status(), result: actionResult(await answer.text()) });
  }
  expect(answers[0]).toEqual({ status: 200, result: '{"ok":true,"value":null}' });
  expect(answers[1]).toEqual(answers[0]);
});
