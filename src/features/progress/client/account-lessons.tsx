"use client";

import { createContext, type ReactNode, useContext } from "react";

// The signed-in learner's completed lessons as the server read them for this
// page (02-architecture.md section 10). The root layout hands them down, so
// the page's first HTML already shows them.

const AccountLessons = createContext<readonly string[] | undefined>(undefined);

export function AccountLessonsProvider({
  lessonIds,
  children,
}: {
  /** Undefined for a guest, and when the account could not be read. */
  lessonIds: readonly string[] | undefined;
  children: ReactNode;
}) {
  return <AccountLessons.Provider value={lessonIds}>{children}</AccountLessons.Provider>;
}

export function useAccountLessons(): readonly string[] | undefined {
  return useContext(AccountLessons);
}
