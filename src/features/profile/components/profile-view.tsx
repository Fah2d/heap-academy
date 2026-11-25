import type { ComponentProps, ReactNode } from "react";
import { catalogCommon } from "@/messages/catalog";
import { profile as words } from "@/messages/profile";
import { Link } from "@/ui";
import type { CourseProgressRow, ProfileSummary } from "../server/profile";
import { DisplayName } from "./display-name";

/** The profile's content (docs/spec/03-experience.md section 5.5; FR-PRF-01). */
export function ProfileView({
  summary,
  courses,
  coursePath,
  updateProfile,
  signOut,
}: {
  summary: ProfileSummary;
  courses: readonly CourseProgressRow[];
  coursePath: (slug: string) => string;
  signOut: ReactNode;
  updateProfile: ComponentProps<typeof DisplayName>["updateProfile"];
}) {
  const numbers = [
    [words.xp, words.xpValue(summary.xp)],
    [words.currentStreak, words.days(summary.currentStreak)],
    [words.longestStreak, words.days(summary.longestStreak)],
  ] as const;
  return (
    <div className="mx-auto flex max-inline-page flex-col gap-5 px-gutter py-7">
      <div className="flex flex-col gap-1">
        <h1 className="text-xl font-semibold text-text">{words.heading}</h1>
        <DisplayName name={summary.displayName} updateProfile={updateProfile} />
      </div>
      {/* DESIGN.md: XP and streak numerals at --text-2xl, tabular. */}
      <dl className="flex flex-wrap gap-x-7 gap-y-4">
        {numbers.map(([label, value]) => (
          <div key={label} className="flex flex-col gap-1">
            <dt className="text-sm text-text-muted">{label}</dt>
            <dd className="text-2xl font-semibold text-text tabular-nums">{value}</dd>
          </div>
        ))}
      </dl>
      {summary.lessons === 0 && (
        <div className="flex flex-col items-start gap-2">
          <p className="max-inline-prose text-base text-text">{words.empty}</p>
          <Link href="/courses" variant="standalone">
            {words.coursesLink}
          </Link>
        </div>
      )}
      {courses.length > 0 && (
        <section className="flex flex-col gap-3">
          <h2 className="text-lg font-semibold text-text">{words.coursesHeading}</h2>
          <ul className="flex flex-col gap-3">
            {courses.map((course) => (
              <li key={course.slug} className="flex flex-col items-start gap-1">
                <Link href={coursePath(course.slug)} variant="standalone">
                  {course.title}
                </Link>
                <p className="text-sm text-text-muted tabular-nums">
                  {catalogCommon.progress(course.completed, course.total)}
                </p>
              </li>
            ))}
          </ul>
        </section>
      )}
      <section className="flex flex-col items-start gap-3">
        <h2 className="text-lg font-semibold text-text">{words.accountHeading}</h2>
        {signOut}
      </section>
    </div>
  );
}
