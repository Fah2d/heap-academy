import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { RequestId } from "@/infrastructure/http/request-id";
import {
  accountDeletionAvailable,
  deleteAccount,
  deleteAccountInput,
  deletionPorts,
  type DeletionPorts,
  MAX_DELETE_BYTES,
} from "./delete-account";

const mocks = vi.hoisted(() => ({ createClient: vi.fn(), deleteUser: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@supabase/supabase-js", () => ({ createClient: mocks.createClient }));

const NOW = 1_800_000_000_000;
const requestId = "req-1" as RequestId;

const defaults = () => ({
  claims: vi.fn<DeletionPorts["claims"]>(async () => ({
    amr: [{ method: "otp", timestamp: NOW / 1000 - 10 }],
  })),
  deleteUser: vi.fn<DeletionPorts["deleteUser"]>(async () => "deleted"),
  notify: vi.fn<DeletionPorts["notify"]>(async () => "sent"),
  log: vi.fn<DeletionPorts["log"]>(),
  now: () => NOW,
});
const ports = (over: Partial<ReturnType<typeof defaults>> = {}) => ({ ...defaults(), ...over });

beforeEach(() => {
  vi.clearAllMocks();
  mocks.createClient.mockReturnValue({ auth: { admin: { deleteUser: mocks.deleteUser } } });
});
afterEach(() => vi.unstubAllEnvs());

describe("[FR-PRF-03] [J-10] deleting an account", () => {
  it("deletes the caller and then tells the owner", async () => {
    const used = ports();
    await expect(deleteAccount("user-1", requestId, used)).resolves.toEqual({
      ok: true,
      value: null,
    });
    expect(used.deleteUser.mock.calls).toEqual([["user-1"]]);
    expect(used.notify.mock.calls).toEqual([["user-1"]]);
    expect(used.log).not.toHaveBeenCalled();
  });

  it("[T-01] deletes nothing for an old session", async () => {
    const used = ports({
      claims: vi.fn<DeletionPorts["claims"]>(async () => ({
        amr: [{ method: "otp", timestamp: NOW / 1000 - 3600 }],
      })),
    });
    await expect(deleteAccount("user-1", requestId, used)).resolves.toEqual({
      ok: false,
      error: "sign_in_again",
    });
    expect(used.deleteUser).not.toHaveBeenCalled();
    expect(used.notify).not.toHaveBeenCalled();
  });

  it("deletes nothing when the claims cannot be read", async () => {
    const used = ports({ claims: vi.fn<DeletionPorts["claims"]>(async () => undefined) });
    await expect(deleteAccount("user-1", requestId, used)).resolves.toEqual({
      ok: false,
      error: "unavailable",
    });
    expect(used.deleteUser).not.toHaveBeenCalled();
  });

  it("sends no notice when the deletion fails", async () => {
    const used = ports({
      deleteUser: vi.fn<DeletionPorts["deleteUser"]>(async () => "unavailable"),
    });
    await expect(deleteAccount("user-1", requestId, used)).resolves.toEqual({
      ok: false,
      error: "unavailable",
    });
    expect(used.notify).not.toHaveBeenCalled();
    expect(used.log).toHaveBeenCalledWith(
      expect.objectContaining({ requestId, outcome: "error:deletion-unclear" }),
    );
  });

  it("[T-17] still succeeds when the notice fails, and logs no personal data", async () => {
    const used = ports({ notify: vi.fn<DeletionPorts["notify"]>(async () => "failed") });
    await expect(deleteAccount("user-1", requestId, used)).resolves.toMatchObject({ ok: true });
    expect(used.log.mock.calls).toEqual([
      [
        {
          level: "error",
          requestId,
          route: "POST /actions/delete-account",
          outcome: "error:deletion-notice",
          durationMs: 0,
        },
      ],
    ]);
  });

  it("accepts only the typed word, and no other field", () => {
    expect(deleteAccountInput.safeParse({ confirmation: "DELETE" }).success).toBe(true);
    for (const input of [
      {},
      { confirmation: "delete" },
      { confirmation: "DELETE", userId: "someone-else" },
    ]) {
      expect(deleteAccountInput.safeParse(input).success).toBe(false);
    }
    expect(JSON.stringify({ confirmation: "DELETE" }).length).toBeLessThanOrEqual(MAX_DELETE_BYTES);
  });
});

describe("[FR-PRF-03] the real ports and the privileged client", () => {
  function configure(secretKey: string) {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://db.example.com");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "sb_publishable_example");
    vi.stubEnv("NEXT_PUBLIC_TURNSTILE_SITE_KEY", "1x00000000000000000000AA");
    vi.stubEnv("RESEND_API_KEY", "re_example");
    vi.stubEnv("SUPABASE_SECRET_KEY", secretKey);
    vi.stubEnv("DELETION_NOTICE_FROM", secretKey && "notices@example.com");
    vi.stubEnv("DELETION_NOTICE_TO", secretKey && "owner@example.com");
  }
  const claims = async () => null;
  const remove = () => {
    const real = deletionPorts(claims);
    if (real === null) throw new Error("not configured");
    return real.deleteUser("user-1");
  };

  it("are absent without the deletion variables", () => {
    configure("");
    expect(accountDeletionAvailable()).toBe(false);
    expect(deletionPorts(claims)).toBeNull();
    expect(mocks.createClient).not.toHaveBeenCalled();
  });

  it("delete the one user, for good, with a client that keeps no session", async () => {
    configure("sb_secret_example");
    mocks.deleteUser.mockResolvedValue({ error: null });
    expect(accountDeletionAvailable()).toBe(true);
    await expect(remove()).resolves.toBe("deleted");
    expect(mocks.deleteUser.mock.calls).toEqual([["user-1"]]);
    expect(mocks.createClient).toHaveBeenCalledWith(
      "https://db.example.com",
      "sb_secret_example",
      expect.objectContaining({
        auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
      }),
    );
  });

  it.each([
    [{ status: 404, code: "user_not_found" }, "deleted"],
    [{ status: 404 }, "unavailable"],
    [{ status: 401 }, "unavailable"],
    [{ status: 500 }, "unavailable"],
    [{}, "unavailable"],
  ])("read the error %j as %s", async (error, outcome) => {
    configure("sb_secret_example");
    mocks.deleteUser.mockResolvedValue({ error });
    await expect(remove()).resolves.toBe(outcome);
  });
});
