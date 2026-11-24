import { createHmac } from "node:crypto";
import { execFileSync } from "node:child_process";
import { expect, type APIRequestContext, type Page } from "@playwright/test";
import { secondStep } from "../src/messages/admin";
import { signInWithCode } from "./sign-in-helpers";

// Helpers of the admin journeys against the local stack: SQL through the
// stack's database container, the authenticator's code, the session's
// access token, and an admin who has passed the second step.

export const SUPABASE = "http://127.0.0.1:54321";
export const PUBLISHABLE_KEY = process.env["NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"] ?? "";
export function sql(statement: string) {
  execFileSync("docker", [
    "exec",
    "supabase_db_heap-academy",
    "psql",
    "-U",
    "postgres",
    "-v",
    "ON_ERROR_STOP=1",
    "-c",
    statement,
  ]);
}

/** RFC 6238 with the authenticator defaults: SHA-1, 30 seconds, six digits. */
export function totp(secret: string, at = Date.now()): string {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  let bits = "";
  for (const char of secret.replace(/=+$/, "").toUpperCase()) {
    bits += alphabet.indexOf(char).toString(2).padStart(5, "0");
  }
  const key = Buffer.from(bits.match(/.{8}/g)?.map((byte) => parseInt(byte, 2)) ?? []);
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(Math.floor(at / 30_000)));
  const digest = createHmac("sha1", key).update(counter).digest();
  const offset = (digest[digest.length - 1] ?? 0) & 0xf;
  return ((digest.readUInt32BE(offset) & 0x7fffffff) % 1_000_000).toString().padStart(6, "0");
}

/** Waits until the next 30-second step, so a code is never used twice. */
export async function nextStep(page: Page) {
  await page.waitForTimeout(30_000 - (Date.now() % 30_000) + 500);
}

/** The access token in the session cookie, which may be split into chunks. */
export async function accessToken(page: Page): Promise<string> {
  const cookies = (await page.context().cookies())
    .filter((cookie) => /^sb-.+-auth-token(\.\d+)?$/.test(cookie.name))
    .sort((a, b) => a.name.localeCompare(b.name, "en", { numeric: true }));
  const joined = cookies.map((cookie) => cookie.value).join("");
  const session = JSON.parse(
    Buffer.from(joined.replace(/^base64-/, ""), "base64url").toString("utf8"),
  ) as { access_token: string };
  return session.access_token;
}

/**
 * Signs in a new address, puts it on the admin list the way the runbook does,
 * and passes setup, so the page's session is at aal2 on the dashboard.
 */
export async function signInAsAdmin(
  page: Page,
  request: APIRequestContext,
  address: string,
): Promise<void> {
  await signInWithCode(page, request, address);
  sql(`insert into public.admins (user_id) select id from auth.users where email = '${address}'`);
  await page.goto("/admin/setup");
  await page.getByRole("button", { name: secondStep.start }).click();
  const secret = (await page.locator("dd").innerText()).replace(/\s/g, "");
  await page.getByRole("textbox", { name: secondStep.codeLabel }).fill(totp(secret));
  await page.getByRole("button", { name: secondStep.confirm }).click();
  await expect(page).toHaveURL(/\/admin$/);
}

/** Takes the address off the admin list again. */
export function removeAdmin(address: string): void {
  sql(
    `delete from public.admins where user_id = (select id from auth.users where email = '${address}')`,
  );
}
