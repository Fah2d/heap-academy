import type { ComponentProps } from "react";
import { profile as words } from "@/messages/profile";
import { Link } from "@/ui";
import type { ProfileSummary } from "../server/profile";
import { DisplayName } from "./display-name";

/** The profile's content (docs/spec/03-experience.md section 5.5; FR-PRF-01). */
export function ProfileView({
  summary,
  updateProfile,
}: {
  summary: ProfileSummary;
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
    </div>
  );
}
