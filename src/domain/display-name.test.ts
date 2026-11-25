import { describe, expect, it } from "vitest";
import { parseDisplayName } from "./display-name";

describe("[FR-PRF-02] the display name", () => {
  it.each(["Sam", "سامي", "A", "x".repeat(40), "🐍".repeat(40)])("takes %j", (name) => {
    expect(parseDisplayName(name)).toEqual({ ok: true, value: name });
  });

  it("trims the ends", () => {
    expect(parseDisplayName("  Sam Lee  ")).toEqual({ ok: true, value: "Sam Lee" });
  });

  it.each([
    ["", "empty"],
    ["   ", "empty"],
    ["x".repeat(41), "too_long"],
    ["Sam\nLee", "not_allowed"],
    ["a\u061Cb", "not_allowed"],
    ["a\u200Eb", "not_allowed"],
    ["a\u2066b", "not_allowed"],
    ["a\u2069b", "not_allowed"],
    ["a\u2028b", "not_allowed"],
    ["a\u2029b", "not_allowed"],
    ["\u3164", "not_allowed"],
    ["\u115F", "not_allowed"],
    ["\u2800", "not_allowed"],
    ["Sam\u0000", "not_allowed"],
    ["\u202Egnp.exe", "not_allowed"],
    ["\u200B\u200B", "not_allowed"],
  ])("[T-07] refuses %j as %s", (name, problem) => {
    expect(parseDisplayName(name)).toEqual({ ok: false, problem });
  });
});
