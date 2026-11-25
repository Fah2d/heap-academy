import { describe, expect, it, vi } from "vitest";
import { type AdminListDb, forListedAdmin, isOnAdminList } from "./admin-list";

vi.mock("server-only", () => ({}));

const db = (answer: { data: unknown; error: unknown }): AdminListDb => ({
  rpc: vi.fn(() => Promise.resolve(answer)),
});

describe("isOnAdminList [FR-ADM-01, T-19]", () => {
  it("asks the database through the caller's session", async () => {
    const given = db({ data: true, error: null });
    expect(await isOnAdminList(given)).toBe(true);
    expect(given.rpc).toHaveBeenCalledWith("is_on_admin_list");
  });

  it.each([
    ["false", { data: false, error: null }],
    ["an error", { data: null, error: { code: "42501" } }],
    ["true with an error", { data: true, error: { code: "PGRST" } }],
    ["a truthy non-boolean", { data: "true", error: null }],
  ])("refuses on %s", async (_, answer) => {
    expect(await isOnAdminList(db(answer))).toBe(false);
  });
});

describe("forListedAdmin [FR-ADM-02, T-19]", () => {
  it("runs the step for a caller on the list", async () => {
    const step = vi.fn(() => Promise.resolve({ ok: true as const, value: null }));
    expect(await forListedAdmin(db({ data: true, error: null }), step)).toEqual({
      ok: true,
      value: null,
    });
    expect(step).toHaveBeenCalledOnce();
  });

  it("answers anyone else not_found without running the step", async () => {
    const step = vi.fn(() => Promise.resolve({ ok: true as const, value: null }));
    expect(await forListedAdmin(db({ data: false, error: null }), step)).toEqual({
      ok: false,
      error: "not_found",
    });
    expect(step).not.toHaveBeenCalled();
  });
});
