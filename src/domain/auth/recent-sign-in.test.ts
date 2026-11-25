import { describe, expect, it } from "vitest";
import { RECENT_SIGN_IN_MS, signedInRecently } from "./recent-sign-in";

const NOW = 1_800_000_000_000;
const at = (millisecondsAgo: number, method = "otp") => ({
  amr: [{ method, timestamp: (NOW - millisecondsAgo) / 1000 }],
});

describe("[FR-PRF-03] [T-01] a recent sign-in", () => {
  it.each(["otp", "oauth", "magiclink", "email/signup"])("accepts %s", (method) => {
    expect(signedInRecently(at(1000, method), NOW)).toBe(true);
  });

  it("ends five minutes after the sign-in", () => {
    expect(RECENT_SIGN_IN_MS).toBe(300_000);
    expect(signedInRecently(at(300_000), NOW)).toBe(true);
    expect(signedInRecently(at(301_000), NOW)).toBe(false);
  });

  it("does not count a token refresh or an unknown method", () => {
    expect(signedInRecently(at(0, "token_refresh"), NOW)).toBe(false);
    expect(signedInRecently(at(0, "anonymous"), NOW)).toBe(false);
  });

  it("does not let a newly verified factor renew an old sign-in", () => {
    const claims = { amr: [...at(3_600_000).amr, ...at(1000, "totp").amr] };
    expect(signedInRecently(claims, NOW)).toBe(false);
  });

  it("counts the newest qualifying entry among several", () => {
    const claims = { amr: [...at(3_600_000).amr, ...at(1000, "oauth").amr] };
    expect(signedInRecently(claims, NOW)).toBe(true);
  });

  it.each([
    null,
    "claims",
    {},
    { amr: "otp" },
    { amr: ["otp"] },
    { amr: [null] },
    { amr: [{ method: "otp" }] },
    { amr: [{ method: "otp", timestamp: "1800000000" }] },
  ])("refuses %j", (claims) => {
    expect(signedInRecently(claims, NOW)).toBe(false);
  });
});
