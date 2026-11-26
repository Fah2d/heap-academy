import { describe, expect, it, vi } from "vitest";

// The root layout hands the invitation to save progress to a guest only
// (FR-AUTH-07): `isSignedIn` follows the visitor's verified identity.

vi.mock("server-only", () => ({}));

const identity = vi.hoisted(() => ({ value: null as unknown }));
vi.mock("@/infrastructure/auth/page-identity", () => ({
  pageIdentity: () => Promise.resolve(identity.value),
}));

const { isSignedIn } = await import("./viewer");

describe("isSignedIn", () => {
  it("[FR-AUTH-07] is false for a visitor with no verified identity", async () => {
    identity.value = null;
    expect(await isSignedIn()).toBe(false);
  });

  it("[FR-AUTH-07] is true for a visitor with a verified identity", async () => {
    identity.value = { userId: "00000000-0000-4000-8000-000000000001" };
    expect(await isSignedIn()).toBe(true);
  });
});
