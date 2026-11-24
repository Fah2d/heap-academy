// The profile (docs/spec/03-experience.md section 5.5). Every number shown
// comes from the learner's own completions.

export const profile = {
  title: "Profile",
  heading: "Profile",
  xp: "XP earned",
  xpValue: (xp: number) => `${String(xp)} XP`,
  currentStreak: "Current streak",
  longestStreak: "Longest streak",
  days: (count: number) => (count === 1 ? "1 day" : `${String(count)} days`),
  empty: "You have not completed a lesson yet. Pass a lesson's tests to earn XP.",
  coursesLink: "See the courses",
} as const;
