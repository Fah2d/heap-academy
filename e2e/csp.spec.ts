import { expect, test, type Page } from "@playwright/test";

// The script policy is enforced and the page's own scripts run under it, in
// every engine (NFR-SEC-02, ADR-0028, WP-1.3). Runs in the chromium, firefox,
// and webkit projects. Needs a page: until WP-5.1 that is the not-found page,
// which the shell of WP-1.4 renders per request.

const PAGE = "/no-such-page";

/**
 * Collects every violation the page reports, from before its first script.
 * The `securitypolicyviolation` event is the one signal all three engines
 * send; console text differs per engine and also carries warnings that are
 * not violations.
 */
async function watchViolations(page: Page): Promise<() => Promise<string[]>> {
  // An init script runs in every document before the page's own scripts; the
  // policy does not apply to it.
  await page.addInitScript(() => {
    const seen: string[] = [];
    Object.assign(window, { __violations: seen });
    document.addEventListener("securitypolicyviolation", (event) => {
      seen.push(`${event.effectiveDirective} ${event.blockedURI}`);
    });
  });
  return () => page.evaluate(() => (window as unknown as { __violations: string[] }).__violations);
}

/**
 * The page's scripts have run: the inline flight data scripts filled
 * `__next_f`, and the external client entry set `window.next`.
 */
async function scriptsRan(page: Page): Promise<void> {
  await page.waitForFunction(() => {
    const scope = window as unknown as { __next_f?: unknown[]; next?: { version?: string } };
    return (
      document.readyState === "complete" &&
      Array.isArray(scope.__next_f) &&
      scope.__next_f.length > 0 &&
      typeof scope.next?.version === "string"
    );
  });
}

test("[NFR-SEC-02] the page runs its scripts with no policy violation", async ({ page }) => {
  const violations = await watchViolations(page);
  const response = await page.goto(PAGE);
  expect(response?.headers()["content-security-policy"]).toMatch(/'nonce-[^']+'/);
  await scriptsRan(page);
  expect(await violations()).toEqual([]);
});

test("[NFR-SEC-02] an injected inline script is blocked", async ({ page }) => {
  const violations = await watchViolations(page);
  await page.goto(PAGE);
  await page.evaluate(() => {
    const script = document.createElement("script");
    script.textContent = "document.documentElement.dataset.injected = 'ran';";
    document.body.append(script);
  });
  await expect
    .poll(async () => (await violations()).some((entry) => entry.startsWith("script-src")))
    .toBe(true);
  expect(await page.locator("html").getAttribute("data-injected")).toBeNull();
});
