import { expect, type APIRequestContext, type Page } from "@playwright/test";
import { account, signIn } from "../src/messages/sign-in";

// Helpers for the journeys that sign in against the local stack (the `stack`
// project). The code comes from the stack's mail catcher.

const MAIL = "http://127.0.0.1:54324";

export async function latestCode(request: APIRequestContext, address: string): Promise<string> {
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

export async function requestCode(page: Page, address: string) {
  await page.getByRole("textbox", { name: signIn.emailLabel }).fill(address);
  // The send button stays enabled while the bot challenge runs, and a press
  // before its token arrives only says the check is needed. Turnstile writes
  // the token into this field when it has one; it loads from Cloudflare, so
  // it gets the same limit as the code email.
  await expect(page.locator('input[name="cf-turnstile-response"]')).toHaveValue(/.+/, {
    timeout: 15_000,
  });
  await page.getByRole("button", { name: signIn.sendCode }).click();
  await expect(page.getByText(signIn.codeSentTo(address))).toBeVisible();
}

/** Signs in with an email code from /sign-in, and waits for the header's Sign out. */
export async function signInWithCode(page: Page, request: APIRequestContext, address: string) {
  await page.goto("/sign-in");
  await requestCode(page, address);
  await page
    .getByRole("textbox", { name: signIn.codeLabel })
    .fill(await latestCode(request, address));
  await page.getByRole("button", { name: signIn.verify, exact: true }).click();
  await expect(page.getByRole("button", { name: account.signOut })).toBeVisible();
}
