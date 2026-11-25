import { beforeEach, describe, expect, it, vi } from "vitest";
import { type Identity, parseUserId } from "@/domain/auth/identity";

// The server guard of every /admin layout and page (FR-ADM-01, FR-ADM-02,
// T-19): which response each visitor gets, with the database and the auth
// service faked.

vi.mock("server-only", () => ({}));

const state = vi.hoisted(() => ({
  identity: null as Identity | null,
  listAnswer: { data: false as unknown, error: null as unknown },
  hasVerifiedFactor: vi.fn<() => Promise<boolean | null>>(),
  rpc: vi.fn(),
}));

vi.mock("@/infrastructure/auth/page-identity", () => ({
  pageIdentity: () => Promise.resolve(state.identity),
}));
vi.mock("@/infrastructure/db/session-client", () => ({
  createSessionClient: () =>
    Promise.resolve({
      rpc: (name: string) => {
        state.rpc(name);
        return Promise.resolve(state.listAnswer);
      },
      auth: { mfa: {} },
    }),
}));
vi.mock("@/infrastructure/auth/second-step", () => ({
  supabaseSecondStep: () => ({ hasVerifiedFactor: state.hasVerifiedFactor }),
}));
vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("NOT_FOUND");
  },
  redirect: (path: string) => {
    throw new Error(`REDIRECT ${path}`);
  },
}));

const { adminGateDecision, requireAdminList, requireAdminStage } = await import("./gate");

const userId = parseUserId("00000000-0000-4000-8000-000000000002");
if (userId === undefined) throw new Error("fixture user ID is not a UUID");

function visitor(
  identity: Identity | null,
  onList: boolean,
  hasVerifiedFactor: boolean | null = true,
) {
  state.identity = identity;
  state.listAnswer = { data: onList, error: null };
  state.hasVerifiedFactor.mockResolvedValue(hasVerifiedFactor);
}

beforeEach(() => {
  state.rpc.mockClear();
  state.hasVerifiedFactor.mockReset();
});

describe("adminGateDecision [FR-ADM-01, FR-ADM-02, T-19]", () => {
  it("answers a guest not_found without asking the database", async () => {
    visitor(null, true);
    expect(await adminGateDecision()).toBe("not_found");
    expect(state.rpc).not.toHaveBeenCalled();
  });

  it("answers a learner not_found at either level, without asking for factors", async () => {
    for (const aal of ["aal1", "aal2"] as const) {
      visitor({ userId, aal }, false);
      expect(await adminGateDecision()).toBe("not_found");
    }
    expect(state.hasVerifiedFactor).not.toHaveBeenCalled();
  });

  it("answers not_found when the list check fails", async () => {
    visitor({ userId, aal: "aal2" }, true);
    state.listAnswer = { data: null, error: { code: "PGRST301" } };
    expect(await adminGateDecision()).toBe("not_found");
  });

  it("sends an admin with no app to setup, and one with an app to verify", async () => {
    visitor({ userId, aal: "aal1" }, true, false);
    expect(await adminGateDecision()).toBe("setup");
    visitor({ userId, aal: "aal1" }, true, true);
    expect(await adminGateDecision()).toBe("verify");
    visitor({ userId, aal: "aal1" }, true, null);
    expect(await adminGateDecision()).toBe("verify");
  });

  it("lets an admin at aal2 in without asking for factors", async () => {
    visitor({ userId, aal: "aal2" }, true);
    expect(await adminGateDecision()).toBe("allow");
    expect(state.hasVerifiedFactor).not.toHaveBeenCalled();
  });
});

describe("requireAdminStage and requireAdminList [FR-ADM-01, T-19]", () => {
  it("gives strangers the not-found response at every stage", async () => {
    visitor({ userId, aal: "aal2" }, false);
    await expect(requireAdminList()).rejects.toThrow("NOT_FOUND");
    for (const stage of ["allow", "setup", "verify"] as const) {
      await expect(requireAdminStage(stage)).rejects.toThrow("NOT_FOUND");
    }
  });

  it("sends an admin at aal1 from the dashboard and from setup to verify", async () => {
    visitor({ userId, aal: "aal1" }, true, true);
    await expect(requireAdminList()).resolves.toBeUndefined();
    await expect(requireAdminStage("allow")).rejects.toThrow("REDIRECT /admin/verify");
    await expect(requireAdminStage("setup")).rejects.toThrow("REDIRECT /admin/verify");
    await expect(requireAdminStage("verify")).resolves.toBeUndefined();
  });

  it("sends an admin with no app to setup", async () => {
    visitor({ userId, aal: "aal1" }, true, false);
    await expect(requireAdminStage("allow")).rejects.toThrow("REDIRECT /admin/setup");
    await expect(requireAdminStage("verify")).rejects.toThrow("REDIRECT /admin/setup");
  });

  it("sends an admin at aal2 from setup and verify to the dashboard", async () => {
    visitor({ userId, aal: "aal2" }, true);
    await expect(requireAdminStage("setup")).rejects.toThrow(/^REDIRECT \/admin$/);
    await expect(requireAdminStage("verify")).rejects.toThrow(/^REDIRECT \/admin$/);
    await expect(requireAdminStage("allow")).resolves.toBeUndefined();
  });
});
