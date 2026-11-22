"use client";

import { useEffect, useRef, useState } from "react";
import type { LessonDocument } from "@/content/markdown";
import { LessonContent } from "@/features/workspace";
import { lessonEditor as words, structure } from "@/messages/admin";
import { Notice } from "@/ui";
import type { AdminAction } from "../types";
import { settle } from "./structure-controls";

// The live preview beside the instructions (docs/spec/03-experience.md
// section 7.4; FR-ADM-04, NFR-SEC-07): the Markdown goes to the server's one
// renderer, and the answer is shown by the same component as the lesson page,
// so the preview cannot differ from what learners see. Typing waits a moment
// before asking; an answer to older text is dropped.

export type RenderPreview = AdminAction<{ markdown: string }, LessonDocument>;

/** How long typing must pause before the preview is asked for. */
export const PREVIEW_DELAY_MS = 300;

type PreviewState = "current" | "updating" | "failed";

export function InstructionsPreview({
  markdown,
  initial,
  render,
}: {
  markdown: string;
  /** The saved instructions, rendered on the server with the page. */
  initial: LessonDocument;
  render: RenderPreview;
}) {
  const [document, setDocument] = useState(initial);
  const [state, setState] = useState<PreviewState>("current");
  const shown = useRef(markdown);
  const latest = useRef(markdown);

  useEffect(() => {
    latest.current = markdown;
    if (markdown === shown.current) {
      setState("current");
      return;
    }
    setState("updating");
    const timer = setTimeout(() => {
      void settle(() => render({ markdown })).then((outcome) => {
        // Typing went on while this was asked: a newer request is coming.
        if (latest.current !== markdown) return;
        if (!outcome.ok) {
          setState("failed");
          return;
        }
        shown.current = markdown;
        setDocument(outcome.value);
        setState("current");
      });
    }, PREVIEW_DELAY_MS);
    return () => clearTimeout(timer);
  }, [markdown, render]);

  return (
    <div className="flex flex-col gap-3">
      {/* Always in place, so the preview below does not move as typing
          pauses; shown while updating and never announced. */}
      <p className={state === "updating" ? "text-sm text-text-muted" : "invisible text-sm"}>
        {words.previewUpdating}
      </p>
      {state === "failed" && (
        <Notice kind="error" kindLabel={structure.errorLabel} announce="polite">
          {words.previewFailed}
        </Notice>
      )}
      <div
        data-testid="instructions-preview"
        className="rounded-panel border border-border bg-surface p-4"
      >
        {document.blocks.length === 0 ? (
          <p className="text-base text-text-muted">{words.previewEmpty}</p>
        ) : (
          <LessonContent document={document} topHeadingLevel={4} />
        )}
      </div>
    </div>
  );
}
