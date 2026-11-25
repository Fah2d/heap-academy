"use client";

import { type RefObject, useCallback, useEffect, useState } from "react";

/**
 * Moves focus to the first element inside `container` that matches a
 * selector, after the commit that holds the state set beside the request.
 *
 * A frame callback is not enough: an update made inside an async transition
 * is committed only when the transition ends, so the next frame can come
 * before the field is marked, and focus would stay where it was. The effect
 * runs after its children's effects, so a field that marks itself in an
 * effect, as the code editor does, is marked by then.
 */
export function useFocusAfterCommit(
  container: RefObject<HTMLElement | null>,
): (selector: string) => void {
  const [request, setRequest] = useState<{ selector: string } | null>(null);
  useEffect(() => {
    if (request === null) return;
    container.current?.querySelector<HTMLElement>(request.selector)?.focus();
  }, [request, container]);
  // A new object each time, so asking again for the same selector still runs.
  return useCallback((selector: string) => setRequest({ selector }), []);
}
