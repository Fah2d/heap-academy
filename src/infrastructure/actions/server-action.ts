import "server-only";
import { headers } from "next/headers";
import { createActionFactory } from "@/infrastructure/actions/define-action";
import {
  type SignInProvider,
  supabaseSignInProvider,
} from "@/infrastructure/auth/sign-in-provider";
import { type SecondStepProvider, supabaseSecondStep } from "@/infrastructure/auth/second-step";
import { verifiedIdentity } from "@/infrastructure/auth/verified-identity";
import {
  type CompletionStore,
  supabaseCompletionStore,
} from "@/infrastructure/db/completion-store";
import { type ProfileStore, supabaseProfileStore } from "@/infrastructure/db/profile-store";
import { createSessionClient, type SessionClient } from "@/infrastructure/db/session-client";
import {
  createRequestId,
  parseRequestId,
  REQUEST_ID_HEADER,
} from "@/infrastructure/http/request-id";
import { log } from "@/infrastructure/logging/logger";

// The real context of every server action (docs/spec/02-architecture.md
// section 9.1): this request's ID from proxy.ts, a session client for the
// caller's own cookies, identity from verified claims, and the database's
// answer to whether this session is an admin.

export type ActionServices = {
  /** The caller's own session: row level security decides every read and write. */
  db: SessionClient;
  /** The learner's completions (FR-PRG-02). */
  completions: CompletionStore;
  /** The learner's own profile (FR-PRF-02). */
  profiles: ProfileStore;
  signIn: SignInProvider;
  /** The admin's second sign-in step (FR-ADM-02). */
  secondStep: SecondStepProvider;
};

export const defineAction = createActionFactory<ActionServices>({
  async context() {
    const requestId = parseRequestId((await headers()).get(REQUEST_ID_HEADER)) ?? createRequestId();
    const db = await createSessionClient("read-write");
    return {
      requestId,
      identify: () => verifiedIdentity(db),
      async isAdmin() {
        // A failed check is a refusal. The database refuses an admin's
        // reads and writes again on its own (ADR-0025).
        const { data, error } = await db.rpc("is_admin");
        return error === null && data === true;
      },
      services: {
        db,
        completions: supabaseCompletionStore(db),
        profiles: supabaseProfileStore(db),
        signIn: supabaseSignInProvider(db.auth),
        secondStep: supabaseSecondStep(db.auth.mfa),
      },
    };
  },
  log,
  now: () => performance.now(),
});
