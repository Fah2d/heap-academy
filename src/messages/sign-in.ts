// The words of the sign-in page and the account control
// (docs/spec/03-experience.md sections 4, 5.4 and 8).
export const signIn = {
  title: "Sign in",
  intro: "Sign in to keep your progress on every device. You can learn without an account.",
  /** The accessible name of Google's button, whose image says the same words. */
  google: "Sign in with Google",
  googleFailed:
    "Google sign-in did not finish. Try again, or sign in with a code sent to your email.",
  googleUnavailable:
    "Google sign-in is not working right now. Sign in with a code sent to your email instead.",
  inAppBrowser:
    "Google does not allow sign-in inside this app's browser. Sign in with a code sent to your email instead.",
  showGoogle: "Show Google sign-in anyway",
  emailHeading: "Sign in with an email code",
  emailLabel: "Email address",
  emailDescription: "We send a six-digit code to this address. There is no password.",
  emailInvalid: "Enter an email address, like name@example.com.",
  sendCode: "Send code",
  sending: "Sending code",
  challengeLoading: "Loading a check that keeps automated sign-ups out.",
  challengeNotLoaded:
    "The check that keeps automated sign-ups out did not load. Reload the page, then try again.",
  challengeFailed: "The check that keeps automated sign-ups out did not pass. Try again.",
  challengeNeeded: "Wait for the check below the field to finish, then send the code.",
  sendRateLimited: "Too many codes were asked for. Wait a few minutes, then try again.",
  unavailable: "Sign-in is not working right now. Try again in a few minutes.",
  codeHeading: "Enter your code",
  codeSentTo: (email: string) => `We sent a six-digit code to ${email}. It works for 10 minutes.`,
  codeLabel: "Six-digit code",
  codeInvalid: "Enter the six digits from the email.",
  verify: "Sign in",
  verifying: "Checking code",
  codeRejected:
    "That code did not work. It may be mistyped or older than 10 minutes. Check the email, or ask for a new code.",
  tooManyAttempts: "Too many tries. Wait a few minutes, then ask for a new code.",
  resend: "Send a new code",
  resendWait: (seconds: number) =>
    `You can ask for a new code in ${seconds} ${seconds === 1 ? "second" : "seconds"}.`,
  resent: "A new code is on its way. Use the newest email.",
  changeEmail: "Use a different email",
  errorLabel: "Error",
  informationLabel: "Note",
  successLabel: "Done",
} as const;

export const account = {
  signIn: "Sign in",
  signOut: "Sign out",
  signingOut: "Signing out",
} as const;
