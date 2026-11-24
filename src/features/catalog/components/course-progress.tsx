"use client";

import { createContext, type ReactNode, useContext } from "react";
import { type CourseStanding, courseStanding, type LessonState } from "@/domain/course-progress";
import { useDeviceCompletions } from "@/features/progress";
import { catalogCommon, coursePage as words } from "@/messages/catalog";
import { Link, type LinkVariant, Status, type StatusState } from "@/ui";
import { lessonPath } from "../paths";

// The learner's progress on the course list and the course page (FR-CAT-02,
// FR-CRS-02). It is read from this device in the browser
// (docs/spec/02-architecture.md section 10). Until the device answers, the
// page is drawn as for a learner with nothing completed, except that no
// count and no lesson state is claimed: the action begins the course, which
// is a real place to go for everyone.

type Lesson = { id: string; slug: string };

type Known = { standing: CourseStanding<Lesson>; known: boolean };

function useStanding(lessons: readonly Lesson[]): Known {
  const completed = useDeviceCompletions();
  return {
    standing: courseStanding(lessons, completed ?? new Set()),
    known: completed !== undefined,
  };
}

const CourseContext = createContext<Known | undefined>(undefined);

function useCourse(): Known {
  const value = useContext(CourseContext);
  if (value === undefined) throw new Error("course progress: outside CourseProgress");
  return value;
}

/** Reads the device once for one course page; its action and lesson marks share the answer. */
export function CourseProgress({
  lessons,
  children,
}: {
  lessons: readonly Lesson[];
  children: ReactNode;
}) {
  return <CourseContext.Provider value={useStanding(lessons)}>{children}</CourseContext.Provider>;
}

function ActionLink({
  course,
  standing,
  variant,
}: {
  course: string;
  standing: CourseStanding<Lesson>;
  variant: LinkVariant;
}) {
  if (standing.target === undefined) return null;
  return (
    <Link href={lessonPath(course, standing.target.slug)} variant={variant}>
      {catalogCommon.action[standing.action]}
    </Link>
  );
}

/** The course page's primary action: begin, continue or review. */
export function CourseAction({ course }: { course: string }) {
  return <ActionLink course={course} standing={useCourse().standing} variant="action" />;
}

/** The count of completed lessons, shown once the device has answered. */
export function CourseCount() {
  const { standing, known } = useCourse();
  if (!known) return null;
  return (
    <p className="text-xs text-text-muted tabular-nums">
      {catalogCommon.progress(standing.completed, standing.total)}
    </p>
  );
}

const STATUS: Record<LessonState, StatusState> = {
  completed: "pass",
  next: "next",
  open: "not-run",
};

/** One lesson row's state in an icon and a word, once the device has answered. */
export function LessonMark({ index }: { index: number }) {
  const { standing, known } = useCourse();
  const state = standing.states[index];
  if (!known || state === undefined) return null;
  return <Status state={STATUS[state]} label={words.lessonState[state]} />;
}

/** A course row's count and its one action, for the course list and the home page. */
export function CourseRowProgress({
  course,
  lessons,
}: {
  course: string;
  lessons: readonly Lesson[];
}) {
  const { standing, known } = useStanding(lessons);
  return (
    <div className="flex flex-wrap items-center justify-between gap-x-5 gap-y-2">
      <p className="text-xs text-text-muted tabular-nums">
        {known
          ? catalogCommon.progress(standing.completed, standing.total)
          : catalogCommon.lessonCount(standing.total)}
      </p>
      <ActionLink course={course} standing={standing} variant="standalone" />
    </div>
  );
}
