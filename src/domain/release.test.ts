import { describe, expect, it } from "vitest";
import { isRelease } from "./release";

describe("release", () => {
  it("[NFR-OBS-02] is a full commit SHA or local, and nothing else", () => {
    expect(isRelease("0123456789abcdef0123456789abcdef01234567")).toBe(true);
    expect(isRelease("local")).toBe(true);
    for (const value of [
      "0123456789abcdef",
      "0123456789ABCDEF0123456789ABCDEF01234567",
      "0123456789abcdef0123456789abcdef012345678",
      "local\n",
      "v1; rm -rf",
      "",
      40,
      undefined,
    ]) {
      expect(isRelease(value)).toBe(false);
    }
  });
});
