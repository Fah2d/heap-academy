import { beforeEach, describe, expect, it, vi } from "vitest";
import { type Identity, parseUserId } from "@/domain/auth/identity";
import type { SecondStepProvider } from "@/infrastructure/auth/second-step";
import type { RequestId } from "@/infrastructure/http/request-id";

// The second-step actions through the real action wrapper (FR-ADM-01,
// FR-ADM-02, T-19, T-20): a guest is refused, a learner is answered as for a
// missing action and the provider is never called, an oversized input is
// refused, and only a caller on the admin list reaches the provider.

vi.mock("server-only", () => ({}));

const state = vi.hoisted(() => ({
  caller: null as Identity | null,
  onList: false,
  provider: {
    startEnrollment: vi.fn<SecondStepProvider["startEnrollment"]>(),
    confirmEnrollment: vi.fn<SecondStepProvider["confirmEnrollment"]>(),
    verify: vi.fn<SecondStepProvider["verify"]>(),
    hasVerifiedFactor: vi.fn<SecondStepProvider["hasVerifiedFactor"]>(),
  },
  rpc: vi.fn(),
}));

vi.mock("@/infrastructure/actions/server-action", async () => {
  const { createActionFactory } = await import("@/infrastructure/actions/define-action");
  return {
    defineAction: createActionFactory({
      context: () =>
        Promise.resolve({
          requestId: "00000000-0000-4000-8000-0000000000aa" as RequestId,
          identify: () => Promise.resolve(state.caller),
          isAdmin: () => Promise.resolve(false),
          count: () => Promise.resolve("allowed" as const),
          services: {
            db: {
              rpc: (name: string) => {
                state.rpc(name);
                return Promise.resolve({ data: state.onList, error: null });
              },
            },
            secondStep: state.provider,
          },
        }),
      log: () => undefined,
      now: () => 0,
    }),
  };
});

const { confirmSetup, startSetup, verifySecondStep } = await import("./actions");

const userId = parseUserId("00000000-0000-4000-8000-000000000002");
if (userId === undefined) throw new Error("fixture user ID is not a UUID");

beforeEach(() => {
  state.caller = null;
  state.onList = false;
  state.rpc.mockClear();
  for (const fn of Object.values(state.provider)) fn.mockReset();
  state.provider.startEnrollment.mockResolvedValue({
    ok: true,
    qrCodeSvg: "<svg/>",
    secret: "ABCD",
  });
  state.provider.confirmEnrollment.mockResolvedValue("verified");
  state.provider.verify.mockResolvedValue("verified");
});

const calls = [
  ["startSetup", () => startSetup({})],
  ["confirmSetup", () => confirmSetup({ code: "123456" })],
  ["verifySecondStep", () => verifySecondStep({ code: "123456" })],
] as const;

const providerCalls = () =>
  state.provider.startEnrollment.mock.calls.length +
  state.provider.confirmEnrollment.mock.calls.length +
  state.provider.verify.mock.calls.length;

describe("second-step actions [FR-ADM-02, T-19, T-20]", () => {
  it.each(calls)("%s refuses a guest without asking the database", async (_, call) => {
    expect(await call()).toEqual({ ok: false, error: "not_signed_in" });
    expect(state.rpc).not.toHaveBeenCalled();
    expect(providerCalls()).toBe(0);
  });

  it.each(calls)(
    "%s answers a learner not_found at either level, and never calls the provider",
    async (_, call) => {
      for (const aal of ["aal1", "aal2"] as const) {
        state.caller = { userId, aal };
        expect(await call()).toEqual({ ok: false, error: "not_found" });
      }
      expect(state.rpc).toHaveBeenCalledWith("is_on_admin_list");
      expect(providerCalls()).toBe(0);
    },
  );

  it("refuses an oversized or extra input before asking anyone", async () => {
    state.caller = { userId, aal: "aal1" };
    state.onList = true;
    expect(await verifySecondStep({ code: "1".repeat(10_000) })).toEqual({
      ok: false,
      error: "invalid_input",
    });
    expect(await startSetup({ factorId: "someone-else" })).toEqual({
      ok: false,
      error: "invalid_input",
    });
    expect(providerCalls()).toBe(0);
  });

  it("lets an admin on the list reach the provider for each step", async () => {
    state.caller = { userId, aal: "aal1" };
    state.onList = true;
    expect(await startSetup({})).toEqual({
      ok: true,
      value: { qrCodeSvg: "<svg/>", secret: "ABCD" },
    });
    expect(state.provider.startEnrollment).toHaveBeenCalledWith("Heap Academy");
    expect(await confirmSetup({ code: "123 456" })).toEqual({ ok: true, value: null });
    expect(state.provider.confirmEnrollment).toHaveBeenCalledWith("123456");
    state.provider.verify.mockResolvedValue("code_rejected");
    expect(await verifySecondStep({ code: "654321" })).toEqual({
      ok: false,
      error: "code_rejected",
    });
  });

  it("passes on a setup refusal", async () => {
    state.caller = { userId, aal: "aal1" };
    state.onList = true;
    state.provider.startEnrollment.mockResolvedValue({ ok: false, reason: "already_enrolled" });
    expect(await startSetup({})).toEqual({ ok: false, error: "already_enrolled" });
  });
});
