"use client";

import { useEffect, useId, useRef, useState, useTransition } from "react";
import { type ContentStatus, statusMoves } from "@/domain/admin/structure";
import { courseEditor as words, structure } from "@/messages/admin";
import { Button, Dialog, DialogActions, Notice } from "@/ui";
import type { AdminAction } from "../types";
import { settle, structureFailureText } from "./structure-controls";

// The Status of a course (docs/spec/03-experience.md section 7.3, FR-ADM-03,
// FR-ADM-09): what it is now, who can see it, and the moves the content
// system allows from there (docs/spec/04-content-system.md section 4.3).
// Taking a published course off the site and archiving ask first and say
// what learners will see. A course with no published lesson cannot be
// published: the database refuses it, and the reason is shown.

export type SetCourseStatusInput = { id: string; loadedAt: string; status: ContentStatus };
export type SetCourseStatus = AdminAction<SetCourseStatusInput, { updatedAt: string }>;

export type CourseStatusPanelProps = {
  courseId: string;
  status: ContentStatus;
  loadedAt: string;
  setStatus: SetCourseStatus;
  onChanged: (status: ContentStatus, updatedAt: string) => void;
};

/** Leaving the site, or archiving, is asked about first. */
const asks = (from: ContentStatus, to: ContentStatus) =>
  to === "archived" || (from === "published" && to === "draft");

export function CourseStatusPanel({
  courseId,
  status,
  loadedAt,
  setStatus,
  onChanged,
}: CourseStatusPanelProps) {
  const [failure, setFailure] = useState<string | null>(null);
  const [stale, setStale] = useState(false);
  const [changed, setChanged] = useState<ContentStatus | null>(null);
  const [pending, startTransition] = useTransition();
  const courseStatusId = useId();
  // The pressed button is gone after a move, so focus goes to the sentence
  // that says the new status.
  const statusLine = useRef<HTMLParagraphElement>(null);
  const focusStatus = useRef(false);
  useEffect(() => {
    if (!focusStatus.current) return;
    focusStatus.current = false;
    statusLine.current?.focus();
  }, [status]);

  function move(to: ContentStatus) {
    setFailure(null);
    setStale(false);
    setChanged(null);
    startTransition(async () => {
      const outcome = await settle(() => setStatus({ id: courseId, loadedAt, status: to }));
      if (!outcome.ok) {
        setStale(outcome.error === "stale");
        setFailure(structureFailureText(outcome.error));
        return;
      }
      setChanged(to);
      focusStatus.current = true;
      onChanged(to, outcome.value.updatedAt);
    });
  }

  return (
    <div role="group" aria-labelledby={courseStatusId} className="flex max-w-prose flex-col gap-4">
      <h2 id={courseStatusId} className="text-lg font-semibold text-text">
        {words.statusHeading}
      </h2>
      <p ref={statusLine} tabIndex={-1} className="text-base text-text">
        {words.statusNow(words.statusName[status])} {words.statusExplain[status]}
      </p>
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
        {pending
          ? words.changingStatus
          : changed === null
            ? ""
            : words.statusChanged(words.statusName[changed])}
      </p>
      <div className="flex flex-wrap gap-3">
        {statusMoves(status).map((to) => {
          const variant = to === "archived" ? "destructive" : "secondary";
          const label = words.statusAction[to];
          if (!asks(status, to)) {
            return (
              <Button key={to} variant={variant} isPending={pending} onPress={() => move(to)}>
                {label}
              </Button>
            );
          }
          const title =
            to === "archived" ? words.confirmStatusTitle.archived : words.confirmStatusTitle.draft;
          const body =
            to === "archived" ? words.confirmStatusBody.archived : words.confirmStatusBody.draft;
          return (
            <Dialog
              key={to}
              title={title}
              trigger={
                <Button variant={variant} isPending={pending}>
                  {label}
                </Button>
              }
            >
              {(close) => (
                <>
                  <p className="text-base text-text">{body}</p>
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
                      {words.statusAction[to]}
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
