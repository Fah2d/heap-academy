// The development-only page that shows every primitive in every state
// (WP-1.4). The examples are written as they would read in the product.
export const gallery = {
  title: "Primitives",
  intro:
    "Every primitive in every state that can be shown without a pointer. Hover, press, and focus are shown by moving the pointer or the keyboard over them.",

  buttons: "Buttons",
  rest: "At rest",
  disabled: "Disabled",
  check: "Check",
  run: "Run",
  deleteTestCase: "Delete test case",

  links: "Links",
  inlineBefore: "Each link on this page leads to a section of it, such as the",
  inlineLink: "text fields",
  inlineAfter: "further down.",
  standaloneLink: "Go to the notices",
  navCurrent: "Buttons",
  navOther: "Links",
  navLabel: "Sections of this page",

  textFields: "Text fields",
  emailLabel: "Email address",
  emailPlaceholder: "name@example.com",
  emailDescription: "We send a six-digit code to this address.",
  emailFilled: "learner@example.com",
  emailInvalidValue: "learner.example.com",
  emailError: "Enter an email address with an @ sign, such as name@example.com.",
  invalid: "Invalid",
  readOnly: "Read-only",
  withDescription: "With a description",
  filled: "Filled",

  tabs: "Tabs",
  tabsLabel: "Lesson views",
  tabLesson: "Lesson",
  tabCode: "Code",
  tabOutput: "Output",
  tabLessonBody: "The lesson's instructions appear here.",
  tabCodeBody: "The editor appears here.",
  tabOutputBody: "The console and the tests appear here.",

  dialogs: "Dialog",
  openDialog: "Reset code",
  dialogTitle: "Reset your code?",
  dialogBody: "Your code goes back to the starter code for this lesson. You cannot undo this.",
  dialogConfirm: "Reset code",
  dialogCancel: "Keep my code",

  disclosures: "Disclosures",
  closed: "Closed",
  expanded: "Expanded",
  disclosureTitle: "Test 2: prints the total",
  disclosureBody: "Expected output: 15. Your program printed: 12.",

  notices: "Notices",
  information: "Note",
  informationBody: "Your progress saves on this device until you sign in.",
  warning: "Warning",
  warningBody:
    "This browser cannot pause for input, so the program reads all its answers from the Input field.",
  error: "Error",
  errorBody: "Python could not start. Check your connection, then try again.",
  success: "Done",
  successBody: "Lesson complete.",

  progress: "Progress",
  progressLabel: "Starting Python",
  progressEmpty: "0 of 9.8 MB",
  progressPart: "4.1 of 9.8 MB",
  progressFull: "9.8 of 9.8 MB",

  status: "Test case states",
  passed: "Passed",
  failed: "Failed",
  notRun: "Not run",
} as const;
