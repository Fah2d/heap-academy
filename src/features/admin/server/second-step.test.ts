import { describe, expect, it, vi } from "vitest";
import {
  confirmSetup,
  MAX_SECOND_STEP_BYTES,
  secondStepInput,
  verifySecondStep,
} from "./second-step";

vi.mock("server-only", () => ({}));

describe("second-step input [FR-ADM-02]", () => {
  it("accepts six digits, with spaces removed", () => {
    expect(secondStepInput.parse({ code: "123 456" })).toEqual({ code: "123456" });
  });

  it.each(["12345", "1234567", "12345a", "", "１２３４５６"])("refuses %j", (code) => {
    expect(secondStepInput.safeParse({ code }).success).toBe(false);
  });

  it("refuses extra fields, so the browser cannot name a factor", () => {
    expect(secondStepInput.safeParse({ code: "123456", factorId: "x" }).success).toBe(false);
  });

  it("allows the largest valid input within the byte limit", () => {
    const largest = JSON.stringify({ code: "\u0000".repeat(32) });
    expect(new TextEncoder().encode(largest).length).toBeLessThanOrEqual(MAX_SECOND_STEP_BYTES);
  });
});

describe("second-step use cases [FR-ADM-02, T-19]", () => {
  it("passes the code on and reports success", async () => {
    const confirmEnrollment = vi.fn(async () => "verified" as const);
    const verify = vi.fn(async () => "verified" as const);
    expect(await confirmSetup({ code: "123456" }, { confirmEnrollment })).toEqual({
      ok: true,
      value: null,
    });
    expect(await verifySecondStep({ code: "654321" }, { verify })).toEqual({
      ok: true,
      value: null,
    });
    expect(confirmEnrollment).toHaveBeenCalledWith("123456");
    expect(verify).toHaveBeenCalledWith("654321");
  });

  it.each(["code_rejected", "rate_limited", "setup_replaced", "unavailable"] as const)(
    "returns %s as a failure",
    async (outcome) => {
      expect(
        await confirmSetup({ code: "123456" }, { confirmEnrollment: async () => outcome }),
      ).toEqual({
        ok: false,
        error: outcome,
      });
      expect(await verifySecondStep({ code: "123456" }, { verify: async () => outcome })).toEqual({
        ok: false,
        error: outcome,
      });
    },
  );
});
