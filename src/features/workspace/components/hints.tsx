"use client";

import { useEffect, useRef, useState } from "react";
import { workspace as words } from "@/messages/workspace";
import { Button } from "@/ui";

/**
 * The lesson's hints, one at a time and only on request (FR-WSP-22). A
 * lesson without hints shows no hint control. Each new hint takes the focus,
 * so a screen reader reads it at once.
 */
export function Hints({ hints }: { hints: readonly string[] }) {
  const [shown, setShown] = useState(0);
  const latest = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    if (shown > 0) latest.current?.focus();
  }, [shown]);

  if (hints.length === 0) return null;
  return (
    <section aria-labelledby="workspace-hints" className="flex flex-col gap-3">
      <h2 id="workspace-hints" className="text-lg font-semibold text-text">
        {words.hints}
      </h2>
      {hints.slice(0, shown).map((hint, index) => (
        <div key={index} className="flex flex-col gap-1">
          <h3
            ref={index === shown - 1 ? latest : undefined}
            tabIndex={-1}
            className="text-base font-medium text-text-muted outline-none focus-visible:outline-2"
          >
            {words.hintHeading(index + 1, hints.length)}
          </h3>
          <p className="max-w-prose text-prose text-text">{hint}</p>
        </div>
      ))}
      {shown < hints.length && (
        <div>
          <Button
            variant="secondary"
            onPress={() => {
              setShown((current) => current + 1);
            }}
          >
            {shown === 0 ? words.showHint : words.showNextHint}
          </Button>
        </div>
      )}
    </section>
  );
}
