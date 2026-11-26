import { expect, test, type Page } from "@playwright/test";

// The script policy is enforced and the page's own scripts run under it, in
// every engine (NFR-SEC-02, ADR-0028, WP-1.3). Runs in the chromium, firefox,
// and webkit projects. Needs a page: until WP-5.1 that is the not-found page,
// which the shell of WP-1.4 renders per request.

const PAGE = "/no-such-page";

/**
 * Collects every violation the page reports, from before its first script,
 * and counts the page's inline flight data scripts as they run.
 * The `securitypolicyviolation` event is the one signal all three engines
 * send; console text differs per engine and also carries warnings that are
 * not violations.
 */
async function watchPage(page: Page): Promise<() => Promise<string[]>> {
  // An init script runs in every document before the page's own scripts; the
  // policy does not apply to it.
  await page.addInitScript(() => {
    const seen: string[] = [];
    document.addEventListener("securitypolicyviolation", (event) => {
      seen.push(`${event.effectiveDirective} ${event.blockedURI}`);
    });
    // Each inline flight data script calls `self.__next_f.push(...)`. Next's
    // client entry empties that array and replaces `push` once it starts, so
    // the array cannot show that the scripts ran. This one counts every call,
    // before and after the replacement, and passes it on unchanged.
    const flight: unknown[] = [];
    let push: (...items: unknown[]) => unknown = Array.prototype.push.bind(flight);
    let flightPushes = 0;
    Object.defineProperty(flight, "push", {
      configurable: true,
      get:
        () =>
        (...items: unknown[]) => {
          flightPushes += 1;
          return push(...items);
        },
      set: (replacement: (...items: unknown[]) => unknown) => {
        push = replacement;
      },
    });
    Object.assign(window, {
      __violations: seen,
      __next_f: flight,
      __flightPushes: () => flightPushes,
    });
  });
  return () => page.evaluate(() => (window as unknown as { __violations: string[] }).__violations);
}

/**
 * The page's scripts have run: the inline flight data scripts pushed their
 * data, and the external client entry set `window.next`.
 */
async function scriptsRan(page: Page): Promise<void> {
  await page.waitForFunction(() => {
    const scope = window as unknown as {
      __flightPushes: () => number;
      next?: { version?: string };
    };
    return (
      document.readyState === "complete" &&
      scope.__flightPushes() > 0 &&
      typeof scope.next?.version === "string"
    );
  });
}

test("[NFR-SEC-02] the page runs its scripts with no policy violation", async ({ page }) => {
  const violations = await watchPage(page);
  const response = await page.goto(PAGE);
  expect(response?.headers()["content-security-policy"]).toMatch(/'nonce-[^']+'/);
  await scriptsRan(page);
  expect(await violations()).toEqual([]);
});

test("[NFR-SEC-02] an inline script without the nonce in the page is blocked", async ({ page }) => {
  // Markup injection: the server's HTML carries an inline script the nonce
  // does not cover. The response keeps its own headers, the policy included.
  // A script that the page's code creates is not tested: under
  // 'strict-dynamic' a script that is not parser-inserted matches the policy
  // (CSP3, section 6.7.3.3), so an engine that follows it lets such a script run.
  let injected = false;
  await page.route(`**${PAGE}`, async (route) => {
    const response = await route.fetch();
    const html = await response.text();
    injected = html.includes("</body>");
    const body = html.replace(
      "</body>",
      "<script>document.documentElement.dataset.injected = 'ran';</script></body>",
    );
    await route.fulfill({ response, body });
  });
  const violations = await watchPage(page);
  const response = await page.goto(PAGE);
  expect(injected).toBe(true);
  expect(response?.headers()["content-security-policy"]).toMatch(/'nonce-[^']+'/);
  // The page's own scripts still run beside the blocked one.
  await scriptsRan(page);
  await expect
    .poll(async () =>
      (await violations()).some(
        (entry) => entry.startsWith("script-src") && entry.endsWith(" inline"),
      ),
    )
    .toBe(true);
  expect(await page.locator("html").getAttribute("data-injected")).toBeNull();
});

// The proxy sets the page policy. A path that only starts with one of its
// exclusions, and /favicon.ico while there is no icon (ADR-0031), render the
// not-found page and must carry the policy and its nonce like any page.
test("[T-15] paths near the proxy's exclusions carry the page policy", async ({ request }) => {
  for (const path of ["/favicon.ico", "/favicon.icoX", "/_next/imageX", "/_next/staticX"]) {
    const response = await request.get(path);
    expect(response.status(), path).toBe(404);
    expect(response.headers()["content-security-policy"], path).toMatch(/'nonce-[^']+'/);
    expect(response.headers()["content-security-policy"], path).toContain("frame-ancestors 'none'");
  }
});
