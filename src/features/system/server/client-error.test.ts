import { describe, expect, it, vi } from "vitest";
import { createLogger, type LogEntry } from "@/infrastructure/logging/logger";
import { handleClientError, MAX_CLIENT_ERROR_BYTES } from "./client-error";

vi.mock("server-only", () => ({}));

const REQUEST_ID = "req_7f3a9c2e41b8";
const RELEASE = "0123456789abcdef0123456789abcdef01234567";

function post(
  body: BodyInit,
  contentType = "application/json",
  headers: Record<string, string> = {},
) {
  return new Request("https://heap.test/api/client-error", {
    method: "POST",
    body,
    headers: { "content-type": contentType, "x-request-id": REQUEST_ID, ...headers },
    // A stream body needs this in Node's Request.
    duplex: "half",
  } as RequestInit);
}

const report = (fields: Record<string, unknown> = {}) =>
  JSON.stringify({ code: "worker-crashed", route: "/courses/python/lessons/loops", ...fields });

const collect = () => {
  const entries: LogEntry[] = [];
  return { entries, log: (entry: LogEntry) => entries.push(entry) };
};

describe("client error reports", () => {
  it("[NFR-OBS-01] [NFR-OBS-02] logs the code under the request ID and the page's route pattern", async () => {
    const { entries, log } = collect();
    const response = await handleClientError(post(report()), log);
    expect(response.status).toBe(204);
    expect(entries).toEqual([
      {
        level: "error",
        requestId: REQUEST_ID,
        route: "GET /:param/:param/:param/:param",
        outcome: "client-error:worker-crashed",
      },
    ]);
  });

  it("[NFR-OBS-02] accepts each of the three codes and no other", async () => {
    for (const code of ["runtime-load-failed", "worker-crashed", "unexpected-exception"]) {
      const { entries, log } = collect();
      expect((await handleClientError(post(report({ code })), log)).status).toBe(204);
      expect(entries[0]?.outcome).toBe(`client-error:${code}`);
    }
    const { entries, log } = collect();
    const response = await handleClientError(post(report({ code: "ZeroDivisionError" })), log);
    expect(response.status).toBe(400);
    expect(entries).toEqual([]);
  });

  it("[NFR-PRIV-03] [T-16] refuses a report that carries any other field, such as an error message", async () => {
    const { entries, log } = collect();
    const response = await handleClientError(
      post(report({ message: "name 'ada@example.com' is not defined" })),
      log,
    );
    expect(response.status).toBe(400);
    expect(entries).toEqual([]);
  });

  it("[NFR-PRIV-03] [T-16] logs neither an email in the path nor its query", async () => {
    const lines: string[] = [];
    const log = createLogger({
      write: (line) => lines.push(line),
      now: () => new Date("2026-11-24T10:00:00.000Z"),
      release: RELEASE,
    });
    const response = await handleClientError(
      post(report({ route: "/ada@example.com/api?token=secret#print(1)" })),
      log,
    );
    expect(response.status).toBe(204);
    expect(lines).toHaveLength(1);
    expect(JSON.parse(lines[0] ?? "")).toEqual({
      time: "2026-11-24T10:00:00.000Z",
      release: RELEASE,
      level: "error",
      requestId: REQUEST_ID,
      route: "GET /:param/api",
      outcome: "client-error:worker-crashed",
    });
    expect(lines[0]).not.toMatch(/ada|example|token|secret|print/);
  });

  it("[NFR-OBS-01] writes none as the request ID when proxy.ts gave none", async () => {
    const { entries, log } = collect();
    await handleClientError(post(report(), "application/json", { "x-request-id": "" }), log);
    expect(entries[0]?.requestId).toBe("none");
  });

  it("[NFR-PRIV-03] refuses a route that is not a path, or is too long", async () => {
    const { entries, log } = collect();
    for (const route of ["courses", "https://elsewhere.test/", `/${"a".repeat(2048)}`, 7]) {
      expect((await handleClientError(post(report({ route })), log)).status).toBe(400);
    }
    expect(entries).toEqual([]);
  });

  it("[NFR-SEC-02] refuses a body over the size cap with 413, declared or streamed, and logs nothing", async () => {
    const { entries, log } = collect();
    const huge = report({ route: `/${"a".repeat(MAX_CLIENT_ERROR_BYTES)}` });
    expect((await handleClientError(post(huge), log)).status).toBe(413);

    const bytes = new TextEncoder().encode(huge);
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(bytes.slice(0, 4000));
        controller.enqueue(bytes.slice(4000));
        controller.close();
      },
    });
    expect((await handleClientError(post(stream), log)).status).toBe(413);
    expect(entries).toEqual([]);
  });

  it("[NFR-SEC-02] refuses another content type with 415", async () => {
    const response = await handleClientError(post(report(), "text/plain"), () => undefined);
    expect(response.status).toBe(415);
  });

  it("[NFR-SEC-02] refuses a body that is not JSON, or not an object, with 400", async () => {
    const { entries, log } = collect();
    for (const body of ["{", "[]", "null", '"worker-crashed"', ""]) {
      expect((await handleClientError(post(body), log)).status).toBe(400);
    }
    expect(entries).toEqual([]);
  });
});
