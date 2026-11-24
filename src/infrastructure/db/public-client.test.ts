import { afterEach, describe, expect, it, vi } from "vitest";

// The client of public pages carries no session (CLAUDE.md rule 9, T-21):
// whatever the request holds, it sends only the publishable key, so the
// cached answers are what an anonymous visitor may read.

vi.mock("server-only", () => ({}));
// Proof that the client never reads the request: these would throw.
vi.mock("next/headers", () => ({
  cookies: () => {
    throw new Error("the public client read the cookies");
  },
  headers: () => {
    throw new Error("the public client read the headers");
  },
}));

const { createPublicClient, publicDatabaseAddress } = await import("./public-client");

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("createPublicClient", () => {
  it("[T-21] sends the publishable key and no cookie or user token", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://project.supabase.test");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "sb_publishable_test");
    vi.stubEnv("NEXT_PUBLIC_TURNSTILE_SITE_KEY", "1x00000000000000000000AA");
    const sent: Headers[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
        sent.push(new Headers(input instanceof Request ? input.headers : init?.headers));
        return Promise.resolve(
          new Response("[]", { status: 200, headers: { "content-type": "application/json" } }),
        );
      }),
    );

    const { error } = await createPublicClient().from("courses").select("slug");

    expect(error).toBeNull();
    expect(sent).toHaveLength(1);
    const [headers] = sent as [Headers];
    expect(headers.get("apikey")).toBe("sb_publishable_test");
    expect(headers.get("cookie")).toBeNull();
    // No user token: the only bearer, if any, is the publishable key itself.
    const authorization = headers.get("authorization");
    expect(authorization === null || authorization === "Bearer sb_publishable_test").toBe(true);
  });
});

describe("publicDatabaseAddress", () => {
  it("is the database address the public client uses, read when called", () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://project.supabase.test");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "sb_publishable_test");
    vi.stubEnv("NEXT_PUBLIC_TURNSTILE_SITE_KEY", "1x00000000000000000000AA");
    expect(publicDatabaseAddress()).toBe("https://project.supabase.test");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "http://127.0.0.1:1");
    expect(publicDatabaseAddress()).toBe("http://127.0.0.1:1");
  });
});
