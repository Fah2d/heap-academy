import "server-only";
import { headers } from "next/headers";
import { createActionCounter } from "@/infrastructure/actions/action-counter";
import { createActionFactory } from "@/infrastructure/actions/define-action";
import {
  type SignInProvider,
  supabaseSignInProvider,
} from "@/infrastructure/auth/sign-in-provider";
import { type SecondStepProvider, supabaseSecondStep } from "@/infrastructure/auth/second-step";
import { verifiedIdentity } from "@/infrastructure/auth/verified-identity";
import { createSessionClient, type SessionClient } from "@/infrastructure/db/session-client";
import { parseActionCounterKey } from "@/infrastructure/env/schema";
import { clientAddress } from "@/infrastructure/http/client-address";
import {
  createRequestId,
  parseRequestId,
  REQUEST_ID_HEADER,
} from "@/infrastructure/http/request-id";
import { log } from "@/infrastructure/logging/logger";

// The real context of every server action (docs/spec/02-architecture.md
// section 9.1): this request's ID from proxy.ts, the per-action counter for
// this request's network address (T-14), a session client for the caller's
// own cookies, identity from verified claims, and the database's answer to
// whether this session is an admin.

export type ActionServices = {
  /** The caller's own session: row level security decides every read and write. */
  db: SessionClient;
  signIn: SignInProvider;
  /** The admin's second sign-in step (FR-ADM-02). */
  secondStep: SecondStepProvider;
};

export const defineAction = createActionFactory<ActionServices>({
  async context() {
    const requestHeaders = await headers();
    const requestId = parseRequestId(requestHeaders.get(REQUEST_ID_HEADER)) ?? createRequestId();
    const db = await createSessionClient("read-write");
    const counterKey = parseActionCounterKey(process.env);
    return {
      requestId,
      // Over the caller's own session, like every other call: the counter
      // function decides from the signature, not from who is asking.
      count: createActionCounter(
        (name, args) => db.rpc(name, args),
        counterKey,
        clientAddress(requestHeaders),
      ),
      identify: () => verifiedIdentity(db),
      async isAdmin() {
        // A failed check is a refusal. The database refuses an admin's
        // reads and writes again on its own (ADR-0025).
        const { data, error } = await db.rpc("is_admin");
        return error === null && data === true;
      },
      services: {
        db,
        signIn: supabaseSignInProvider(db.auth),
        secondStep: supabaseSecondStep(db.auth.mfa),
      },
    };
  },
  log,
  now: () => performance.now(),
});
