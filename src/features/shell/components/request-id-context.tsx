"use client";

import { createContext, useContext, type ReactNode } from "react";
import type { RequestId } from "../request-id";

const RequestIdContext = createContext<RequestId | undefined>(undefined);

/** Gives client components, such as the error page, the ID of the request that rendered the page. */
export function RequestIdProvider({
  requestId,
  children,
}: {
  requestId: RequestId | undefined;
  children: ReactNode;
}) {
  return <RequestIdContext.Provider value={requestId}>{children}</RequestIdContext.Provider>;
}

export function useRequestId(): RequestId | undefined {
  return useContext(RequestIdContext);
}
