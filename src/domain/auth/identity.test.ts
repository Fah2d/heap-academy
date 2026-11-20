import { describe, expect, it } from "vitest";
import { identityFromClaims, parseUserId } from "./identity";

const SUB = "0b6d1c2e-3f40-4a5b-8c6d-7e8f9a0b1c2d";

describe("identityFromClaims", () => {
  it("[FR-AUTH-01] [FR-AUTH-02] reads the user and the assurance level", () => {
    expect(identityFromClaims({ sub: SUB, role: "authenticated", aal: "aal1" })).toEqual({
      userId: SUB,
      aal: "aal1",
    });
    expect(identityFromClaims({ sub: SUB, role: "authenticated", aal: "aal2" })).toEqual({
      userId: SUB,
      aal: "aal2",
    });
  });

  it("[NFR-SEC-06] counts a missing or unknown assurance level as aal1", () => {
    expect(identityFromClaims({ sub: SUB, role: "authenticated" })?.aal).toBe("aal1");
    expect(identityFromClaims({ sub: SUB, role: "authenticated", aal: "AAL2" })?.aal).toBe("aal1");
    expect(identityFromClaims({ sub: SUB, role: "authenticated", aal: "aal3" })?.aal).toBe("aal1");
  });

  it.each([
    ["no claims", null],
    ["not an object", "token"],
    ["no subject", { role: "authenticated" }],
    ["a subject that is not a UUID", { sub: "admin", role: "authenticated" }],
    ["an upper-case subject", { sub: SUB.toUpperCase(), role: "authenticated" }],
    ["the anonymous role", { sub: SUB, role: "anon" }],
    ["the service role", { sub: SUB, role: "service_role" }],
    ["an anonymous session", { sub: SUB, role: "authenticated", is_anonymous: true }],
  ])("[FR-AUTH-05] treats %s as signed out", (_name, claims) => {
    expect(identityFromClaims(claims)).toBeNull();
  });
});

describe("parseUserId", () => {
  it("[FR-AUTH-05] accepts only a lower-case UUID", () => {
    expect(parseUserId(SUB)).toBe(SUB);
    expect(parseUserId(` ${SUB}`)).toBeUndefined();
    expect(parseUserId(42)).toBeUndefined();
  });
});
