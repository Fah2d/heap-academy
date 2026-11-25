import { expect, test } from "@playwright/test";
import { notFound } from "../src/messages/system";

// J-12, the guest's half (WP-2.3; FR-ADM-01, T-19): every /admin address
// answers a visitor with no session exactly as a missing address does. The
// learner's and the admin's halves need the local stack:
// e2e/admin-gate-journey.spec.ts.
//
// The person sees the same page, title and status. The HTML is not the same
// byte for byte: Next.js renders a notFound() thrown by a layout as an error
// shell that the browser fills in (decision 1 in the WP-2.3 description).

const ADMIN_ADDRESSES = [
  "/admin",
  "/admin/setup",
  "/admin/verify",
  "/admin/courses/anything",
  "/admin/lessons/00000000-0000-4000-8000-000000000000",
  "/admin/lessons/00000000-0000-4000-8000-000000000000/preview",
];

test("[FR-ADM-01] [T-19] a guest gets the standard not-found page at every /admin address", async ({
  page,
}) => {
  const missing = await page.goto("/no-such-page");
  expect(missing?.status()).toBe(404);
  const missingTitle = await page.title();
  const missingMain = await page.getByRole("main").innerText();

  for (const address of ADMIN_ADDRESSES) {
    const response = await page.goto(address);
    expect(response?.status(), address).toBe(404);
    expect(page.url(), address).toMatch(new RegExp(`${address}$`));
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(notFound.heading);
    expect(await page.title(), address).toBe(missingTitle);
    expect(await page.getByRole("main").innerText(), address).toBe(missingMain);
  }
});
