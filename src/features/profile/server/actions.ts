"use server";

import "server-only";
import { SIGN_IN_PER_MINUTE } from "@/infrastructure/actions/action-counter";
import { defineAction } from "@/infrastructure/actions/server-action";
import {
  deleteAccount as deleteAccountUseCase,
  deleteAccountInput,
  deletionPorts,
  MAX_DELETE_BYTES,
} from "./delete-account";
import {
  MAX_PROFILE_BYTES,
  updateProfile as updateProfileUseCase,
  updateProfileInput,
} from "./profile";

// `updateProfile` of docs/spec/02-architecture.md section 9.1: the time zone,
// the display name, or both. And `deleteAccount`.

export const updateProfile = defineAction({
  name: "update-profile",
  access: "signed-in",
  input: updateProfileInput,
  maxBytes: MAX_PROFILE_BYTES,
  run: (input, { caller, services }) =>
    updateProfileUseCase(caller.userId, input, services.profiles),
});

export const deleteAccount = defineAction({
  name: "delete-account",
  access: "signed-in",
  input: deleteAccountInput,
  maxBytes: MAX_DELETE_BYTES,
  // Lower than the default, as for sign-in (docs/spec/07-operations.md section 7).
  perMinute: SIGN_IN_PER_MINUTE,
  run: async (_input, { caller, services, requestId }) => {
    const ports = deletionPorts(async () => (await services.db.auth.getClaims()).data?.claims);
    if (ports === null) return { ok: false as const, error: "unavailable" as const };
    return deleteAccountUseCase(caller.userId, requestId, ports);
  },
});
