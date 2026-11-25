import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  EnvironmentError,
  parseActionCounterKey,
  parseEnvironment,
  parsePublicEnvironment,
  publicEnvironmentSchema,
  serverEnvironmentSchema,
} from "./schema";

const valid = {
  NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:54321",
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_example",
  NEXT_PUBLIC_TURNSTILE_SITE_KEY: "1x00000000000000000000AA",
  RESEND_API_KEY: "re_example_not_a_real_key",
  ACTION_COUNTER_KEY: "local-only-action-counter-key-not-a-secret",
};

const publicNames = Object.keys(publicEnvironmentSchema.shape);
const serverNames = Object.keys(serverEnvironmentSchema.shape);

describe("environment schema", () => {
  it("[NFR-SEC-04] keeps every browser-visible variable in the public schema and no other", () => {
    expect(publicNames.length).toBeGreaterThan(0);
    for (const name of publicNames) expect(name.startsWith("NEXT_PUBLIC_")).toBe(true);
    for (const name of serverNames) expect(name.startsWith("NEXT_PUBLIC_")).toBe(false);
  });

  it("[FR-AUTH-06] accepts a Turnstile site key and refuses anything else", () => {
    expect(
      parsePublicEnvironment({
        ...valid,
        NEXT_PUBLIC_TURNSTILE_SITE_KEY: "0x4AAAAAAABkMYinukE8nzY",
      }).NEXT_PUBLIC_TURNSTILE_SITE_KEY,
    ).toBe("0x4AAAAAAABkMYinukE8nzY");
    expect(() =>
      parsePublicEnvironment({ ...valid, NEXT_PUBLIC_TURNSTILE_SITE_KEY: "secret value" }),
    ).toThrow(/NEXT_PUBLIC_TURNSTILE_SITE_KEY: must be a Turnstile site key/);
  });

  it("[NFR-SEC-04] parses a complete environment", () => {
    expect(parseEnvironment(valid)).toEqual({
      public: {
        NEXT_PUBLIC_SUPABASE_URL: valid.NEXT_PUBLIC_SUPABASE_URL,
        NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: valid.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
        NEXT_PUBLIC_TURNSTILE_SITE_KEY: valid.NEXT_PUBLIC_TURNSTILE_SITE_KEY,
      },
      server: {
        RESEND_API_KEY: valid.RESEND_API_KEY,
        ACTION_COUNTER_KEY: valid.ACTION_COUNTER_KEY,
        HEAP_RELEASE: "local",
      },
    });
  });

  it("[NFR-OBS-01] takes the release from the deploy, and refuses anything but a commit SHA", () => {
    const sha = "0123456789abcdef0123456789abcdef01234567";
    expect(parseEnvironment({ ...valid, HEAP_RELEASE: sha }).server.HEAP_RELEASE).toBe(sha);
    expect(() => parseEnvironment({ ...valid, HEAP_RELEASE: "v1; rm -rf" })).toThrow(
      /HEAP_RELEASE/,
    );
  });

  it("[NFR-SEC-04] stops with the name of a missing variable and not its value", () => {
    const { RESEND_API_KEY: _omitted, ...rest } = valid;
    expect(() => parseEnvironment(rest)).toThrow(EnvironmentError);
    expect(() => parseEnvironment(rest)).toThrow(/RESEND_API_KEY/);
  });

  it("[NFR-SEC-04] stops with the name of a malformed variable and does not echo its value", () => {
    const secretLooking = "not a url with a secret inside";
    const attempt = () => parseEnvironment({ ...valid, NEXT_PUBLIC_SUPABASE_URL: secretLooking });
    expect(attempt).toThrow(/NEXT_PUBLIC_SUPABASE_URL/);
    try {
      attempt();
    } catch (error) {
      expect(String(error)).not.toContain(secretLooking);
    }
  });

  it("[NFR-SEC-04] refuses a secret key where the publishable key belongs", () => {
    const attempt = () =>
      parsePublicEnvironment({ ...valid, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_secret_abc" });
    expect(attempt).toThrow(/NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: must be a publishable key/);
  });

  it("[NFR-SEC-04] accepts http only for the local stack", () => {
    expect(() =>
      parsePublicEnvironment({ ...valid, NEXT_PUBLIC_SUPABASE_URL: "http://example.supabase.co" }),
    ).toThrow(/must use https/);
    expect(
      parsePublicEnvironment({ ...valid, NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co" })
        .NEXT_PUBLIC_SUPABASE_URL,
    ).toBe("https://example.supabase.co");
  });

  it("[NFR-SEC-04] checks the public variables at build without needing server secrets", () => {
    const { RESEND_API_KEY: _omitted, ...publicOnly } = valid;
    expect(parsePublicEnvironment(publicOnly)).toEqual({
      NEXT_PUBLIC_SUPABASE_URL: valid.NEXT_PUBLIC_SUPABASE_URL,
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: valid.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
      NEXT_PUBLIC_TURNSTILE_SITE_KEY: valid.NEXT_PUBLIC_TURNSTILE_SITE_KEY,
    });
  });

  it("[T-14] needs an action counter key of at least 32 characters", () => {
    const { ACTION_COUNTER_KEY: _omitted, ...rest } = valid;
    expect(() => parseEnvironment(rest)).toThrow(/ACTION_COUNTER_KEY/);
    expect(() => parseEnvironment({ ...valid, ACTION_COUNTER_KEY: "x".repeat(31) })).toThrow(
      /ACTION_COUNTER_KEY: must be at least 32 characters/,
    );
    expect(parseActionCounterKey({ ACTION_COUNTER_KEY: "x".repeat(32) })).toBe("x".repeat(32));
    expect(() => parseActionCounterKey({ ACTION_COUNTER_KEY: "short" })).toThrow(
      /ACTION_COUNTER_KEY/,
    );
    expect(parseEnvironment({ ...valid, ACTION_COUNTER_KEY: "x".repeat(32) }).server).toMatchObject(
      { ACTION_COUNTER_KEY: "x".repeat(32) },
    );
  });

  it("[NFR-SEC-04] treats an empty value as missing", () => {
    expect(() => parseEnvironment({ ...valid, RESEND_API_KEY: "" })).toThrow(/RESEND_API_KEY/);
  });

  it("[NFR-SEC-04] .env.example documents exactly the declared variables, each with a description", () => {
    const example = readFileSync(join(process.cwd(), ".env.example"), "utf8");
    const lines = example.split("\n");
    const declared = lines
      .map((line, index) => ({ line, index }))
      .filter(({ line }) => /^[A-Z][A-Z0-9_]*=/.test(line));
    expect(declared.map(({ line }) => line.split("=")[0]).sort()).toEqual(
      [...publicNames, ...serverNames].sort(),
    );
    for (const { index } of declared) {
      expect(lines[index - 1]?.startsWith("# ")).toBe(true);
    }
  });
});
