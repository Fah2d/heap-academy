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
    ["a dot segment before the slashes", "/.//evil.example"],
    ["a parent segment before the slashes", "/a/..//evil.example"],
    ["an encoded dot segment", "/%2e//evil.example"],
    ["encoded parent dots", "/%2E%2E//evil.example"],
    ["two parent segments", "/courses/../..//evil.example"],
    ["a parent segment out of sign-in", "/sign-in/.././/evil.example"],
    ["dot segments with a query and a fragment", "/././/evil.example/x?y#z"],
    ["a parent segment to the slashes", "/courses/..//evil.example"],
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

describe("safeReturnPath over every short combination", () => {
  // Every string of up to five of these pieces, after a leading slash. Each
  // result must stay on this site when a browser resolves it.
  const PIECES = ["/", ".", "..", "%2e", "%2E%2e", "evil.example", "a", "?", "#", "\\", "%5c"];

  function* combinations(length: number): Generator<string> {
    if (length === 0) {
      yield "";
      return;
    }
    for (const rest of combinations(length - 1)) for (const piece of PIECES) yield piece + rest;
  }

  it("[FR-AUTH-04] [T-11] never returns a path that leaves the site", () => {
    const site = "https://heapacademy.test";
    let checked = 0;
    for (let length = 1; length <= 5; length += 1) {
      for (const tail of combinations(length)) {
        const result = safeReturnPath(`/${tail}`);
        expect(result.startsWith("/")).toBe(true);
        expect(result.startsWith("//")).toBe(false);
        expect(new URL(result, `${site}/sign-in`).origin).toBe(site);
        checked += 1;
      }
    }
    expect(checked).toBe(11 + 11 ** 2 + 11 ** 3 + 11 ** 4 + 11 ** 5);
  });
});
