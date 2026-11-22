"use client";

import { useEffect, useState } from "react";
import { lessonContent as words } from "@/messages/lesson";
import { Button } from "@/ui";

// The copy control of a code block (docs/spec/04-content-system.md section 5).
// The result is said in the button's own words and announced, so a reader
// who cannot see the button still learns whether the copy worked.

type CopyState = "idle" | "copied" | "failed";

/** How long "Copied" stays before the control reads "Copy code" again. */
export const COPIED_MS = 2_000;

export type WriteText = (text: string) => Promise<void>;

const clipboardWrite: WriteText = (text) => navigator.clipboard.writeText(text);

export function CopyCodeButton({
  code,
  writeText = clipboardWrite,
}: {
  code: string;
  writeText?: WriteText;
}) {
  const [state, setState] = useState<CopyState>("idle");

  useEffect(() => {
    if (state !== "copied") return;
    const timer = setTimeout(() => setState("idle"), COPIED_MS);
    return () => clearTimeout(timer);
  }, [state]);

  return (
    <div className="flex items-center gap-3">
      <span role="status" className="text-sm text-text-muted">
        {state === "failed" ? words.copyFailed : ""}
      </span>
      <Button
        variant="secondary"
        onPress={() => {
          writeText(code).then(
            () => setState("copied"),
            () => setState("failed"),
          );
        }}
      >
        <span aria-live="polite">{state === "copied" ? words.copied : words.copyCode}</span>
      </Button>
    </div>
  );
}
