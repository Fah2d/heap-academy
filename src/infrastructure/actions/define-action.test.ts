import { describe, expect, it, vi } from "vitest";
import { z } from "zod";
import type { Identity, UserId } from "@/domain/auth/identity";
import type { RequestId } from "@/infrastructure/http/request-id";
import type { LogEntry } from "@/infrastructure/logging/logger";
import { createActionFactory, type ActionContext } from "./define-action";

vi.mock("server-only", () => ({}));

const LEARNER: Identity = { userId: "0b6d1c2e-3f40-4a5b-8c6d-7e8f9a0b1c2d" as UserId, aal: "aal1" };
const REQUEST_ID = "3f2c1b0a-9e8d-4c7b-a6f5-e4d3c2b1a090" as RequestId;

function setup(context: Partial<ActionContext> = {}) {
  const lines: LogEntry[] = [];
  let clock = 1000;
  const isAdmin = vi.fn(async () => false);
  const identify = vi.fn(async (): Promise<Identity | null> => null);
  const defineAction = createActionFactory({
    context: async () => ({ requestId: REQUEST_ID, identify, isAdmin, ...context }),
    log: (entry) => lines.push(entry),
    now: () => (clock += 5),
  });
  return { defineAction, lines, isAdmin, identify };
}

const input = z.strictObject({ name: z.string().max(10) });

describe("defineAction", () => {
  it("[NFR-SEC-06] passes the parsed input and the caller to the use case, and logs one line", async () => {
    const { defineAction, lines } = setup({ identify: async () => LEARNER });
    const run = vi.fn(async (value: { name: string }, caller: Identity) => ({
      ok: true as const,
      value: `${value.name}:${caller.userId}`,
    }));
    const action = defineAction({
      name: "say-name",
      access: "signed-in",
      input,
      maxBytes: 100,
      run,
    });

    await expect(action({ name: "Sara" })).resolves.toEqual({
      ok: true,
      value: `Sara:${LEARNER.userId}`,
    });
    expect(run).toHaveBeenCalledOnce();
    expect(lines).toEqual([
      {
        level: "info",
        requestId: REQUEST_ID,
        route: "POST /actions/say-name",
        outcome: "ok",
        durationMs: 5,
      },
    ]);
  });

  it("[NFR-SEC-06] refuses a signed-in action without a session, before the use case runs", async () => {
    const { defineAction, lines } = setup();
    const run = vi.fn();
    const action = defineAction({
      name: "say-name",
      access: "signed-in",
      input,
      maxBytes: 100,
      run,
    });

    await expect(action({ name: "Sara" })).resolves.toEqual({ ok: false, error: "not_signed_in" });
    expect(run).not.toHaveBeenCalled();
    expect(lines.map((line) => line.outcome)).toEqual(["error:not-signed-in"]);
  });

  it("[NFR-SEC-06] [FR-ADM-01] answers not found to a learner calling an admin action", async () => {
    const { defineAction, lines, isAdmin } = setup({ identify: async () => LEARNER });
    const run = vi.fn();
    const action = defineAction({
      name: "save-course",
      access: "admin",
      input,
      maxBytes: 100,
      run,
    });

    await expect(action({ name: "x" })).resolves.toEqual({ ok: false, error: "not_found" });
    expect(isAdmin).toHaveBeenCalledOnce();
    expect(run).not.toHaveBeenCalled();
    expect(lines[0]).toMatchObject({ level: "warn", outcome: "error:not-found" });
  });

  it("[FR-ADM-01] answers not found to a guest calling an admin action, without asking the database", async () => {
    const { defineAction, isAdmin } = setup();
    const run = vi.fn();
    const action = defineAction({
      name: "save-course",
      access: "admin",
      input,
      maxBytes: 100,
      run,
    });

    await expect(action({ name: "x" })).resolves.toEqual({ ok: false, error: "not_found" });
    expect(isAdmin).not.toHaveBeenCalled();
    expect(run).not.toHaveBeenCalled();
  });

  it("[NFR-SEC-06] runs an admin action when the database says the session is an admin", async () => {
    const admin: Identity = { ...LEARNER, aal: "aal2" };
    const { defineAction } = setup({ identify: async () => admin, isAdmin: async () => true });
    const action = defineAction({
      name: "save-course",
      access: "admin",
      input,
      maxBytes: 100,
      run: async () => ({ ok: true as const, value: "saved" }),
    });

    await expect(action({ name: "x" })).resolves.toEqual({ ok: true, value: "saved" });
  });

  it("[NFR-SEC-06] passes a null caller to an action anyone may call", async () => {
    const { defineAction } = setup();
    const run = vi.fn(async (_value: { name: string }, caller: Identity | null) => ({
      ok: true as const,
      value: caller,
    }));
    const action = defineAction({ name: "say-name", access: "anyone", input, maxBytes: 100, run });

    await expect(action({ name: "Sara" })).resolves.toEqual({ ok: true, value: null });
  });

  it.each([
    ["an unknown field", { name: "Sara", userId: LEARNER.userId }],
    ["a field over its limit", { name: "a".repeat(11) }],
    ["the wrong type", { name: 7 }],
    ["no object", "Sara"],
    ["nothing", undefined],
  ])("[NFR-SEC-06] refuses %s as invalid input", async (_name, raw) => {
    const { defineAction } = setup();
    const run = vi.fn();
    const action = defineAction({ name: "say-name", access: "anyone", input, maxBytes: 100, run });

    await expect(action(raw)).resolves.toEqual({ ok: false, error: "invalid_input" });
    expect(run).not.toHaveBeenCalled();
  });

  it("[NFR-SEC-06] refuses an input larger than the limit before parsing it", async () => {
    const { defineAction } = setup();
    const parse = vi.spyOn(input, "safeParse");
    const action = defineAction({
      name: "say-name",
      access: "anyone",
      input,
      maxBytes: 20,
      run: async () => ({ ok: true as const, value: "ok" }),
    });

    // {"name":"Sara"} is 15 bytes; the second one is 21.
    await expect(action({ name: "Sara" })).resolves.toMatchObject({ ok: true });
    parse.mockClear();
    await expect(action({ name: "Sara-Sara!" })).resolves.toEqual({
      ok: false,
      error: "invalid_input",
    });
    expect(parse).not.toHaveBeenCalled();
    parse.mockRestore();
  });

  it("[NFR-SEC-06] counts bytes, not characters", async () => {
    const { defineAction } = setup();
    const action = defineAction({
      name: "say-name",
      access: "anyone",
      input,
      maxBytes: 15,
      run: async () => ({ ok: true as const, value: "ok" }),
    });

    // {"name":"Sara"} is 15 bytes; with "é" it is 16.
    await expect(action({ name: "Sara" })).resolves.toMatchObject({ ok: true });
    await expect(action({ name: "Saré" })).resolves.toEqual({ ok: false, error: "invalid_input" });
  });

  it("[NFR-SEC-06] refuses an input with no JSON form", async () => {
    const { defineAction } = setup();
    const cyclic: Record<string, unknown> = {};
    cyclic["self"] = cyclic;
    const action = defineAction({
      name: "say-name",
      access: "anyone",
      input,
      maxBytes: 100,
      run: vi.fn(),
    });

    await expect(action(cyclic)).resolves.toEqual({ ok: false, error: "invalid_input" });
    await expect(action(10n)).resolves.toEqual({ ok: false, error: "invalid_input" });
  });

  it("[NFR-SEC-06] returns the use case's own failure, and logs its code", async () => {
    const { defineAction, lines } = setup();
    const action = defineAction({
      name: "verify-email-code",
      access: "anyone",
      input,
      maxBytes: 100,
      run: async () => ({ ok: false as const, error: "code_rejected" as const }),
    });

    await expect(action({ name: "x" })).resolves.toEqual({ ok: false, error: "code_rejected" });
    expect(lines.map((line) => line.outcome)).toEqual(["error:code-rejected"]);
  });

  it("[NFR-SEC-06] logs and throws on a programmer error", async () => {
    const { defineAction, lines } = setup();
    const action = defineAction({
      name: "say-name",
      access: "anyone",
      input,
      maxBytes: 100,
      run: async () => {
        throw new TypeError("broken");
      },
    });

    await expect(action({ name: "x" })).rejects.toThrow("broken");
    expect(lines).toEqual([
      expect.objectContaining({ level: "error", outcome: "error:unexpected" }),
    ]);
  });

  it("[NFR-SEC-06] logs a failure of the identity check as unexpected and throws", async () => {
    const { defineAction, lines } = setup({
      identify: async () => {
        throw new Error("claims");
      },
    });
    const action = defineAction({
      name: "say-name",
      access: "anyone",
      input,
      maxBytes: 100,
      run: vi.fn(),
    });

    await expect(action({ name: "x" })).rejects.toThrow("claims");
    expect(lines.map((line) => line.outcome)).toEqual(["error:unexpected"]);
  });

  it("[NFR-SEC-06] refuses a name the log line cannot carry", () => {
    const { defineAction } = setup();
    expect(() =>
      defineAction({ name: "Say Name", access: "anyone", input, maxBytes: 100, run: vi.fn() }),
    ).toThrow("lower-case words");
  });
});
