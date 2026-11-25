import { describe, expect, it } from "vitest";
import { sendOutcome, signOutOutcome, verifyOutcome } from "./provider-outcomes";

describe("sendOutcome", () => {
  it.each([
    [null, "sent"],
    [{ code: "over_email_send_rate_limit", status: 429 }, "rate_limited"],
    [{ code: "over_request_rate_limit", status: 429 }, "rate_limited"],
    [{ status: 429 }, "rate_limited"],
    [{ code: "captcha_failed", status: 400 }, "challenge_failed"],
    [{ code: "otp_disabled", status: 422 }, "unavailable"],
    [{ code: "unexpected_failure", status: 500 }, "unavailable"],
    [{ status: 0 }, "unavailable"],
    [{}, "unavailable"],
  ] as const)("[FR-AUTH-02] [FR-AUTH-06] maps %j to %s", (error, expected) => {
    expect(sendOutcome(error)).toBe(expected);
  });
});

describe("verifyOutcome", () => {
  it.each([
    [null, "signed_in"],
    [{ code: "otp_expired", status: 403 }, "code_rejected"],
    [{ code: "invalid_credentials", status: 400 }, "code_rejected"],
    [{ code: "over_request_rate_limit", status: 429 }, "rate_limited"],
    [{ status: 429 }, "rate_limited"],
    [{ code: "unexpected_failure", status: 500 }, "unavailable"],
    [{}, "unavailable"],
  ] as const)("[FR-AUTH-02] [T-11] maps %j to %s", (error, expected) => {
    expect(verifyOutcome(error)).toBe(expected);
  });
});

describe("signOutOutcome", () => {
  it.each([
    [null, "signed_out"],
    [{ code: "session_not_found", status: 404 }, "signed_out"],
    [{ code: "session_expired", status: 403 }, "signed_out"],
    [{ code: "unexpected_failure", status: 500 }, "unavailable"],
  ] as const)("[FR-AUTH-05] maps %j to %s", (error, expected) => {
    expect(signOutOutcome(error)).toBe(expected);
  });
});
