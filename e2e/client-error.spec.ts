import { expect, test } from "@playwright/test";

// The client error report on the production build (NFR-OBS-01, NFR-OBS-02,
// NFR-PRIV-03, WP-7.3). The report is answered with the request ID that the
// server's log line carries, which the error page shows as the reference.
// The browser test sends it the way the reporter does, under the page's
// content security policy.

const PATH = "/api/client-error";
const REQUEST_ID = /^[A-Za-z0-9_-]{8,64}$/;

test("[NFR-OBS-01] [NFR-OBS-02] stores a report and answers with its request ID", async ({
  request,
}) => {
  const response = await request.post(PATH, {
    data: { code: "worker-crashed", route: "/courses/python" },
  });
  expect(response.status()).toBe(204);
  expect(response.headers()["x-request-id"]).toMatch(REQUEST_ID);
});

test("[NFR-PRIV-03] [T-16] refuses a report that carries a message", async ({ request }) => {
  const response = await request.post(PATH, {
    data: { code: "worker-crashed", route: "/", message: "name 'x' is not defined" },
  });
  expect(response.status()).toBe(400);
});

test("[T-14] refuses a body over 8 kB", async ({ request }) => {
  const response = await request.post(PATH, {
    data: { code: "worker-crashed", route: `/${"a".repeat(9000)}` },
  });
  expect(response.status()).toBe(413);
});

test("[NFR-OBS-01] a page can send a report under its content security policy", async ({
  page,
}) => {
  const violations: string[] = [];
  page.on("console", (message) => {
    if (/content security policy/i.test(message.text())) violations.push(message.text());
  });
  await page.goto("/no-such-page");
  const answer = await page.evaluate(async (path) => {
    const response = await fetch(path, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ code: "unexpected-exception", route: location.pathname }),
      credentials: "omit",
      keepalive: true,
    });
    return { status: response.status, reference: response.headers.get("x-request-id") };
  }, PATH);
  expect(answer.status).toBe(204);
  expect(answer.reference).toMatch(REQUEST_ID);
  expect(violations).toEqual([]);
});
