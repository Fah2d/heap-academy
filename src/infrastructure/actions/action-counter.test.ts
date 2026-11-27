import { describe, expect, it, vi } from "vitest";
import {
  counterMinute,
  counterSignature,
  createActionCounter,
  type CountRpc,
} from "./action-counter";

vi.mock("server-only", () => ({}));

const KEY = "test-only-action-counter-key-0123456789";
const MINUTE = 29_000_000;
const NOW = MINUTE * 60_000 + 59_999;

describe("counterSignature", () => {
  it("[T-14] is the HMAC the database checks: 13_action_counters.test.sql pins the same value", () => {
    expect(counterSignature(KEY, "save-name", "203.0.113.7", 2, MINUTE)).toBe(
      "1d730e84c0983b8e4dc5427528c7fef2c23f124d96ecc7ad1707cdbdb724a89b",
    );
  });

  it("[T-14] changes with the action, the address, the limit, the minute and the key", () => {
    const base = counterSignature(KEY, "save-name", "203.0.113.7", 2, MINUTE);
    expect(counterSignature(KEY, "save-names", "203.0.113.7", 2, MINUTE)).not.toBe(base);
    expect(counterSignature(KEY, "save-name", "203.0.113.8", 2, MINUTE)).not.toBe(base);
    expect(counterSignature(KEY, "save-name", "203.0.113.7", 20, MINUTE)).not.toBe(base);
    expect(counterSignature(KEY, "save-name", "203.0.113.7", 2, MINUTE + 1)).not.toBe(base);
    expect(counterSignature(`${KEY}x`, "save-name", "203.0.113.7", 2, MINUTE)).not.toBe(base);
  });

  it("[T-14] names the minute by whole minutes since 1970", () => {
    expect(counterMinute(NOW)).toBe(MINUTE);
    expect(counterMinute(NOW + 1)).toBe(MINUTE + 1);
  });
});

describe("createActionCounter", () => {
  it("[T-14] sends the action, the address, the limit and their signature for this minute", async () => {
    const rpc = vi.fn<CountRpc>(async () => ({ data: true, error: null }));
    const count = createActionCounter(rpc, KEY, "203.0.113.7", () => NOW);

    await expect(count("save-name", 2)).resolves.toBe("allowed");
    expect(rpc).toHaveBeenCalledWith("count_action", {
      action_name: "save-name",
      client_address: "203.0.113.7",
      max_hits: 2,
      signature: "1d730e84c0983b8e4dc5427528c7fef2c23f124d96ecc7ad1707cdbdb724a89b",
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
