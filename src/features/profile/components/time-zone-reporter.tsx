"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";

type Answer = { ok: true; value: { changed: boolean } } | { ok: false };

/**
 * Tells the account the browser's time zone, once per visit, when it is not
 * spelled as the stored one (FR-PRF-02). The server may store another
 * spelling of the same zone, so the page renders again only when the server
 * says the stored value changed. A failure changes nothing and the next
 * visit tries again.
 */
export function TimeZoneReporter({
  stored,
  updateProfile,
}: {
  stored: string;
  updateProfile: (input: { timeZone: string }) => Promise<Answer>;
}) {
  const router = useRouter();
  // A render after the change passes a new action reference: never send twice.
  const sent = useRef(false);
  useEffect(() => {
    const timeZone = new Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (sent.current || !timeZone || timeZone === stored) return;
    sent.current = true;
    updateProfile({ timeZone }).then(
      (result) => {
        if (result.ok && result.value.changed) router.refresh();
      },
      () => undefined,
    );
  }, [stored, updateProfile, router]);
  return null;
}
