"use client";

import { useRouter } from "next/navigation";
import { useCallback, useId, useState } from "react";
import type { ContentStatus } from "@/domain/admin/structure";
import { courseEditor as words } from "@/messages/admin";
import type { EditorCourse } from "../types";
import { type ChapterActions, ChapterList } from "./chapter-list";
import { CourseDetailsForm, type SaveCourse } from "./course-details-form";
import { CourseStatusPanel, type SetCourseStatus } from "./course-status";
import { useLeaveWarning } from "./leave-warning";

// The course editor (docs/spec/03-experience.md section 7.3): Details,
// Status and Structure of one course. The details and the status share the
// version the editor loaded, so either is refused once the course was
// changed somewhere else (FR-ADM-10), and each successful save moves it on.
// While the details or a chapter form hold unsaved text, leaving asks once.

export type CourseEditorProps = ChapterActions & {
  course: EditorCourse;
  saveCourse: SaveCourse;
  setStatus: SetCourseStatus;
  /** Reads the course again. The router's refresh by default. */
  refresh?: () => void;
};

export function CourseEditor({
  course,
  saveCourse,
  setStatus,
  saveChapter,
  deleteChapter,
  reorder,
  createLesson,
  refresh,
}: CourseEditorProps) {
  const router = useRouter();
  const reread = refresh ?? (() => router.refresh());
  // The version this page loaded, moved on only by this page's own saves.
  const [loadedAt, setLoadedAt] = useState(course.loadedAt);
  const [status, setStatusNow] = useState<ContentStatus>(course.status);
  const courseDetailsId = useId();
  const [detailsUnsaved, setDetailsUnsaved] = useState(false);
  const [chaptersUnsaved, setChaptersUnsaved] = useState(false);
  useLeaveWarning(detailsUnsaved || chaptersUnsaved, words.unsavedWarning);
  const onDetailsUnsaved = useCallback((unsaved: boolean) => setDetailsUnsaved(unsaved), []);
  const onChaptersUnsaved = useCallback((unsaved: boolean) => setChaptersUnsaved(unsaved), []);

  return (
    <div className="flex flex-col gap-7">
      <section aria-labelledby={courseDetailsId} className="flex flex-col gap-4">
        <h2 id={courseDetailsId} className="text-lg font-semibold text-text">
          {words.detailsHeading}
        </h2>
        <CourseDetailsForm
          course={{ id: course.id, loadedAt }}
          initial={course}
          save={saveCourse}
          onUnsavedChange={onDetailsUnsaved}
          onSaved={(updatedAt) => {
            setLoadedAt(updatedAt);
            reread();
          }}
        />
      </section>
      <CourseStatusPanel
        courseId={course.id}
        status={status}
        loadedAt={loadedAt}
        setStatus={setStatus}
        onChanged={(next, updatedAt) => {
          setStatusNow(next);
          setLoadedAt(updatedAt);
          reread();
        }}
      />
      <ChapterList
        courseId={course.id}
        chapters={course.chapters}
        saveChapter={saveChapter}
        deleteChapter={deleteChapter}
        createLesson={createLesson}
        reorder={reorder}
        refresh={reread}
        onUnsavedChange={onChaptersUnsaved}
      />
    </div>
  );
}
