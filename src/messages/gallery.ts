// The development-only page that shows every primitive in every state
// (WP-1.4). The examples are written as they would read in the product.
export const gallery = {
  title: "Primitives",
  intro:
    "Every primitive in every state that can be shown without a pointer. To see hover, press, and focus, point at a control or move to it with the Tab key.",

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
  standaloneVariant: "Standalone link",
  standaloneLink: "Go to the notices",
  navVariant: "Navigation, the first link current",
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
  // The Python runtime's transfer size with Brotli (docs/spec/09-evidence.md, E-02).
  progressEmpty: "0 of 5.5 MB",
  progressPart: "2.7 of 5.5 MB",
  progressFull: "5.5 of 5.5 MB",

  status: "Test case states",
  passed: "Passed",
  failed: "Failed",
  notRun: "Not run",
} as const;

// The development-only page that shows the admin area's states the J-12
// journey cannot reach on the local stack (WP-2.3).
export const adminGallery = {
  title: "Admin states",
  intro:
    "The dashboard's and the second step's states that the sign-in journey cannot reach. The actions here are fakes that answer at once, or never.",
  courseListEmpty: "Course list with no course",
  courseListFailed: "Course list that could not load",
  courseListRows: "Course list with courses",
  sampleCourse: "Sample course",
  secondCourse: "Second course",
  sampleSummary: "A first look at Python, one short program at a time.",
  sampleChapter: "First chapter",
  secondChapter: "Second chapter",
  sampleLesson: "Sample lesson",
  editorRefusing:
    "Course editor whose changes are refused: Publish (no published lesson), Save details (changed somewhere else), and the order (changed meanwhile)",
  editorEmpty: "Course editor of a draft course with no chapter",
  newCourse: "New course form, whose create never answers",
  newCourseTaken: "New course form whose address is taken",
  editorPublished:
    "Course editor of a published course whose saves never answer: the saving and changing states, rename, and the questions before archiving and deleting",
  editorSaving: "Course editor whose saves succeed",
  editorFailed: "Course editor whose course could not load",
  setupFailed: "Setup whose QR code could not be made",
  codeLimited: "Code form after too many tries",
  codeChecking: "Code form while a code is checked",
} as const;

// The development-only page that shows the catalog's states that the local
// stack cannot show on demand: no course, and a read that failed (WP-5.1).
export const catalogGallery = {
  title: "Catalog states",
  intro:
    "The course list's and the course page's states that need an empty or a failing database. The rows are sample content, not published courses.",
  listEmpty: "Course list with no course",
  listFailed: "Course list that could not load",
  listRows: "Course list with courses, one with the longest title the dashboard allows",
  courseFailed: "Course page that could not load",
  courseNoOutcomes: "Course page with no outcomes, one chapter with no summary",
  sampleCourse: "Python basics",
  sampleSummary: "Print text, keep values in names, and do sums.",
  longCourse: "Reading and writing text files, one careful line at a time",
  longSummary:
    "Open a file, read it line by line, and write what you found to a new file without losing a word.",
  firstChapter: "First steps",
  firstChapterSummary: "Your first program, and what print does.",
  secondChapter: "Numbers and the arithmetic you already know from school",
  lessonHello: "Say hello",
  lessonNames: "Keep a value in a name",
  lessonSums: "Add two numbers that someone typed",
} as const;
