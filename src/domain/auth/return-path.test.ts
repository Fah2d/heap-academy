import { describe, expect, it } from "vitest";
import { DEFAULT_RETURN_PATH, safeReturnPath } from "./return-path";

describe("safeReturnPath", () => {
  it.each([
    ["/courses", "/courses"],
    ["/courses/python-basics", "/courses/python-basics"],
    [
      "/courses/python-basics/lessons/say-hello?view=code#tests",
      "/courses/python-basics/lessons/say-hello?view=code#tests",
    ],
    ["/profile", "/profile"],
    ["/", "/"],
    ["/%2F%2Fevil.example", "/%2F%2Fevil.example"],
  ])("[FR-AUTH-04] keeps the same-site path %s", (input, expected) => {
    expect(safeReturnPath(input)).toBe(expected);
  });

  it.each([
    ["protocol-relative", "//evil.example"],
    ["protocol-relative with a path", "//evil.example/courses"],
    ["backslash after the slash", "/\\evil.example"],
    ["backslashes only", "\\\\evil.example"],
    ["a backslash later in the path", "/courses\\..\\..\\evil"],
    ["an absolute URL", "https://evil.example/courses"],
    ["a scheme without slashes", "javascript:alert(1)"],
    ["a data URL", "data:text/html,hi"],
    ["a tab the browser strips", "/\t/evil.example"],
    ["a newline the browser strips", "/\n/evil.example"],
    ["a carriage return", "/\r/evil.example"],
    ["a space before the slashes", " //evil.example"],
    ["a null byte", "/courses\u0000"],
    ["a delete character", "/courses\u007f"],
    ["no leading slash", "courses"],
    ["a dot path", "./courses"],
    ["empty", ""],
    ["three slashes", "///evil.example"],
  ])("[FR-AUTH-04] [T-11] refuses %s", (_name, input) => {
    expect(safeReturnPath(input)).toBe(DEFAULT_RETURN_PATH);
  });

  it("[FR-AUTH-04] falls back to the course list when there is no path", () => {
    expect(DEFAULT_RETURN_PATH).toBe("/courses");
    expect(safeReturnPath(null)).toBe("/courses");
    expect(safeReturnPath(undefined)).toBe("/courses");
  });

  it("[FR-AUTH-04] refuses a path longer than the limit", () => {
    expect(safeReturnPath(`/${"a".repeat(511)}`)).toBe(`/${"a".repeat(511)}`);
    expect(safeReturnPath(`/${"a".repeat(512)}`)).toBe("/courses");
  });

  it("[FR-AUTH-04] never sends the learner back into sign-in", () => {
    expect(safeReturnPath("/sign-in")).toBe("/courses");
    expect(safeReturnPath("/sign-in?next=/profile")).toBe("/courses");
    expect(safeReturnPath("/auth/callback?code=x")).toBe("/courses");
    expect(safeReturnPath("/sign-in-help")).toBe("/sign-in-help");
  });

  it("[FR-AUTH-04] resolves dot segments before it decides", () => {
    expect(safeReturnPath("/courses/../profile")).toBe("/profile");
    expect(safeReturnPath("/courses/../sign-in")).toBe("/courses");
  });
});
