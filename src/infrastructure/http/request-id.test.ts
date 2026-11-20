import { describe, expect, it } from "vitest";
import { createRequestId, parseRequestId } from "./request-id";

describe("request ID", () => {
  it("[NFR-OBS-01] is a fresh, well-formed ID for every request", () => {
    const first = createRequestId();
    expect(parseRequestId(first)).toBe(first);
    expect(createRequestId()).not.toBe(first);
  });

  it("[NFR-OBS-01] accepts a well-formed ID and rejects anything else", () => {
    expect(parseRequestId("req_7f3a9c2e41b8")).toBe("req_7f3a9c2e41b8");
    expect(parseRequestId(null)).toBeUndefined();
    expect(parseRequestId(undefined)).toBeUndefined();
    expect(parseRequestId("<script>")).toBeUndefined();
    expect(parseRequestId("short")).toBeUndefined();
    expect(parseRequestId("x".repeat(65))).toBeUndefined();
  });
});
