import { describe, expect, it } from "vitest";
import { parseLessonId } from "./ids";

describe("lesson IDs", () => {
  it("accepts a lower-case UUID and nothing else", () => {
    expect(parseLessonId("0b7e3f4a-5c6d-4e8f-9a0b-1c2d3e4f5a6b")).toBe(
      "0b7e3f4a-5c6d-4e8f-9a0b-1c2d3e4f5a6b",
    );
    for (const value of [
      "0B7E3F4A-5C6D-4E8F-9A0B-1C2D3E4F5A6B",
      "0b7e3f4a5c6d4e8f9a0b1c2d3e4f5a6b",
      " 0b7e3f4a-5c6d-4e8f-9a0b-1c2d3e4f5a6b",
      "",
      42,
      null,
      undefined,
    ]) {
      expect(parseLessonId(value)).toBeUndefined();
    }
  });
});
