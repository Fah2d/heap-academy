import { createHmac } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import { counterSignature, createActionCounter, type CountRpc } from "./action-counter";

vi.mock("server-only", () => ({}));

const KEY = "test-only-action-counter-key-0123456789";

describe("counterSignature", () => {
  it("[T-14] is the HMAC the database checks: SHA-256 over action, address and limit", () => {
    // The same value 13_action_counters.test.sql computes with pgcrypto.
    expect(counterSignature(KEY, "save-name", "203.0.113.7", 2)).toBe(
      createHmac("sha256", KEY).update("save-name\n203.0.113.7\n2").digest("hex"),
    );
  });

  it("[T-14] changes with the action, the address, the limit and the key", () => {
    const base = counterSignature(KEY, "save-name", "203.0.113.7", 2);
    expect(counterSignature(KEY, "save-names", "203.0.113.7", 2)).not.toBe(base);
    expect(counterSignature(KEY, "save-name", "203.0.113.8", 2)).not.toBe(base);
    expect(counterSignature(KEY, "save-name", "203.0.113.7", 20)).not.toBe(base);
    expect(counterSignature(`${KEY}x`, "save-name", "203.0.113.7", 2)).not.toBe(base);
    expect(base).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe("createActionCounter", () => {
  it("[T-14] sends the action, the address, the limit and their signature", async () => {
    const rpc = vi.fn<CountRpc>(async () => ({ data: true, error: null }));
    const count = createActionCounter(rpc, KEY, "203.0.113.7");

    await expect(count("save-name", 2)).resolves.toBe("allowed");
    expect(rpc).toHaveBeenCalledWith("count_action", {
      action_name: "save-name",
      client_address: "203.0.113.7",
      max_hits: 2,
      signature: counterSignature(KEY, "save-name", "203.0.113.7", 2),
    });
  });

  it("[T-14] reports a call over the limit as refused", async () => {
    const count = createActionCounter(async () => ({ data: false, error: null }), KEY, "x");
    await expect(count("save-name", 2)).resolves.toBe("refused");
  });

  it("[T-14] reports a failed or malformed answer as unavailable, never as allowed", async () => {
    const failed = createActionCounter(
      async () => ({ data: null, error: { code: "55000" } }),
      KEY,
      "x",
    );
    await expect(failed("save-name", 2)).resolves.toBe("unavailable");
    const odd = createActionCounter(async () => ({ data: "true", error: null }), KEY, "x");
    await expect(odd("save-name", 2)).resolves.toBe("unavailable");
  });
});
