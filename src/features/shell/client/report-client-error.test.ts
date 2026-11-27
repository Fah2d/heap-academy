import { describe, expect, it, vi } from "vitest";
import { CLIENT_ERROR_PATH, createErrorReporter } from "./report-client-error";

const REQUEST_ID = "9b2f6c1e-4a7d-4e0b-8f3a-2d5c7e9a1b4f";
const RELEASE = "0123456789abcdef0123456789abcdef01234567";

function answer(status: number, headers: Record<string, string> = {}): Response {
  return new Response(status === 204 ? null : "", { status, headers });
}

describe("client error reporter", () => {
  it("[NFR-OBS-02] [NFR-PRIV-03] posts the code, the route and the bundle's release only, with no cookie", async () => {
    const send = vi.fn<typeof fetch>(() =>
      Promise.resolve(answer(204, { "x-request-id": REQUEST_ID })),
    );
    const report = createErrorReporter(send, RELEASE);
    const withExtra = { code: "worker-crashed", route: "/courses", message: "secret" } as const;
    await report(withExtra);
    expect(send).toHaveBeenCalledOnce();
    const [path, init] = send.mock.calls[0] ?? [];
    expect(path).toBe(CLIENT_ERROR_PATH);
    expect(init).toMatchObject({
      method: "POST",
      headers: { "content-type": "application/json" },
      credentials: "omit",
      keepalive: true,
    });
    expect(JSON.parse(String(init?.body))).toEqual({
      code: "worker-crashed",
      route: "/courses",
      release: RELEASE,
    });
  });

  it("[NFR-OBS-01] resolves to the request ID the server logged the report under", async () => {
    const report = createErrorReporter(
      () => Promise.resolve(answer(204, { "x-request-id": REQUEST_ID })),
      RELEASE,
    );
    expect(await report({ code: "unexpected-exception", route: "/" })).toBe(REQUEST_ID);
  });

  it("[NFR-OBS-01] resolves to no reference when the report was not stored", async () => {
    const cases: (() => Promise<Response>)[] = [
      () => Promise.resolve(answer(400, { "x-request-id": REQUEST_ID })),
      () => Promise.resolve(answer(204)),
      () => Promise.resolve(answer(204, { "x-request-id": "<b>not an id</b>" })),
      () => Promise.reject(new TypeError("Failed to fetch")),
    ];
    for (const send of cases) {
      const report = createErrorReporter(send, RELEASE);
      expect(await report({ code: "unexpected-exception", route: "/" })).toBeUndefined();
    }
  });
});
