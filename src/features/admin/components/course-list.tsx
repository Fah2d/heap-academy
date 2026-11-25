"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { adminCoursePath, ADMIN_NEW_COURSE_PATH } from "@/domain/admin/gate";
import { dashboard as words, structure } from "@/messages/admin";
import { Link, Notice } from "@/ui";
import type { AdminAction, AdminCourses, MoveDirection, ReorderInput } from "../types";
import { focusMoved, MoveButtons, settle, structureFailureText } from "./structure-controls";

export type CourseListProps = {
  result: AdminCourses;
  reorder: AdminAction<ReorderInput, null>;
  /** Reads the list again after a move. The router's refresh by default. */
  refresh?: () => void;
};

/**
 * The course list of `/admin` (docs/spec/03-experience.md section 7.2): every
 * course with its status and its published and draft lessons, in the order
 * the site shows them, with New course, a link to each course's editor, and
 * Move up and Move down. A sentence takes the table's place when there is no
 * course or the list could not load.
 */
export function CourseList({ result, reorder, refresh }: CourseListProps) {
  const router = useRouter();
  const reread = refresh ?? (() => router.refresh());
  const [failure, setFailure] = useState<string | null>(null);
  const [moved, setMoved] = useState(false);
  const [pending, startTransition] = useTransition();
  const table = useRef<HTMLTableElement>(null);
  const lastMove = useRef<{ id: string; direction: MoveDirection } | null>(null);

  // The rows arrive in their new order after the refresh.
  useEffect(() => {
    if (lastMove.current === null) return;
    focusMoved(table.current, lastMove.current.id, lastMove.current.direction);
    lastMove.current = null;
  }, [result]);

  function onMove(id: string, direction: MoveDirection) {
    setFailure(null);
    setMoved(false);
    startTransition(async () => {
      const outcome = await settle(() => reorder({ kind: "course", id, direction }));
      if (!outcome.ok) {
        setFailure(structureFailureText(outcome.error));
        return;
      }
      lastMove.current = { id, direction };
      setMoved(true);
      reread();
    });
  }

  const newCourse = (
    <div>
      <Link href={ADMIN_NEW_COURSE_PATH} variant="action">
        {words.newCourse}
      </Link>
    </div>
  );

  if (!result.ok) {
    return (
      <Notice kind="error" kindLabel={words.errorLabel}>
        {words.loadFailed}
      </Notice>
    );
  }
  if (result.courses.length === 0) {
    return (
      <div className="flex flex-col gap-4">
        <p className="max-w-prose text-base text-text-muted">{words.empty}</p>
        {newCourse}
      </div>
    );
  }
  const cell = "border-b border-border px-3 py-2 text-start";
  const last = result.courses.length - 1;
  return (
    <div className="flex flex-col gap-4">
      {newCourse}
      {failure !== null && (
        <Notice kind="error" kindLabel={structure.errorLabel} announce="assertive">
          {failure}
        </Notice>
      )}
      <p role="status" className="sr-only">
        {moved ? structure.moved : ""}
      </p>
      <table ref={table} className="w-full border-collapse text-sm text-text">
        <caption className="sr-only">{words.tableCaption}</caption>
        <thead>
          <tr className="text-text-muted">
            <th scope="col" className={`${cell} font-medium`}>
              {words.columnCourse}
            </th>
            <th scope="col" className={`${cell} font-medium`}>
              {words.columnStatus}
            </th>
            <th scope="col" className={`${cell} text-end font-medium`}>
              {words.columnPublished}
            </th>
            <th scope="col" className={`${cell} text-end font-medium`}>
              {words.columnDrafts}
            </th>
            <th scope="col" className={`${cell} font-medium`}>
              {words.columnOrder}
            </th>
          </tr>
        </thead>
        <tbody>
          {result.courses.map((course, index) => (
            <tr key={course.id}>
              <th scope="row" className={`${cell} font-medium`}>
                <Link href={adminCoursePath(course.id)} variant="inline">
                  {course.title}
                </Link>
              </th>
              <td className={cell}>{words.status[course.status]}</td>
              <td className={`${cell} text-end tabular-nums`}>{course.publishedLessons}</td>
              <td className={`${cell} text-end tabular-nums`}>{course.draftLessons}</td>
              <td className={cell}>
                <MoveButtons
                  name={course.title}
                  itemId={course.id}
                  isFirst={index === 0}
                  isLast={index === last}
                  isPending={pending}
                  onMove={(direction) => onMove(course.id, direction)}
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
