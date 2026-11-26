import "server-only";
import type { ReactNode } from "react";
import { SaveProgressInvitation } from "../components/save-progress-invitation";
import { isSignedIn } from "./viewer";

/**
 * The invitation to save progress for this request's visitor: the card for a
 * guest, nothing for a signed-in learner (FR-AUTH-07). The root layout hands
 * it down, so no page below it reads identity.
 */
export async function guestInvitation(): Promise<ReactNode> {
  return (await isSignedIn()) ? null : <SaveProgressInvitation />;
}
