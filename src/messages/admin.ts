// The words of the admin area (docs/spec/03-experience.md section 7;
// FR-ADM-01, FR-ADM-02). Strangers never see any of them: every `/admin`
// address answers them with the standard not-found page.

export const adminArea = {
  narrowScreen:
    "The dashboard is made for screens at least 1024 pixels wide. Open it on a larger screen.",
} as const;

export const secondStep = {
  setupTitle: "Set up your authenticator app",
  setupIntro:
    "The dashboard asks for a code from an authenticator app at the start of every session. Add Heap Academy to your app once.",
  scanHeading: "1. Add Heap Academy to your app",
  qrAlt: "QR code to add Heap Academy to an authenticator app",
  scanHint: "Scan the QR code with your authenticator app.",
  manualKeyLabel: "Or enter this key by hand",
  codeHeading: "2. Enter the code your app shows",
  confirm: "Finish setup",
  setupUnavailable: "The QR code could not be made right now. Reload the page in a few minutes.",
  verifyTitle: "Enter your authenticator code",
  verifyIntro: "Open your authenticator app and enter the code it shows for Heap Academy.",
  verify: "Continue",
  checking: "Checking code",
  codeLabel: "Six-digit code",
  codeInvalid: "Enter the six digits from your app.",
  codeRejected:
    "That code did not work. A code changes every 30 seconds: enter the one your app shows now.",
  tooManyAttempts: "Too many tries. Wait a minute, then enter a new code.",
  setupReplaced:
    "This setup was replaced, perhaps in another tab. Reload the page for a new QR code.",
  unavailable: "The second sign-in step is not working right now. Try again in a few minutes.",
  errorLabel: "Error",
} as const;

export const dashboard = {
  title: "Courses",
  empty: "There are no courses yet.",
  loadFailed: "The courses could not be loaded. Reload the page to try again.",
  tableCaption: "Every course, with its status and lessons",
  columnCourse: "Course",
  columnStatus: "Status",
  columnPublished: "Published lessons",
  columnDrafts: "Draft lessons",
  status: { draft: "Draft", published: "Published", archived: "Archived" },
  errorLabel: "Error",
} as const;
