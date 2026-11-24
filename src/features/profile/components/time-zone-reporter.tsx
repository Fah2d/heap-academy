"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

/**
 * Tells the account the browser's time zone when it differs from the stored
 * one, then renders the page again so the streak counts the learner's days
 * (FR-PRF-02). A failure changes nothing and the next visit tries again.
 */
export function TimeZoneReporter({
  stored,
  updateProfile,
}: {
  stored: string;
  updateProfile: (input: { timeZone: string }) => Promise<{ ok: boolean }>;
}) {
  const router = useRouter();
  useEffect(() => {
    const timeZone = new Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (!timeZone || timeZone === stored) return;
    updateProfile({ timeZone }).then(
      (result) => {
        if (result.ok) router.refresh();
      },
      () => undefined,
    );
  }, [stored, updateProfile, router]);
  return null;
}
