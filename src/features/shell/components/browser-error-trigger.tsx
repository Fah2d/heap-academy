"use client";

import { useSyncExternalStore } from "react";

const subscribe = () => () => undefined;

/**
 * Development only, for src/app/dev/client-error: renders nothing on the
 * server and while hydrating, then throws in the browser, so the error page
 * receives an error from the browser, which has no digest, and can be seen,
 * checked with axe, and photographed in the state where it reports the error
 * (WP-7.3). React renders the server snapshot while hydrating and the client
 * one right after.
 */
export function BrowserErrorTrigger(): null {
  const inBrowser = useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );
  if (inBrowser) throw new Error("The development browser error page failed on purpose.");
  return null;
}
