"use client";

import { useEffect, useRef } from "react";
import { workspace as words } from "@/messages/workspace";
import { Button } from "@/ui";

/**
 * The lesson's hints, one at a time and only on request (FR-WSP-22). A
 * lesson without hints shows no hint control. Each new hint takes the focus,
 * so a screen reader reads it at once.
 *
 * The workspace keeps the count, because crossing 768 px builds this part
 * again (WP-9.1 design review, M2). Only a hint just asked for takes the
 * focus; a rebuilt list leaves the focus where it was.
 */
export function Hints({
  hints,
  shown,
  onShow,
}: {
  hints: readonly string[];
  shown: number;
  onShow: () => void;
}) {
  const latest = useRef<HTMLHeadingElement>(null);
  const asked = useRef(false);

  useEffect(() => {
    if (!asked.current) return;
    asked.current = false;
    latest.current?.focus();
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
              asked.current = true;
              onShow();
            }}
          >
            {shown === 0 ? words.showHint : words.showNextHint}
          </Button>
        </div>
      )}
    </section>
  );
}
