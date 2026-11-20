import { describe, expect, it, vi } from "vitest";
import {
  type EmailCodeProvider,
  requestEmailCode,
  requestEmailCodeInput,
  signOut,
  signOutInput,
  verifyEmailCode,
  verifyEmailCodeInput,
} from "./email-code";

vi.mock("server-only", () => ({}));

function provider(overrides: Partial<EmailCodeProvider> = {}): EmailCodeProvider {
  return {
    sendEmailCode: vi.fn(async () => "sent" as const),
    verifyEmailCode: vi.fn(async () => "signed_in" as const),
    signOut: vi.fn(async () => "signed_out" as const),
    ...overrides,
  };
}

describe("requestEmailCodeInput", () => {
  it("[FR-AUTH-02] [FR-AUTH-06] accepts an email and a challenge token, trimming the email", () => {
    expect(
      requestEmailCodeInput.parse({ email: "  sara@example.com ", challengeToken: "token" }),
    ).toEqual({ email: "sara@example.com", challengeToken: "token" });
  });

  it.each([
    ["no challenge token", { email: "sara@example.com" }],
    ["an empty challenge token", { email: "sara@example.com", challengeToken: "" }],
    ["a long challenge token", { email: "sara@example.com", challengeToken: "t".repeat(2049) }],
    ["not an email", { email: "sara", challengeToken: "token" }],
    ["a long email", { email: `${"a".repeat(245)}@example.com`, challengeToken: "token" }],
    ["an unknown field", { email: "sara@example.com", challengeToken: "token", userId: "x" }],
  ])("[FR-AUTH-06] [NFR-SEC-06] refuses %s", (_name, input) => {
    expect(requestEmailCodeInput.safeParse(input).success).toBe(false);
  });
});

describe("verifyEmailCodeInput", () => {
  it("[FR-AUTH-02] accepts a pasted code with spaces", () => {
    expect(verifyEmailCodeInput.parse({ email: "sara@example.com", code: " 123 456 " })).toEqual({
      email: "sara@example.com",
      code: "123456",
    });
  });

  it.each(["12345", "1234567", "12345a", "١٢٣٤٥٦", ""])(
    "[FR-AUTH-02] refuses the code %j",
    (value) => {
      expect(
        verifyEmailCodeInput.safeParse({ email: "sara@example.com", code: value }).success,
      ).toBe(false);
    },
  );
});

describe("signOutInput", () => {
  it("[FR-AUTH-05] takes nothing", () => {
    expect(signOutInput.safeParse({}).success).toBe(true);
    expect(signOutInput.safeParse({ userId: "x" }).success).toBe(false);
  });
});

describe("requestEmailCode", () => {
  it("[FR-AUTH-06] passes the challenge token to the provider", async () => {
    const fake = provider();
    await requestEmailCode({ email: "sara@example.com", challengeToken: "token" }, fake);
    expect(fake.sendEmailCode).toHaveBeenCalledWith("sara@example.com", "token");
  });

  it("[T-11] answers the same for any address the provider accepts", async () => {
    const fake = provider();
    const known = await requestEmailCode({ email: "known@example.com", challengeToken: "t" }, fake);
    const unknown = await requestEmailCode({ email: "new@example.com", challengeToken: "t" }, fake);
    expect(known).toEqual({ ok: true, value: null });
    expect(unknown).toEqual(known);
  });

  it.each(["rate_limited", "challenge_failed", "unavailable"] as const)(
    "[FR-AUTH-02] returns %s from the provider",
    async (outcome) => {
      const fake = provider({ sendEmailCode: async () => outcome });
      await expect(
        requestEmailCode({ email: "sara@example.com", challengeToken: "t" }, fake),
      ).resolves.toEqual({ ok: false, error: outcome });
    },
  );
});

describe("verifyEmailCode", () => {
  it("[FR-AUTH-04] sends the learner back to the page they came from", async () => {
    await expect(
      verifyEmailCode(
        { email: "sara@example.com", code: "123456", returnTo: "/courses/python/lessons/hello" },
        provider(),
      ),
    ).resolves.toEqual({ ok: true, value: { returnTo: "/courses/python/lessons/hello" } });
  });

  it("[FR-AUTH-04] [T-11] never sends the learner to another site", async () => {
    await expect(
      verifyEmailCode(
        { email: "sara@example.com", code: "123456", returnTo: "//evil.example" },
        provider(),
      ),
    ).resolves.toEqual({ ok: true, value: { returnTo: "/courses" } });
    await expect(
      verifyEmailCode({ email: "sara@example.com", code: "123456" }, provider()),
    ).resolves.toEqual({ ok: true, value: { returnTo: "/courses" } });
  });

  it.each(["code_rejected", "rate_limited", "unavailable"] as const)(
    "[FR-AUTH-02] returns %s from the provider",
    async (outcome) => {
      const fake = provider({ verifyEmailCode: async () => outcome });
      await expect(
        verifyEmailCode({ email: "sara@example.com", code: "123456" }, fake),
      ).resolves.toEqual({ ok: false, error: outcome });
    },
  );
});

describe("signOut", () => {
  it("[FR-AUTH-05] ends the session", async () => {
    const fake = provider();
    await expect(signOut(fake)).resolves.toEqual({ ok: true, value: null });
    expect(fake.signOut).toHaveBeenCalledOnce();
  });

  it("[FR-AUTH-05] reports a provider that cannot be reached", async () => {
    await expect(signOut(provider({ signOut: async () => "unavailable" }))).resolves.toEqual({
      ok: false,
      error: "unavailable",
    });
  });
});
