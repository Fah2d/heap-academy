import { beforeEach, describe, expect, it, vi } from "vitest";
import type * as DeleteAccount from "./delete-account";
import { deleteAccount } from "./actions";

// The action as the server runs it, through the real wrapper (T-01).

const mocks = vi.hoisted(() => ({
  identify: vi.fn(),
  getClaims: vi.fn(),
  deleteUser: vi.fn(),
}));
vi.mock("server-only", () => ({}));
vi.mock("@/infrastructure/actions/server-action", async () => {
  const { createActionFactory } = await import("@/infrastructure/actions/define-action");
  return {
    defineAction: createActionFactory({
      context: async () => ({
        requestId: "req-1" as never,
        identify: mocks.identify,
        isAdmin: async () => false,
        services: { db: { auth: { getClaims: mocks.getClaims } } },
      }),
      log: () => {},
      now: () => 0,
    }),
  };
});
vi.mock("./delete-account", async (original) => {
  const real = await original<typeof DeleteAccount>();
  return {
    ...real,
    deletionPorts: (claims: () => Promise<unknown>) => ({
      claims,
      deleteUser: mocks.deleteUser,
      notify: async () => "sent" as const,
      log: () => {},
      now: () => 60_000,
    }),
  };
});

beforeEach(() => {
  vi.clearAllMocks();
  mocks.identify.mockResolvedValue({ userId: "user-1", aal: "aal1" });
  mocks.getClaims.mockResolvedValue({
    data: { claims: { amr: [{ method: "otp", timestamp: 60 }] } },
  });
  mocks.deleteUser.mockResolvedValue("deleted");
});

describe("[FR-PRF-03] [T-01] the deleteAccount action", () => {
  it("deletes the signed-in caller, from the session's own claims", async () => {
    await expect(deleteAccount({ confirmation: "DELETE" })).resolves.toMatchObject({ ok: true });
    expect(mocks.deleteUser.mock.calls).toEqual([["user-1"]]);
  });

  it("refuses a caller who is not signed in", async () => {
    mocks.identify.mockResolvedValue(null);
    await expect(deleteAccount({ confirmation: "DELETE" })).resolves.toEqual({
      ok: false,
      error: "not_signed_in",
    });
    expect(mocks.deleteUser).not.toHaveBeenCalled();
  });

  it("refuses a request that names another user", async () => {
    await expect(deleteAccount({ confirmation: "DELETE", userId: "user-2" })).resolves.toEqual({
      ok: false,
      error: "invalid_input",
    });
    expect(mocks.deleteUser).not.toHaveBeenCalled();
  });

  it("refuses an old session", async () => {
    mocks.getClaims.mockResolvedValue({ data: { claims: { amr: [] } } });
    await expect(deleteAccount({ confirmation: "DELETE" })).resolves.toEqual({
      ok: false,
      error: "sign_in_again",
    });
    expect(mocks.deleteUser).not.toHaveBeenCalled();
  });
});
