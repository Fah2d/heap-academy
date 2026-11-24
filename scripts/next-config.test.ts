import { afterEach, describe, expect, it, vi } from "vitest";

// next.config.ts parses the release when it loads, so each case sets the
// environment first and loads a fresh copy.
async function loadConfig(release: string | undefined) {
  vi.resetModules();
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "http://127.0.0.1:54321");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "sb_publishable_example");
  vi.stubEnv("HEAP_RELEASE", release);
  const { default: config } = await import("../next.config");
  return config("phase-production-build");
}

describe("next.config", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("[NFR-OBS-01] inlines the deploy's release into server code and the browser bundle", async () => {
    const sha = "0123456789abcdef0123456789abcdef01234567";
    const { env } = await loadConfig(sha);
    expect(env).toEqual({ HEAP_RELEASE: sha, NEXT_PUBLIC_HEAP_RELEASE: sha });
  });

  it("[NFR-OBS-01] inlines local when the build has no release", async () => {
    const { env } = await loadConfig(undefined);
    expect(env).toEqual({ HEAP_RELEASE: "local", NEXT_PUBLIC_HEAP_RELEASE: "local" });
  });

  it("[NFR-OBS-01] fails the build on a release that is not a commit SHA", async () => {
    await expect(loadConfig("v1; rm -rf")).rejects.toThrow();
  });
});
