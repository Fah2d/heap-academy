import { describe, expect, it, vi } from "vitest";
import { completeGoogleSignIn, startGoogleSignIn } from "./google";

vi.mock("server-only", () => ({}));

describe("startGoogleSignIn", () => {
  it("[FR-AUTH-01] [FR-AUTH-04] asks for Google's address with this site's callback and keeps a safe return path", async () => {
    const startGoogle = vi.fn(() => Promise.resolve({ ok: true as const, url: "https://g.test" }));
    const result = await startGoogleSignIn({ returnTo: "//evil.example" }, "https://heap.test", {
      startGoogle,
    });
    expect(startGoogle).toHaveBeenCalledWith("https://heap.test/auth/callback");
    expect(result).toEqual({ ok: true, value: { url: "https://g.test", returnTo: "/courses" } });
  });

  it("[FR-AUTH-01] reports a provider that cannot start", async () => {
    const result = await startGoogleSignIn({}, "https://heap.test", {
      startGoogle: () => Promise.resolve({ ok: false }),
    });
    expect(result).toEqual({ ok: false, error: "unavailable" });
  });
});

describe("completeGoogleSignIn", () => {
  const signedIn = { completeGoogle: vi.fn(() => Promise.resolve("signed_in" as const)) };
  const failed = { completeGoogle: () => Promise.resolve("failed" as const) };

  it("[FR-AUTH-04] returns the learner to the kept page", async () => {
    expect(await completeGoogleSignIn({ code: "c" }, "/courses/python/1", signedIn)).toEqual({
      outcome: "signed_in",
      location: "/courses/python/1",
    });
  });

  it("[FR-AUTH-04] [T-11] never follows a kept path to another site", async () => {
    expect(await completeGoogleSignIn({ code: "c" }, "https://evil.example", signedIn)).toEqual({
      outcome: "signed_in",
      location: "/courses",
    });
  });

  it("[FR-AUTH-01] a refusal on Google's page, with no code, goes back to sign-in", async () => {
    const result = await completeGoogleSignIn({ code: null }, "/courses/x", failed);
    expect(result).toEqual({
      outcome: "failed",
      location: "/sign-in?failed=google&returnTo=%2Fcourses%2Fx",
    });
  });

  it("[FR-AUTH-01] a failed exchange goes back to sign-in", async () => {
    expect((await completeGoogleSignIn({ code: "c" }, undefined, failed)).outcome).toBe("failed");
  });
});
