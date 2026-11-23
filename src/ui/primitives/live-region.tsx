"use client";

import { type ReactNode, useEffect, useState } from "react";

/**
 * A live region that is in the page before its content. Screen readers
 * announce a change inside a region they already know; a region inserted
 * together with its content is often read silently. So the region renders
 * empty, with no box of its own, and the whole content follows a frame later:
 * nothing half-drawn is ever on screen, and the layout changes once.
 */
export function LiveRegion({ role, children }: { role: "status" | "alert"; children: ReactNode }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    // One frame later, so the empty region has been laid out first.
    const frame = requestAnimationFrame(() => {
      setMounted(true);
    });
    return () => {
      cancelAnimationFrame(frame);
    };
  }, []);
  return <div role={role}>{mounted ? children : null}</div>;
}
