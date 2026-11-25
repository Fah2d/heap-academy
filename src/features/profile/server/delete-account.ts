import "server-only";
import { z } from "zod";
import { signedInRecently } from "@/domain/auth/recent-sign-in";
import type { UseCaseResult } from "@/infrastructure/actions/define-action";
import { deleteAuthUser } from "@/infrastructure/db/privileged";
import { sendDeletionNotice } from "@/infrastructure/email/deletion-notice";
import { deletionEnvironment } from "@/infrastructure/env/schema";
import type { RequestId } from "@/infrastructure/http/request-id";
import { log, type Logger } from "@/infrastructure/logging/logger";
import { actionLogRoute } from "@/infrastructure/logging/route";
import { profile } from "@/messages/profile";

// `deleteAccount` of docs/spec/02-architecture.md section 9.1 (FR-PRF-03,
// J-10): the one use of the privileged client. The user ID is the caller's
// own, from verified claims; the input names nobody.

export const deleteAccountInput = z.strictObject({
  confirmation: z.literal(profile.deleteWord),
});
export const MAX_DELETE_BYTES = 64;

export type DeleteAccountFailure = "sign_in_again" | "unavailable";

export type DeletionPorts = {
  /** The verified claims of the caller's session, or null. */
  claims: () => Promise<unknown>;
  deleteUser: (userId: string) => Promise<"deleted" | "unavailable">;
  notify: (userId: string) => Promise<"sent" | "failed">;
  log: Logger;
  now: () => number;
};

export async function deleteAccount(
  userId: string,
  requestId: RequestId,
  ports: DeletionPorts,
): Promise<UseCaseResult<null, DeleteAccountFailure>> {
  if (!signedInRecently(await ports.claims(), ports.now())) {
    return { ok: false, error: "sign_in_again" };
  }
  if ((await ports.deleteUser(userId)) === "unavailable") {
    return { ok: false, error: "unavailable" };
  }
  // The deletion never waits on the email succeeding (ADR-0030). A failure is
  // logged by request ID alone, and a restore is then checked by hand.
  if ((await ports.notify(userId)) === "failed") {
    ports.log({
      level: "error",
      requestId,
      route: actionLogRoute("delete-account"),
      outcome: "error:deletion-notice",
      durationMs: 0,
    });
  }
  return { ok: true, value: null };
}

/** Whether this deployment can delete accounts; the profile offers it only then. */
export function accountDeletionAvailable(): boolean {
  return deletionEnvironment(process.env) !== null;
}

/** The real ports, over the caller's session claims and the privileged client. */
export function deletionPorts(claims: DeletionPorts["claims"]): DeletionPorts | null {
  const environment = deletionEnvironment(process.env);
  if (environment === null) return null;
  return {
    claims,
    deleteUser: (userId) => deleteAuthUser(environment.supabaseUrl, environment.secretKey, userId),
    notify: (userId) => sendDeletionNotice(environment, userId),
    log,
    now: Date.now,
  };
}
