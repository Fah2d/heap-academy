import { describe, expect, it } from "vitest";
import { parseRequestId } from "./request-id";

describe("request ID shape", () => {
  it("[NFR-OBS-01] accepts the server's UUID and refuses markup, short and long values", () => {
    expect(parseRequestId("9b2f6c1e-4a7d-4e0b-8f3a-2d5c7e9a1b4f")).toBe(
      "9b2f6c1e-4a7d-4e0b-8f3a-2d5c7e9a1b4f",
    );
    expect(parseRequestId("<b>not an id</b>")).toBeUndefined();
    expect(parseRequestId("short")).toBeUndefined();
    expect(parseRequestId("x".repeat(65))).toBeUndefined();
    expect(parseRequestId(null)).toBeUndefined();
  });
});
