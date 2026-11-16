"use client";

import { type ReactNode, useEffect, useState } from "react";

/**
 * A live region that is in the page before its text. Screen readers announce
 * a change inside a region they already know; a region inserted together with
 * its text is often read silently. So the region renders empty, and the text
 * follows a frame later.
 */
export function LiveText({ role, children }: { role: "status" | "alert"; children: ReactNode }) {
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
  return <p role={role}>{mounted ? children : null}</p>;
}
