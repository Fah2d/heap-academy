"use server";

import "server-only";
import { defineAction } from "@/infrastructure/actions/server-action";
import {
  MAX_PROFILE_BYTES,
  updateProfile as updateProfileUseCase,
  updateProfileInput,
} from "./profile";

// `updateProfile` of docs/spec/02-architecture.md section 9.1: the time zone,
// the display name, or both.

export const updateProfile = defineAction({
  name: "update-profile",
  access: "signed-in",
  input: updateProfileInput,
  maxBytes: MAX_PROFILE_BYTES,
  run: (input, { caller, services }) =>
    updateProfileUseCase(caller.userId, input, services.profiles),
});
