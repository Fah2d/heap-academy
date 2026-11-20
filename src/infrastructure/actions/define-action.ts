import "server-only";
import type { z } from "zod";
import type { Identity } from "@/domain/auth/identity";
import type { RequestId } from "@/infrastructure/http/request-id";
import type { Logger } from "@/infrastructure/logging/logger";
import { actionLogRoute } from "@/infrastructure/logging/route";

// The one wrapper every server action is built with (ADR-0027,
// docs/spec/02-architecture.md section 9.1, .claude/rules/server.md). In
// order: a request ID, identity from verified claims, schema parsing with a
// size limit, the use case, a typed result, and one structured log line.
//
// What it needs from the request comes in as `ActionContext`, so the wrapper
// is tested with fakes; the Next.js and auth-provider adapter builds the real
// one per request.

/** Who may call an action. An admin is on the allow-list at `aal2` (ADR-0025). */
export type Access = "anyone" | "signed-in" | "admin";

/** The failures every action can return, whatever its use case. */
export type WrapperError = "invalid_input" | "not_signed_in" | "not_found";

export type ActionResult<Value, Failure extends string> =
  { ok: true; value: Value } | { ok: false; error: Failure | WrapperError };

/** What the use case returns: a value, or one of its own expected failures. */
export type UseCaseResult<Value, Failure extends string> =
  { ok: true; value: Value } | { ok: false; error: Failure };

export type ActionContext = {
  requestId: RequestId;
  /** The caller from verified claims, or null when signed out. */
  identify: () => Promise<Identity | null>;
  /** Whether the database says this session is an admin (`private.is_admin()`). */
  isAdmin: () => Promise<boolean>;
};

export type ActionDependencies = {
  context: () => Promise<ActionContext>;
  log: Logger;
  /** Milliseconds, for the duration in the log line. */
  now: () => number;
};

/** The caller as the use case sees it: null only for an `anyone` action. */
type CallerFor<A extends Access> = A extends "anyone" ? Identity | null : Identity;

export type ActionDefinition<
  A extends Access,
  Schema extends z.ZodType,
  Value,
  Failure extends string,
> = {
  /** Lower-case words joined by hyphens, for the log line: `request-email-code`. */
  name: string;
  access: A;
  input: Schema;
  /** The largest input accepted, in bytes of its JSON form. */
  maxBytes: number;
  run: (input: z.infer<Schema>, caller: CallerFor<A>) => Promise<UseCaseResult<Value, Failure>>;
};

const NAME = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/;

/** The size of a value's JSON form, or undefined when it has none. */
function jsonBytes(value: unknown): number | undefined {
  let text: string | undefined;
  try {
    text = JSON.stringify(value);
  } catch {
    // A cycle or a BigInt: not something a form or a client call sends.
    return undefined;
  }
  return text === undefined ? undefined : new TextEncoder().encode(text).length;
}

export function createActionFactory(dependencies: ActionDependencies) {
  return function defineAction<
    A extends Access,
    Schema extends z.ZodType,
    Value,
    Failure extends string,
  >(definition: ActionDefinition<A, Schema, Value, Failure>) {
    if (!NAME.test(definition.name)) {
      throw new Error(`An action name is lower-case words joined by hyphens: ${definition.name}`);
    }
    const route = actionLogRoute(definition.name);

    return async (raw: unknown): Promise<ActionResult<Value, Failure>> => {
      const started = dependencies.now();
      const context = await dependencies.context();
      const finish = (
        result: ActionResult<Value, Failure>,
        level: "info" | "warn" = "info",
      ): ActionResult<Value, Failure> => {
        dependencies.log({
          level,
          requestId: context.requestId,
          route,
          outcome: result.ok ? "ok" : `error:${result.error.replaceAll("_", "-")}`,
          durationMs: dependencies.now() - started,
        });
        return result;
      };

      try {
        const caller = await context.identify();
        // Anyone who is not an admin learns nothing about the admin area: the
        // same answer as an address that does not exist (FR-ADM-01). The
        // database refuses the call again whatever this says (ADR-0025).
        if (definition.access === "admin" && (caller === null || !(await context.isAdmin()))) {
          return finish({ ok: false, error: "not_found" }, "warn");
        }
        if (definition.access === "signed-in" && caller === null) {
          return finish({ ok: false, error: "not_signed_in" });
        }

        const size = jsonBytes(raw);
        if (size === undefined || size > definition.maxBytes) {
          return finish({ ok: false, error: "invalid_input" });
        }
        const parsed = definition.input.safeParse(raw);
        if (!parsed.success) return finish({ ok: false, error: "invalid_input" });

        const result = await definition.run(parsed.data, caller as CallerFor<A>);
        return finish(result);
      } catch (error) {
        // A programmer error: it is logged with this request's ID and thrown
        // on, so the error boundary shows it and nothing is reported as done.
        dependencies.log({
          level: "error",
          requestId: context.requestId,
          route,
          outcome: "error:unexpected",
          durationMs: dependencies.now() - started,
        });
        throw error;
      }
    };
  };
}
