import { expect, type Page, test } from "@playwright/test";
import { EXAMPLE_LESSON } from "../src/grader/example-lesson";
import { catalogCommon } from "../src/messages/catalog";
import { profile } from "../src/messages/profile";
import { account } from "../src/messages/sign-in";
import { sql, sqlRows } from "./admin-helpers";
import { noAxeViolations, passLesson, type Target } from "./journeys";
import { signInWithCode } from "./sign-in-helpers";
import { stackCourse } from "./stack-course";

// WP-7.4 part 2c: J-10 (delete my account), docs/spec/01-requirements.md
// section 2, FR-PRF-03 and T-17, on the production build against the local
// stack (the `stack` project). The delete control exists only when the server
// has the three account deletion variables, which CI's e2e job sets. To run it
// locally, export SUPABASE_SECRET_KEY (SECRET_KEY of `supabase status -o env`),
// DELETION_NOTICE_FROM and DELETION_NOTICE_TO (any two addresses) first.
//
// A learner signs in, passes a lesson (a completion with its code) and names
// themselves, then deletes the account from the profile: a mistyped word is
// refused, "DELETE" is accepted, in a 375 px wide window, where the dialog's
// buttons stack. The browser ends signed out with the device's completions
// cleared, and every table in the public and auth schemas with a `user_id`
// column holds no row of theirs. Signing in again with the same address makes
// a new, empty account.
//
// The auth server's audit log names a user inside a JSON payload, not by a
// `user_id` column. Whether deletion must erase it is the owner's open
// question (WP-6.3's account deletion description, owner action 2), so the
// journey counts those rows and reports the number as an annotation instead
// of asserting it.
//
// Not walked here: the "sign in again" answer to a session older than 5
// minutes. The server reads the sign-in time from the verified token, so the
// journey would have to wait 5 minutes; src/domain/auth/recent-sign-in.test.ts
// and the profile's action tests cover it.
test.describe.configure({ timeout: 240_000 });

const stamp = String(Date.now());
const course = stackCourse(
  `deletion-${stamp}`,
  `Deletion ${stamp}`,
  [{ slug: "only", title: EXAMPLE_LESSON.title }],
  "A course made by the account deletion journey.",
);
const [lesson] = course.lessons as [Target];
const address = `deletion-${stamp}@example.test`;
const displayName = `Leaving ${stamp}`;
const laptop = { phone: false };

/** The user ID behind the address, or none. */
function userIds(): string[][] {
  return sqlRows(`select id from auth.users where email = '${address}';`);
}

/**
 * Every table in the public and auth schemas with a `user_id` column, with
 * its count of rows for the user, in name order. Found from the catalog, so a
 * table added later is inspected without changing this journey.
 */
function rowsPerTable(userId: string): Map<string, number> {
  // From the system catalog rather than information_schema, which hides a
  // table the role holds no privilege on; such a table fails here instead.
  const rows = sqlRows(`select n.nspname || '.' || c.relname,
  (xpath('/row/n/text()', query_to_xml(format(
    'select count(*) as n from %I.%I where user_id::text = %L',
    n.nspname, c.relname, '${userId}'), false, true, '')))[1]::text
from pg_catalog.pg_attribute a
join pg_catalog.pg_class c on c.oid = a.attrelid
join pg_catalog.pg_namespace n on n.oid = c.relnamespace
where a.attname = 'user_id' and not a.attisdropped
  and c.relkind in ('r', 'p') and n.nspname in ('public', 'auth')
order by 1;`);
  return new Map(rows.map(([table = "", count = ""]) => [table, Number(count)]));
}

/** The user's sessions and their sign-in method records, which name a session, not a user. */
function sessionRows(sessionIds: readonly string[]): string[][] {
  const list = sessionIds.map((id) => `'${id}'`).join(", ");
  return sqlRows(`select 'sessions', count(*) from auth.sessions where id in (${list})
union all
select 'mfa_amr_claims', count(*) from auth.mfa_amr_claims where session_id in (${list});`);
}

/** Rows of the auth server's audit log that name the user or the address. */
function auditLogRows(userId: string): number {
  const [[count = ""] = []] = sqlRows(`select count(*) from auth.audit_log_entries
where payload ->> 'actor_id' = '${userId}' or payload::text like '%${address}%';`);
  return Number(count);
}

async function expectDeviceCount(page: Page, completed: number) {
  await page.goto(`/courses/${course.slug}`);
  await expect(page.getByText(catalogCommon.progress(completed, 1), { exact: true })).toBeVisible();
}

test.beforeAll(() => {
  course.write();
});

test.afterAll(() => {
  // The account made by signing in again, and the original if the journey
  // stopped before deleting it; profiles and completions cascade.
  sql(`delete from auth.users where email = '${address}';`);
  course.remove();
});

test("[FR-PRF-03] [T-17] J-10: a learner deletes their account; no table keeps a row with their user ID", async ({
  page,
  request,
}) => {
  await course.onSite(request);
  await signInWithCode(page, request, address);
  await passLesson(page, laptop, lesson);
  await page.goto("/profile");
  await page.getByRole("button", { name: profile.changeName }).click();
  await page.getByRole("textbox", { name: profile.nameLabel }).fill(displayName);
  await page.getByRole("button", { name: profile.saveName }).click();
  await expect(page.getByRole("button", { name: profile.changeName })).toBeVisible();
  await expect(page.getByText(displayName, { exact: true })).toBeVisible();

  const [[userId = ""] = []] = userIds();
  expect(userId).toMatch(/^[0-9a-f-]{36}$/);
  // The data that must go: the profile with its name, the completion with
  // its code, the sign-in identity, the session and its refresh token.
  await expect
    .poll(() => sqlRows(`select count(*) from public.completions where user_id = '${userId}';`), {
      timeout: 15_000,
    })
    .toEqual([["1"]]);
  const before = rowsPerTable(userId);
  for (const table of [
    "public.profiles",
    "public.completions",
    "auth.identities",
    "auth.sessions",
    "auth.refresh_tokens",
  ]) {
    expect(before.get(table), table).toBeGreaterThan(0);
  }
  expect(before.has("public.admins")).toBe(true);
  expect(
    sqlRows(`select count(*) from public.profiles where user_id = '${userId}'
      and display_name = '${displayName}';`),
  ).toEqual([["1"]]);
  const sessionIds = sqlRows(`select id from auth.sessions where user_id = '${userId}';`).map(
    ([id = ""]) => id,
  );
  expect(sessionIds.length).toBeGreaterThan(0);
  for (const [table = "", count = ""] of sessionRows(sessionIds)) {
    expect(Number(count), table).toBeGreaterThan(0);
  }

  // The dialog says what is erased and wants the word typed exactly. A phone
  // width, where its buttons stack.
  await page.setViewportSize({ width: 375, height: 740 });
  await page.goto("/profile");
  await page.getByRole("button", { name: profile.deleteAccount }).click();
  const dialog = page.getByRole("dialog", { name: profile.deleteTitle });
  await expect(dialog.getByText(profile.deleteWarning, { exact: true })).toBeVisible();
  await noAxeViolations(page);
  const confirmation = dialog.getByRole("textbox", { name: profile.confirmLabel });
  await confirmation.fill(profile.deleteWord.toLowerCase());
  await dialog.getByRole("button", { name: profile.deleteAccount }).click();
  await expect(dialog.getByText(profile.confirmProblem, { exact: true })).toBeVisible();
  expect(userIds()).toEqual([[userId]]);

  await confirmation.fill(profile.deleteWord);
  await dialog.getByRole("button", { name: profile.deleteAccount }).click();

  // The session ends: home, signed out, and the profile asks for a sign-in.
  await expect(page).toHaveURL(/\/$/, { timeout: 15_000 });
  await expect(page.getByRole("link", { name: account.signIn })).toBeVisible();
  await page.goto("/profile");
  await expect(page).toHaveURL(/\/sign-in\?returnTo=%2Fprofile$/);
  // The device's completions are cleared, as at sign-out.
  await expectDeviceCount(page, 0);

  // Every row is gone, in every table that names a user.
  expect(userIds()).toEqual([]);
  const after = rowsPerTable(userId);
  expect([...after.keys()]).toEqual([...before.keys()]);
  expect([...after].filter(([, count]) => count !== 0)).toEqual([]);
  expect(sessionRows(sessionIds)).toEqual([
    ["sessions", "0"],
    ["mfa_amr_claims", "0"],
  ]);
  expect(
    sqlRows(`select count(*) from auth.identities
      where identity_data ->> 'email' = '${address}';`),
  ).toEqual([["0"]]);
  test.info().annotations.push({
    type: "audit log rows naming the deleted user (owner decision open)",
    description: String(auditLogRows(userId)),
  });

  // The same address signs up again as a new account with nothing in it.
  await signInWithCode(page, request, address);
  const [[newId = ""] = []] = userIds();
  expect(newId).not.toBe("");
  expect(newId).not.toBe(userId);
  await expectDeviceCount(page, 0);
  await page.goto("/profile");
  await expect(page.getByRole("heading", { level: 1, name: profile.heading })).toBeVisible();
  await expect(page.getByText(displayName, { exact: true })).toHaveCount(0);
  await expect(page.getByRole("main").locator("dl dd").first()).toHaveText(profile.xpValue(0));
  await expect(page.getByText(profile.empty, { exact: true })).toBeVisible();
  expect(sqlRows(`select count(*) from public.completions where user_id = '${newId}';`)).toEqual([
    ["0"],
  ]);
});
