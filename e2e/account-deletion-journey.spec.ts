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
// has the three account deletion variables, which CI's e2e job sets.
//
// A learner signs in, passes a lesson (a completion with its code) and names
// themselves, then deletes the account from the profile: a mistyped word is
// refused, "DELETE" is accepted. The browser ends signed out with nothing on
// the device, and every table in the public and auth schemas that names a
// user holds no row of theirs. Signing in again with the same address makes a
// new, empty account.
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
  const rows = sqlRows(`select c.table_schema || '.' || c.table_name,
  (xpath('/row/n/text()', query_to_xml(format(
    'select count(*) as n from %I.%I where user_id::text = %L',
    c.table_schema, c.table_name, '${userId}'), false, true, '')))[1]::text
from information_schema.columns c
join information_schema.tables t
  on t.table_schema = c.table_schema and t.table_name = c.table_name
where c.column_name = 'user_id' and c.table_schema in ('public', 'auth')
  and t.table_type = 'BASE TABLE'
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

test("[FR-PRF-03] [T-17] J-10: a learner deletes their account; no row of theirs is left in any table", async ({
  page,
  request,
}) => {
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

  // The dialog says what is erased and wants the word typed exactly.
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
  // Nothing of the account is left on the device.
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
