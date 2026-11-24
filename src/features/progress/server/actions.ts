"use server";

import "server-only";
import { defineAction } from "@/infrastructure/actions/server-action";
import {
  MAX_MERGE_BYTES,
  MAX_RECORD_BYTES,
  mergeProgress as mergeProgressUseCase,
  mergeProgressInput,
  recordCompletion as recordCompletionUseCase,
  recordCompletionInput,
} from "./progress";

// The progress actions of docs/spec/02-architecture.md section 9.1, each
// built with the one wrapper. The caller is the verified identity.

export const recordCompletion = defineAction({
  name: "record-completion",
  access: "signed-in",
  input: recordCompletionInput,
  maxBytes: MAX_RECORD_BYTES,
  run: (input, { caller, services }) =>
    recordCompletionUseCase(caller.userId, input, services.completions),
});

export const mergeProgress = defineAction({
  name: "merge-progress",
  access: "signed-in",
  input: mergeProgressInput,
  maxBytes: MAX_MERGE_BYTES,
  run: (input, { caller, services }) =>
    mergeProgressUseCase(caller.userId, input, services.completions),
});
