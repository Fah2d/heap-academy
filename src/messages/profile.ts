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
  deleteAccount: "Delete my account",
  deleteTitle: "Delete your account?",
  deleteWarning:
    "This erases your account, your completed lessons, your XP, and the code saved with them. It cannot be undone.",
  deleteWord: "DELETE",
  confirmLabel: "Type DELETE to confirm",
  confirmProblem: "Type DELETE in capital letters.",
  deleting: "Deleting",
  deleted: "Your account is deleted.",
  deletedTitle: "Account deleted",
  deletedHome: "Go to the home page",
  deleteSignInAgain:
    "To delete your account, sign out, sign in again, and delete it within 5 minutes.",
  deleteFailed: "We could not delete your account. Try again.",
  deleteSignedOut: "Your sign-in has ended. Sign in again to delete your account.",
} as const;
