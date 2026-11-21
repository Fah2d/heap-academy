import { describe, expect, it } from "vitest";
import { type Identity, parseUserId } from "@/domain/auth/identity";
import { ADMIN_PATHS, decideAdminGate } from "./gate";

const userId = parseUserId("00000000-0000-4000-8000-000000000002");
if (userId === undefined) throw new Error("fixture user ID is not a UUID");
const at = (aal: Identity["aal"]): Identity => ({ userId, aal });

describe("decideAdminGate [FR-ADM-01, FR-ADM-02, T-19]", () => {
  it("sends a guest to the not-found page, whatever else is known", () => {
    for (const hasVerifiedFactor of [true, false, null]) {
      for (const onAdminList of [true, false]) {
        expect(decideAdminGate({ identity: null, onAdminList, hasVerifiedFactor })).toBe(
          "not_found",
        );
      }
    }
  });

  it("sends a learner who is not on the list to the not-found page at either level", () => {
    for (const aal of ["aal1", "aal2"] as const) {
      for (const hasVerifiedFactor of [true, false, null]) {
        expect(decideAdminGate({ identity: at(aal), onAdminList: false, hasVerifiedFactor })).toBe(
          "not_found",
        );
      }
    }
  });

  it("sends an admin with no authenticator app to setup", () => {
    expect(
      decideAdminGate({ identity: at("aal1"), onAdminList: true, hasVerifiedFactor: false }),
    ).toBe("setup");
  });

  it("sends an admin at aal1 with an app to verify", () => {
    expect(
      decideAdminGate({ identity: at("aal1"), onAdminList: true, hasVerifiedFactor: true }),
    ).toBe("verify");
  });

  it("never offers setup when the auth service could not say whether an app exists", () => {
    expect(
      decideAdminGate({ identity: at("aal1"), onAdminList: true, hasVerifiedFactor: null }),
    ).toBe("verify");
  });

  it("lets an admin at aal2 in", () => {
    for (const hasVerifiedFactor of [true, false, null]) {
      expect(decideAdminGate({ identity: at("aal2"), onAdminList: true, hasVerifiedFactor })).toBe(
        "allow",
      );
    }
  });

  it("names one address for each decision that lets the visitor in", () => {
    expect(ADMIN_PATHS).toEqual({
      allow: "/admin",
      setup: "/admin/setup",
      verify: "/admin/verify",
    });
  });
});
