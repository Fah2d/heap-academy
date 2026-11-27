"use client";

import { createContext, type ReactNode, useContext } from "react";
import { type CourseStanding, courseStanding, type LessonState } from "@/domain/course-progress";
import { totalXp } from "@/domain/streak";
import { useDeviceCompletions } from "@/features/progress";
import { catalogCommon, coursePage as words } from "@/messages/catalog";
import { Link, type LinkVariant, Status, type StatusState } from "@/ui";
import { lessonPath } from "../paths";

// The learner's progress on the course list and the course page (FR-CAT-02,
// FR-CRS-02; docs/spec/02-architecture.md section 10). A signed-in learner's
// page arrives with the account's lessons. A guest's is filled in from this
// device: until it answers, the page claims no count and no lesson state, and
// the action begins the course, which is a real place to go for everyone.

type Lesson = { id: string; slug: string };

type Known = { standing: CourseStanding<Lesson>; known: boolean };

function useStanding(lessons: readonly Lesson[]): Known {
  const completed = useDeviceCompletions();
  return {
    standing: courseStanding(lessons, completed ?? new Set()),
    known: completed !== undefined,
  };
}

type CourseKnown = Known & { xp: { earned: number; total: number } };

const CourseContext = createContext<CourseKnown | undefined>(undefined);

function useCourse(): CourseKnown {
  const value = useContext(CourseContext);
  if (value === undefined) throw new Error("course progress: outside CourseProgress");
  return value;
}

/** Reads the device once for one course page; its action and lesson marks share the answer. */
export function CourseProgress({
  lessons,
  children,
}: {
  lessons: readonly (Lesson & { xp: number })[];
  children: ReactNode;
}) {
  const { standing, known } = useStanding(lessons);
  // The XP each completed lesson carries now (FR-CRS-05).
  const xp = {
    earned: totalXp(lessons.filter((_, index) => standing.states[index] === "completed")),
    total: totalXp(lessons),
  };
  return (
    <CourseContext.Provider value={{ standing, known, xp }}>{children}</CourseContext.Provider>
  );
}

function ActionLink({
  course,
  standing,
  variant,
  title,
}: {
  course: string;
  standing: CourseStanding<Lesson>;
  variant: LinkVariant;
  /** The course's title, for a screen reader, where several courses each have an action. */
  title?: string;
}) {
  if (standing.target === undefined) return null;
  return (
    <Link href={lessonPath(course, standing.target.slug)} variant={variant}>
      {catalogCommon.action[standing.action]}
      {title !== undefined && <span className="sr-only">{catalogCommon.actionCourse(title)}</span>}
    </Link>
  );
}

/** The course page's primary action: begin, continue or review. */
export function CourseAction({ course }: { course: string }) {
  return <ActionLink course={course} standing={useCourse().standing} variant="action" />;
}

/** Lessons completed and XP earned of total (FR-CRS-05), once the device has answered. */
export function CourseCount() {
  const { standing, known, xp } = useCourse();
  if (!known) return null;
  return (
    <div className="flex flex-col gap-1 text-xs text-text-muted tabular-nums">
      <p>{catalogCommon.progress(standing.completed, standing.total)}</p>
      <p>{words.xpEarned(xp.earned, xp.total)}</p>
    </div>
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

/**
 * One lesson row of the course page. The next lesson is the current item, and
 * carries DESIGN.md's marker: a 2 px amber inline-start border, weight 600,
 * and `aria-current`. A border, so it still shows in forced-colors mode.
 */
export function LessonRow({ index, children }: { index: number; children: ReactNode }) {
  const { standing, known } = useCourse();
  const current = known && standing.states[index] === "next";
  return (
    <li
      aria-current={current ? "step" : undefined}
      className={
        current
          ? "flex flex-wrap items-center gap-x-3 border-bs border-s-(length:--marker-width) border-border border-s-action py-1 ps-3 text-base font-semibold text-text last:pbe-0"
          : "flex flex-wrap items-center gap-x-3 border-bs border-border py-1 ps-(--marker-indent) text-base text-text last:pbe-0"
      }
    >
      {children}
    </li>
  );
}

/** A course row's count and its one action, for the course list and the home page. */
export function CourseRowProgress({
  course,
  title,
  lessons,
}: {
  course: string;
  title: string;
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
      <ActionLink course={course} standing={standing} variant="standalone" title={title} />
    </div>
  );
}
