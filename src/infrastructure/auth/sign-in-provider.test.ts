import { describe, expect, it, vi } from "vitest";
import { type AuthApi, supabaseSignInProvider } from "./sign-in-provider";

vi.mock("server-only", () => ({}));

function fakeAuth(overrides: Partial<Record<keyof AuthApi, unknown>> = {}) {
  const ok = { data: {}, error: null };
  return {
    signInWithOtp: vi.fn(() => Promise.resolve(ok)),
    verifyOtp: vi.fn(() => Promise.resolve(ok)),
    signOut: vi.fn(() => Promise.resolve({ error: null })),
    signInWithOAuth: vi.fn(() =>
      Promise.resolve({
        data: { provider: "google", url: "https://auth.test/authorize" },
        error: null,
      }),
    ),
    exchangeCodeForSession: vi.fn(() => Promise.resolve(ok)),
    ...overrides,
  } as unknown as AuthApi & Record<keyof AuthApi, ReturnType<typeof vi.fn>>;
}

const failure = (code: string | undefined, status?: number) => () =>
  Promise.resolve({ data: { url: null }, error: { code, status, message: "ignored" } });

describe("supabaseSignInProvider", () => {
  it("[FR-AUTH-02] [FR-AUTH-06] [T-11] asks for a code with the challenge token, creating the account when new", async () => {
    const auth = fakeAuth();
    expect(await supabaseSignInProvider(auth).sendEmailCode("a@b.test", "token")).toBe("sent");
    expect(auth.signInWithOtp).toHaveBeenCalledWith({
      email: "a@b.test",
      options: { shouldCreateUser: true, captchaToken: "token" },
    });
  });

  it.each([
    ["over_email_send_rate_limit", 429, "rate_limited"],
    ["captcha_failed", 400, "challenge_failed"],
    [undefined, 500, "unavailable"],
  ])("[FR-AUTH-06] maps a send failure %s to %s", async (code, status, expected) => {
    const auth = fakeAuth({ signInWithOtp: failure(code, status) });
    expect(await supabaseSignInProvider(auth).sendEmailCode("a@b.test", "t")).toBe(expected);
  });

  it("[FR-AUTH-02] verifies the code as an email code", async () => {
    const auth = fakeAuth();
    expect(await supabaseSignInProvider(auth).verifyEmailCode("a@b.test", "123456")).toBe(
      "signed_in",
    );
    expect(auth.verifyOtp).toHaveBeenCalledWith({
      email: "a@b.test",
      token: "123456",
      type: "email",
    });
  });

  it("[FR-AUTH-02] an expired or wrong code is rejected", async () => {
    const auth = fakeAuth({ verifyOtp: failure("otp_expired", 403) });
    expect(await supabaseSignInProvider(auth).verifyEmailCode("a@b.test", "123456")).toBe(
      "code_rejected",
    );
  });

  it("[FR-AUTH-05] signs out this device only", async () => {
    const auth = fakeAuth();
    expect(await supabaseSignInProvider(auth).signOut()).toBe("signed_out");
    expect(auth.signOut).toHaveBeenCalledWith({ scope: "local" });
  });

  it("[FR-AUTH-01] starts Google with the callback and no browser redirect from the server", async () => {
    const auth = fakeAuth();
    expect(
      await supabaseSignInProvider(auth).startGoogle("https://heap.test/auth/callback"),
    ).toEqual({ ok: true, url: "https://auth.test/authorize" });
    expect(auth.signInWithOAuth).toHaveBeenCalledWith({
      provider: "google",
      options: { redirectTo: "https://heap.test/auth/callback", skipBrowserRedirect: true },
    });
  });

  it("[FR-AUTH-01] a failed Google start or exchange is reported, not thrown", async () => {
    const auth = fakeAuth({
      signInWithOAuth: failure(undefined, 500),
      exchangeCodeForSession: failure("flow_state_not_found", 404),
    });
    const provider = supabaseSignInProvider(auth);
    expect(await provider.startGoogle("https://heap.test/auth/callback")).toEqual({ ok: false });
    expect(await provider.completeGoogle("code")).toBe("failed");
  });
});
