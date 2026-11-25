"use client";

import { useEffect, useRef } from "react";

// Unsaved changes are never lost silently (FR-ADM-10): while an editor holds
// changes it has not saved, leaving asks first. Three ways out are covered:
// closing or reloading the tab (the browser's own prompt), a link inside the
// page (the App Router changes pages without unloading, so the click is
// caught before Next.js sees it), and the Back button (a guard entry in the
// history, restored if the owner chooses to stay).

const GUARD = "heap-unsaved-guard";

/** Whether a click on this element would take the browser to another page. */
function leavingLink(event: MouseEvent): HTMLAnchorElement | null {
  if (event.defaultPrevented || event.button !== 0) return null;
  if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return null;
  const target = event.target instanceof Element ? event.target.closest("a[href]") : null;
  if (!(target instanceof HTMLAnchorElement)) return null;
  if (target.target !== "" && target.target !== "_self") return null;
  if (target.hasAttribute("download")) return null;
  const next = new URL(target.href, window.location.href);
  const here = new URL(window.location.href);
  // A link to a place on this page is not leaving it.
  if (next.origin === here.origin && next.pathname === here.pathname && next.search === here.search)
    return null;
  return target;
}

export type ConfirmLeave = (message: string) => boolean;

export type LeaveWarning = {
  /** Lets the page go with no question, for a save that opens another page. */
  release: () => void;
};

export function useLeaveWarning(
  unsaved: boolean,
  message: string,
  confirmLeave: ConfirmLeave = (text) => window.confirm(text),
): LeaveWarning {
  const released = useRef(false);
  // Read at the moment of leaving, so a save that just finished counts.
  const state = useRef({ unsaved, message, confirmLeave });
  useEffect(() => {
    state.current = { unsaved: unsaved && !released.current, message, confirmLeave };
  });

  useEffect(() => {
    if (!unsaved) return;

    function onBeforeUnload(event: BeforeUnloadEvent) {
      if (!state.current.unsaved) return;
      event.preventDefault();
      // Older browsers show the prompt only when this is set.
      event.returnValue = "";
    }

    function onClick(event: MouseEvent) {
      if (!state.current.unsaved || leavingLink(event) === null) return;
      if (state.current.confirmLeave(state.current.message)) return;
      event.preventDefault();
      event.stopPropagation();
    }

    // The guard entry: Back first lands on this page again, as a popstate.
    // It keeps the router's own state, so the router treats it as this page.
    const guard = () =>
      window.history.pushState(
        { ...(window.history.state as object | null), [GUARD]: true },
        "",
        window.location.href,
      );
    guard();
    function onPopState() {
      if (!state.current.unsaved) {
        window.history.back();
        return;
      }
      if (state.current.confirmLeave(state.current.message)) {
        window.history.back();
        return;
      }
      guard();
    }

    window.addEventListener("beforeunload", onBeforeUnload);
    // Capture, so the warning runs before the router handles the click.
    document.addEventListener("click", onClick, true);
    window.addEventListener("popstate", onPopState);
    return () => {
      window.removeEventListener("beforeunload", onBeforeUnload);
      document.removeEventListener("click", onClick, true);
      window.removeEventListener("popstate", onPopState);
      // Take the guard entry back out when the changes are saved.
      const current = window.history.state as Record<string, unknown> | null;
      if (current?.[GUARD] === true) window.history.back();
    };
  }, [unsaved]);

  return {
    release() {
      released.current = true;
      state.current = { ...state.current, unsaved: false };
    },
  };
}
