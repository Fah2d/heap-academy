"use server";

import "server-only";
import { defineAction } from "@/infrastructure/actions/server-action";
import { secondStep as words } from "@/messages/admin";
import { forListedAdmin } from "./admin-list";
import {
  confirmSetup as confirmSetupUseCase,
  MAX_SECOND_STEP_BYTES,
  MAX_START_SETUP_BYTES,
  secondStepInput,
  startSetup as startSetupUseCase,
  startSetupInput,
  verifySecondStep as verifySecondStepUseCase,
} from "./second-step";

// The second-step actions (FR-ADM-02, docs/spec/03-experience.md section
// 7.1). They are not in the action table of docs/spec/02-architecture.md
// section 9.1 yet (a spec change proposed in the WP-2.3 pull request). Their
// access is "signed-in", because the caller is below aal2 until the code is
// right; each one first asks the database whether the caller is on the admin
// list, and answers anyone else as it would a missing action.

export const startSetup = defineAction({
  name: "start-second-step-setup",
  access: "signed-in",
  input: startSetupInput,
  maxBytes: MAX_START_SETUP_BYTES,
  run: (_input, { services }) =>
    forListedAdmin(services.db, () => startSetupUseCase(words.issuer, services.secondStep)),
});

export const confirmSetup = defineAction({
  name: "confirm-second-step-setup",
  access: "signed-in",
  input: secondStepInput,
  maxBytes: MAX_SECOND_STEP_BYTES,
  run: (input, { services }) =>
    forListedAdmin(services.db, () => confirmSetupUseCase(input, services.secondStep)),
});

export const verifySecondStep = defineAction({
  name: "verify-second-step",
  access: "signed-in",
  input: secondStepInput,
  maxBytes: MAX_SECOND_STEP_BYTES,
  run: (input, { services }) =>
    forListedAdmin(services.db, () => verifySecondStepUseCase(input, services.secondStep)),
});
