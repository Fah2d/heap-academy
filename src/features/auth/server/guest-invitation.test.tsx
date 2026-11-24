import { isValidElement } from "react";
import { describe, expect, it, vi } from "vitest";

// A signed-in learner must not be told their progress is on this device only
// (FR-AUTH-07): the layout's invitation follows the verified identity.

vi.mock("server-only", () => ({}));

const identity = vi.hoisted(() => ({ value: null as unknown }));
vi.mock("@/infrastructure/auth/page-identity", () => ({
  pageIdentity: () => Promise.resolve(identity.value),
}));

const { guestInvitation } = await import("./guest-invitation");
const { SaveProgressInvitation } = await import("../components/save-progress-invitation");

describe("guestInvitation", () => {
  it("[FR-AUTH-07] is the invitation card for a guest", async () => {
    identity.value = null;
    const invitation = await guestInvitation();
    expect(isValidElement(invitation) && invitation.type).toBe(SaveProgressInvitation);
  });

  it("[FR-AUTH-07] is nothing for a signed-in learner", async () => {
    identity.value = { userId: "00000000-0000-4000-8000-000000000001" };
    expect(await guestInvitation()).toBeNull();
  });
});
