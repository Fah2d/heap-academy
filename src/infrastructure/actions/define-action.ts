import "server-only";
import type { z } from "zod";
import type { Identity } from "@/domain/auth/identity";
import type { RequestId } from "@/infrastructure/http/request-id";
import type { Logger } from "@/infrastructure/logging/logger";
import { actionLogRoute } from "@/infrastructure/logging/route";
import { type CountResult, DEFAULT_PER_MINUTE, MAX_PER_MINUTE } from "./action-counter";

// The one wrapper every server action is built with (ADR-0027,
// docs/spec/02-architecture.md section 9.1, .claude/rules/server.md). In
// order: a request ID, the per-action rate limit (T-14), identity from
// verified claims, schema parsing with a size limit, the use case, a typed
// result, and one structured log line.
//
// What it needs from the request comes in as an `ActionContext`, built per
// request by the adapter that knows Next.js and the auth provider. Its
// `services` are the use cases' ports over the caller's own session (the
// session client, the email code provider), so a use case cannot reach a
// client the wrapper did not give it. The wrapper is tested with fakes.
//
// Calling convention: an action takes one plain object. A form builds that
// object from its fields in its `useActionState` function and passes it on;
// `FormData` itself is refused, because its JSON form is `{}` and would slip
// past the size limit. A use case returns a value or one of its own failures;
// it never calls `redirect()` or `notFound()`, which work by throwing and
// would be logged here as a programmer error. The caller redirects.

/** Who may call an action. An admin is on the allow-list at `aal2` (ADR-0025). */
export type Access = "anyone" | "signed-in" | "admin";

/** The failures every action can return, whatever its use case. */
export type WrapperError =
  "rate_limited" | "unavailable" | "invalid_input" | "not_signed_in" | "not_found";

export type ActionResult<Value, Failure extends string> =
  { ok: true; value: Value } | { ok: false; error: Failure | WrapperError };

/** What the use case returns: a value, or one of its own expected failures. */
export type UseCaseResult<Value, Failure extends string> =
  { ok: true; value: Value } | { ok: false; error: Failure };

export type ActionContext<Services> = {
  requestId: RequestId;
  /** The caller from verified claims, or null when signed out. */
  identify: () => Promise<Identity | null>;
  /**
   * Whether the database says this session is an admin. The adapter asks
   * `public.is_admin()`, the exposed wrapper of `private.is_admin()`; the
   * data API reaches only `public`.
   */
  isAdmin: () => Promise<boolean>;
  /**
   * Counts one call of the named action for this request's network address,
   * against at most `perMinute` calls a minute (T-14). The adapter signs the
   * address so the database accepts the count from the server only.
   */
  count: (action: string, perMinute: number) => Promise<CountResult>;
  /** The use cases' ports, bound to this request's session. */
  services: Services;
};

export type ActionDependencies<Services> = {
  context: () => Promise<ActionContext<Services>>;
  log: Logger;
  /** Milliseconds, for the duration in the log line. */
  now: () => number;
};

/** The caller as the use case sees it: null only for an `anyone` action. */
type CallerFor<A extends Access> = A extends "anyone" ? Identity | null : Identity;

export type UseCaseCall<A extends Access, Services> = {
  caller: CallerFor<A>;
  services: Services;
  requestId: RequestId;
};

export type ActionDefinition<
  A extends Access,
  Schema extends z.ZodType,
  Value,
  Failure extends string,
  Services,
> = {
  /** Lower-case words joined by hyphens, for the log line: `request-email-code`. */
  name: string;
  access: A;
  input: Schema;
  /** The largest input accepted, in bytes of its JSON form. */
  maxBytes: number;
  /**
   * Calls a minute per network address (docs/spec/07-operations.md section
   * 7). Unset, it is 120; sign-in and deletion set a lower one. Only
   * sign-out is `uncounted`: ending one's own session must always work
   * (FR-AUTH-05), and it costs nothing a flood could use.
   */
  perMinute?: number | "uncounted";
  run: (
    input: z.infer<Schema>,
    call: UseCaseCall<A, Services>,
  ) => Promise<UseCaseResult<Value, Failure>>;
};

const NAME = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/;

/** The size of a plain value's JSON form, or undefined when it has none. */
function jsonBytes(value: unknown): number | undefined {
  if (typeof FormData !== "undefined" && value instanceof FormData) return undefined;
  let text: string | undefined;
  try {
    text = JSON.stringify(value);
  } catch {
    // A cycle or a BigInt: not something a client call sends.
    return undefined;
  }
  return text === undefined ? undefined : new TextEncoder().encode(text).length;
}

export function createActionFactory<Services>(dependencies: ActionDependencies<Services>) {
  return function defineAction<
    A extends Access,
    Schema extends z.ZodType,
    Value,
    Failure extends string,
  >(definition: ActionDefinition<A, Schema, Value, Failure, Services>) {
    if (!NAME.test(definition.name)) {
      throw new Error(`An action name is lower-case words joined by hyphens: ${definition.name}`);
    }
    const perMinute = definition.perMinute ?? DEFAULT_PER_MINUTE;
    if (
      perMinute !== "uncounted" &&
      (!Number.isInteger(perMinute) || perMinute < 1 || perMinute > MAX_PER_MINUTE)
    ) {
      throw new Error(`An action's perMinute is a whole number from 1 to ${MAX_PER_MINUTE}`);
    }
    const route = actionLogRoute(definition.name);

    async function decide(
      raw: unknown,
      context: ActionContext<Services>,
      seen: { counterDown: boolean },
    ): Promise<ActionResult<Value, Failure>> {
      // Counted first, before any other work, so a flood costs one database
      // call per request. Without an answer from the counter nothing runs.
      const counted =
        perMinute === "uncounted" ? "allowed" : await context.count(definition.name, perMinute);
      if (counted === "refused") return { ok: false, error: "rate_limited" };
      if (counted === "unavailable") {
        seen.counterDown = true;
        return { ok: false, error: "unavailable" };
      }

      const caller = await context.identify();
      // Anyone who is not an admin at aal2 learns nothing about the admin
      // area: the same answer as an address that does not exist (FR-ADM-01).
      // The database refuses the call again whatever this says (ADR-0025).
      if (definition.access === "admin") {
        if (caller === null || caller.aal !== "aal2" || !(await context.isAdmin())) {
          return { ok: false, error: "not_found" };
        }
      }
      if (definition.access === "signed-in" && caller === null) {
        return { ok: false, error: "not_signed_in" };
      }

      const size = jsonBytes(raw);
      if (size === undefined || size > definition.maxBytes) {
        return { ok: false, error: "invalid_input" };
      }
      const parsed = definition.input.safeParse(raw);
      if (!parsed.success) return { ok: false, error: "invalid_input" };

      return definition.run(parsed.data, {
        caller: caller as CallerFor<A>,
        services: context.services,
        requestId: context.requestId,
      });
    }

    return async (raw: unknown): Promise<ActionResult<Value, Failure>> => {
      const started = dependencies.now();
      let requestId: RequestId | "none" = "none";
      let result: ActionResult<Value, Failure>;
      const seen = { counterDown: false };
      try {
        const context = await dependencies.context();
        requestId = context.requestId;
        result = await decide(raw, context, seen);
      } catch (error) {
        // A programmer error: logged with this request's ID and thrown on, so
        // the error boundary shows it and nothing is reported as done.
        dependencies.log({
          level: "error",
          requestId,
          route,
          outcome: "error:unexpected",
          durationMs: dependencies.now() - started,
        });
        throw error;
      }
      // Outside the try, so the line is written once: a logger that throws
      // is a programmer error of its own, not the use case's.
      // A counter that does not answer is a fault of the service, not of the
      // caller: logged as an error, so a key missing from Vault is seen.
      dependencies.log({
        level: seen.counterDown
          ? "error"
          : !result.ok && (result.error === "not_found" || result.error === "rate_limited")
            ? "warn"
            : "info",
        requestId,
        route,
        outcome: seen.counterDown
          ? "error:counter-unavailable"
          : result.ok
            ? "ok"
            : `error:${result.error.replaceAll("_", "-")}`,
        durationMs: dependencies.now() - started,
      });
      return result;
    };
  };
}
