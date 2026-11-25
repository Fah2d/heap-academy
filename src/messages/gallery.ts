// The development-only page that shows every primitive in every state
// (WP-1.4). The examples are written as they would read in the product.
export const gallery = {
  title: "Primitives",
  intro:
    "Every primitive in every state that can be shown without a pointer. To see hover, press, and focus, point at a control or move to it with the Tab key.",

  buttons: "Buttons",
  rest: "At rest",
  disabled: "Disabled",
  withIcon: "With an icon",
  fullWidth: "Full width, as on a phone",
  check: "Check",
  run: "Run",
  deleteTestCase: "Delete test case",

  links: "Links",
  inlineBefore: "Each link on this page leads to a section of it, such as the",
  inlineLink: "text fields",
  inlineAfter: "further down.",
  standaloneVariant: "Standalone link",
  standaloneLink: "Go to the notices",
  headingVariant: "Heading link, such as a course title in a list",
  headingLink: "Go to the dialog",
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
export const adminPreviewGallery = { title: "Admin preview" };

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
  lessonEditor:
    "Lesson editor of a draft whose saves and status changes succeed and whose preview renders",
  lessonRefusing:
    "Lesson editor whose save is refused (changed somewhere else), whose status change is refused and whose preview fails",
  lessonPublished: "Lesson editor of a published lesson whose save and status change never answer",
  lessonArchived: "Lesson editor of an archived lesson, with Move back to draft",
  lessonEmpty:
    "Lesson editor of a new lesson with no instructions, code, wrong answers or test cases",
  lessonTestCasesFull:
    "Lesson editor with 12 test cases, so Add a test case and Duplicate are gone",
  lessonTestCaseProblem:
    "Lesson editor with a test case that has no name and an expected output over the limit",
  lessonPythonLoading:
    "Lesson editor while Python loads: Validate waits for it until Stop is pressed",
  lessonPythonFailed: "Lesson editor whose Python could not start, with Try again",
  lessonValidating: "Lesson editor whose validation never ends, to show Validating and Stop",
  lessonPythonCannotRun:
    "Lesson editor whose Python started but could not run the programs, so Validate checked nothing",
  lessonValidationFailed:
    "Lesson editor whose second test case expects the greeting without the prompt, so the solution fails it and Fill from solution is offered",
  lessonSaveValidating:
    "Lesson editor of a published lesson whose validation never ends: Save validates first, and Stop saves nothing",
  lessonSavePythonFailed:
    "Lesson editor of a published lesson whose Python could not start, so Save saves nothing",
  lessonSavePythonCannotRun:
    "Lesson editor of a published lesson whose Python started but could not run the programs, so Save saves nothing",
  lessonSaveRuleFailed:
    "Lesson editor of a published lesson whose solution fails the second test case, so Save saves nothing",
  lessonOddResults:
    "Lesson editor whose solution prints color codes, stops with an error on line 2, and prints past the output limit, and whose starter reaches the time limit",
  oddTestName3: "Greets Sara many times",
  oddColoredOutput: "\u001b[31mWhat is your name? Hello, Sara!\u001b[0m\n",
  oddErrorMessage: "NameError: name 'nme' is not defined",
  oddRepeatedLine: "Hello, Sara!\n",
  samplePromptOnly: "What is your name? \n",
  wrongExpected: "Hello, Omar!",
  extraTestName: (n: number) => `Works for name ${String(n)}`,
  extraTestInput: (n: number) => `Name ${String(n)}\n`,
  extraTestExpected: (n: number) => `What is your name? Hello, Name ${String(n)}!`,
  lessonFull:
    "Lesson editor with three wrong answers, so Add a wrong answer is gone, whose save fails",
  lessonTaken: "Lesson editor whose address is taken by another lesson",
  lessonTooLong: "Lesson editor whose starter is over the limit",
  lessonContent:
    "A lesson's instructions as learners and the preview show them: a Python block with Copy code, a table, a quote and a link",
  secondLesson: "Second lesson",
  sampleWrongLabel2: "Prints the prompt again",
  sampleWrongCode2: 'name = input("What is your name? ")\nprint("What is your name?")\n',
  sampleWrongLabel3: "Forgets the exclamation mark",
  sampleWrongCode3: 'name = input("What is your name? ")\nprint(f"Hello, {name}")\n',
  contentHeading: "Read a name",
  contentText: "The program waits until the learner presses Enter.",
  contentCodeName: "name",
  contentCodeAssign: " = ",
  contentCodeInput: "input",
  contentCodeOpen: "(",
  contentCodePrompt: '"What is your name? "',
  contentCodeClose: ")",
  contentCodeComment: "  # waits for Enter",
  tableFunction: "Function",
  tableReturns: "Returns",
  tableInput: "input()",
  tableInputReturns: "The typed text, as a string",
  tableLen: "len()",
  tableLenReturns: "How many items there are",
  contentQuote: "input() always returns a string, even when the learner types a number.",
  contentLinkBefore: "More in the ",
  contentLink: "Python documentation for input()",
  sampleInstructions:
    "## Ask, then answer\n\nAsk for a name with `input()`, then greet that person.",
  sampleHint: "input() returns what the learner typed.",
  sampleStarter: "# Ask for a name, then greet that person.\n",
  sampleSolution: 'name = input("What is your name? ")\nprint(f"Hello, {name}!")\n',
  sampleWrongLabel: "Greets without the name",
  sampleWrongCode: 'input("What is your name? ")\nprint("Hello!")\n',
  sampleTestName: "Greets Sara by name",
  sampleTestInput: "Sara\n",
  sampleTestExpected: "What is your name? Hello, Sara!",
  sampleTestName2: "Works for a different name",
  sampleTestInput2: "Omar\n",
  sampleTestExpected2: "What is your name? Hello, Omar!",
  previewHeading: "Ask, then answer",
  previewText: "Ask for a name with ",
  previewCode: "input()",
  previewTail: ", then greet that person.",
} as const;

// The development-only workspace page (WP-5.2): the example lesson of
// docs/spec/04-content-system.md section 7 in the real workspace, with no
// database, for the browser journeys J-2, J-3 and J-4.
export const workspaceGallery = {
  title: "Workspace",
  courseSlug: "python-basics",
  courseTitle: "Python basics",
  lessonSlug: "say-hello",
  previous: { slug: "print-a-line", title: "Print a line" },
  next: { slug: "add-two-numbers", title: "Add two numbers" },
};

// The development-only page that shows the catalog's states that the local
// stack cannot show on demand: no course, and sample content (WP-5.1).
export const catalogGallery = {
  title: "Catalog states",
  intro:
    "The home page's, the course list's and the course page's states that need an empty database or content the local stack does not have. Each link opens one state as its whole page. The courses are sample content, not published ones. A read that fails ends on the error page, shown at /dev/error.",
  homeEmpty: "Home page with no course",
  listEmpty: "Course list with no course",
  listRows: "Course list with courses, one with the longest title the dashboard allows",
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
