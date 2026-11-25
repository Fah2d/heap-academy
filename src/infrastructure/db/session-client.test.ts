import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const created = vi.hoisted(() => [] as { options: Record<string, unknown> }[]);
vi.mock("@supabase/ssr", () => ({
  createServerClient: (_url: string, _key: string, options: Record<string, unknown>) => {
    created.push({ options });
    return {};
  },
}));
const set = vi.hoisted(() => vi.fn());
vi.mock("next/headers", () => ({
  cookies: () => Promise.resolve({ getAll: () => [], set }),
}));

const { createSessionClient } = await import("./session-client");

afterEach(() => {
  created.length = 0;
  set.mockClear();
  vi.unstubAllEnvs();
});

function environment() {
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://project.supabase.test");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "sb_publishable_test");
  vi.stubEnv("NEXT_PUBLIC_TURNSTILE_SITE_KEY", "1x00000000000000000000AA");
}

type CookieOptions = {
  global?: { fetch?: unknown };
  cookies: { setAll: (list: { name: string; value: string; options: object }[]) => void };
};

describe("createSessionClient", () => {
  it("[FR-AUTH-05] a page's client gives up on a slow auth service and never sets cookies", async () => {
    environment();
    await createSessionClient("read-only");
    const options = created[0]?.options as CookieOptions;
    expect(typeof options.global?.fetch).toBe("function");
    options.cookies.setAll([{ name: "sb-x-auth-token", value: "v", options: {} }]);
    expect(set).not.toHaveBeenCalled();
  });

  it("[FR-AUTH-05] an action's client sets the cookies the provider writes", async () => {
    environment();
    await createSessionClient("read-write");
    const options = created[0]?.options as CookieOptions;
    expect(options.global).toBeUndefined();
    options.cookies.setAll([{ name: "sb-x-auth-token", value: "v", options: { path: "/" } }]);
    expect(set).toHaveBeenCalledWith("sb-x-auth-token", "v", { path: "/" });
  });
});
