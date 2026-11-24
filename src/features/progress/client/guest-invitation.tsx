"use client";

import { createContext, type ReactNode, useContext } from "react";

// The invitation to save progress, for a guest only (FR-AUTH-07). The root
// layout knows who is signed in, and hands the invitation down for a guest
// and nothing for a signed-in learner, so the workspace never reads identity
// (CLAUDE.md rule 9: public pages read no session).

const GuestInvitation = createContext<ReactNode>(null);

export function GuestInvitationProvider({
  invitation,
  children,
}: {
  /** The invitation for a guest; null for a signed-in learner. */
  invitation: ReactNode;
  children: ReactNode;
}) {
  return <GuestInvitation.Provider value={invitation}>{children}</GuestInvitation.Provider>;
}

/** The invitation to show below a new completion, or null when there is none to show. */
export function useGuestInvitation(): ReactNode {
  return useContext(GuestInvitation);
}
