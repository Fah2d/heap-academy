"use client";

import { useEffect, useId, useRef } from "react";
import { type ContentStatus, statusMoves } from "@/domain/admin/structure";
import { lessonStatus as words, structure } from "@/messages/admin";
import { Button, Dialog, DialogActions, Notice } from "@/ui";
import type { AdminAction } from "../types";

// The status of one lesson in the editor's Publish section
// (docs/spec/03-experience.md section 7.6; FR-ADM-09): what it is now, who
// can see it, and the moves of docs/spec/04-content-system.md section 4.3.
// Publish is offered only when the checklist passed for the content now in
// the editor; the database refuses it otherwise. Taking a lesson off the
// site and archiving ask first and say what learners will see. The editor
// owns the moves, because Publish saves first.

export type SetLessonStatusInput = { id: string; loadedAt: string; status: ContentStatus };
export type SetLessonStatus = AdminAction<SetLessonStatusInput, { updatedAt: string }>;

export type LessonStatusControlsProps = {
  status: ContentStatus;
  /** A passing validation covers the lesson as it is in the editor. */
  canPublish: boolean;
  pending: boolean;
  failure: string | null;
  /** The failure is a newer version: offer a reload. */
  stale: boolean;
  /** The status the last move reached, for the live region. */
  changed: ContentStatus | null;
  onMove: (to: ContentStatus) => void;
};

/** Leaving the site, or archiving, is asked about first. */
const asks = (from: ContentStatus, to: ContentStatus) =>
  to === "archived" || (from === "published" && to === "draft");

export function LessonStatusControls({
  status,
  canPublish,
  pending,
  failure,
  stale,
  changed,
  onMove,
}: LessonStatusControlsProps) {
  const headingId = useId();
  // The pressed button is gone after a move, so focus goes to the sentence
  // that says the new status.
  const statusLine = useRef<HTMLParagraphElement>(null);
  const focusStatus = useRef(false);
  useEffect(() => {
    if (!focusStatus.current) return;
    focusStatus.current = false;
    statusLine.current?.focus();
  }, [status]);
  useEffect(() => {
    if (failure !== null) focusStatus.current = false;
  }, [failure]);

  const move = (to: ContentStatus) => {
    focusStatus.current = true;
    onMove(to);
  };
  const moves = statusMoves(status).filter((to) => to !== "published" || canPublish);
  const waits = status === "draft" && !canPublish;

  return (
    <div role="group" aria-labelledby={headingId} className="flex max-w-prose flex-col gap-4">
      <h3 id={headingId} className="text-base font-medium text-text">
        {words.heading}
      </h3>
      <p ref={statusLine} tabIndex={-1} className="text-base text-text">
        {words.now(words.name[status])} {words.explain[status]}
      </p>
      {waits && <p className="text-sm text-text-muted">{words.publishWaits}</p>}
      {moves.includes("published") && (
        <p className="text-sm text-text-muted">{words.publishSaves}</p>
      )}
      {failure !== null && (
        <div className="flex flex-col gap-3">
          <Notice kind="error" kindLabel={structure.errorLabel} announce="assertive">
            {failure}
          </Notice>
          {stale && (
            <div>
              <Button variant="secondary" onPress={() => window.location.reload()}>
                {structure.reload}
              </Button>
            </div>
          )}
        </div>
      )}
      {/* Kept in the page for the live region, and out of the layout while empty. */}
      <p
        role="status"
        className={pending || changed !== null ? "text-sm text-text-muted" : "sr-only"}
      >
        {pending ? words.changing : changed === null ? "" : words.changed(words.name[changed])}
      </p>
      <div className="flex flex-wrap gap-3">
        {moves.map((to) => {
          // One primary action per page: Save, in the top bar.
          const variant = to === "archived" ? "destructive" : "secondary";
          const label = words.action[to];
          if (!asks(status, to)) {
            return (
              <Button key={to} variant={variant} isPending={pending} onPress={() => move(to)}>
                {label}
              </Button>
            );
          }
          const key = to === "archived" ? "archived" : "draft";
          return (
            <Dialog
              key={to}
              title={words.confirmTitle[key]}
              trigger={
                <Button variant={variant} isPending={pending}>
                  {label}
                </Button>
              }
            >
              {(close) => (
                <>
                  <p className="text-base text-text">{words.confirmBody[key]}</p>
                  <DialogActions>
                    <Button variant="secondary" surface="raised" onPress={close}>
                      {words.cancel}
                    </Button>
                    <Button
                      variant={variant}
                      surface="raised"
                      onPress={() => {
                        close();
                        move(to);
                      }}
                    >
                      {label}
                    </Button>
                  </DialogActions>
                </>
              )}
            </Dialog>
          );
        })}
      </div>
    </div>
  );
}
