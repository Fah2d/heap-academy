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
  coursesHeading: "Your courses",
  accountHeading: "Account",
  changeName: "Change name",
  nameLabel: "Display name",
  saveName: "Save name",
  savingName: "Saving",
  cancel: "Cancel",
  nameProblem: {
    empty: "Enter a name.",
    too_long: "Use 40 characters or fewer.",
    not_allowed: "Use letters, numbers, or symbols on one line.",
  },
  errorLabel: "Error",
  saveFailed: "We could not save your name. Try again.",
  signedOut: "Your sign-in has ended. Sign in again to change your name.",
} as const;
