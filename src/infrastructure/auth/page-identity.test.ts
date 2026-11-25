import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const state = vi.hoisted(() => ({ headers: new Headers(), getClaims: vi.fn() }));
vi.mock("next/headers", () => ({ headers: () => Promise.resolve(state.headers) }));
vi.mock("@/infrastructure/db/session-client", () => ({
  createSessionClient: () => Promise.resolve({ auth: { getClaims: state.getClaims } }),
}));

const { pageIdentity } = await import("./page-identity");

afterEach(() => {
  state.headers = new Headers();
  state.getClaims.mockReset();
});

const CLAIMS = { sub: "00000000-0000-4000-8000-000000000001", role: "authenticated", aal: "aal1" };

describe("pageIdentity", () => {
  it("[FR-AUTH-05] reads the visitor from verified claims", async () => {
    state.getClaims.mockResolvedValue({ data: { claims: CLAIMS }, error: null });
    expect(await pageIdentity()).toEqual({ userId: CLAIMS.sub, aal: "aal1" });
  });

  it("[FR-AUTH-05] after the proxy found the auth service down, asks nothing and counts the visitor as signed out", async () => {
    state.headers = new Headers({ "x-heap-auth-unavailable": "1" });
    expect(await pageIdentity()).toBeNull();
    expect(state.getClaims).not.toHaveBeenCalled();
  });

  it("[FR-AUTH-05] a failed check counts as signed out", async () => {
    state.getClaims.mockResolvedValue({ data: null, error: { message: "fetch failed" } });
    expect(await pageIdentity()).toBeNull();
  });
});
