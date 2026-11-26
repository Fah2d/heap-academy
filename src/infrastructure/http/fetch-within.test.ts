import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchWithin } from "./fetch-within";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("fetchWithin", () => {
  it("[FR-AUTH-05] passes a signal that aborts after the limit, and keeps the caller's own", async () => {
    const seen: AbortSignal[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn((_input: unknown, init?: RequestInit) => {
        if (init?.signal) seen.push(init.signal);
        return Promise.resolve(new Response("ok"));
      }),
    );
    const caller = new AbortController();
    await fetchWithin(10)("https://auth.test", { signal: caller.signal });
    caller.abort();
    expect(seen[0]?.aborted).toBe(true);
    await fetchWithin(10)("https://auth.test");
    await new Promise((resolve) => setTimeout(resolve, 30));
    expect(seen[1]?.aborted).toBe(true);
  });
});
