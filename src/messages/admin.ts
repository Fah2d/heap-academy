// The words of the admin area (docs/spec/03-experience.md section 7;
// FR-ADM-01, FR-ADM-02). Strangers never see any of them: every `/admin`
// address answers them with the standard not-found page.

export const adminArea = {
  narrowHeading: "The dashboard needs a wider window",
  narrowScreen:
    "The dashboard is made for windows at least 1024 pixels wide. Make the window wider, zoom out, or use a larger screen.",
} as const;

export const secondStep = {
  /** The name the authenticator app shows beside the code. */
  issuer: "Heap Academy",
  setupTitle: "Set up your authenticator app",
  setupIntro:
    "The dashboard asks for a code from an authenticator app at the start of every session. Add Heap Academy to your app once.",
  scanHeading: "1. Add Heap Academy to your app",
  qrAlt: "QR code to add Heap Academy to an authenticator app",
  scanHint: "Scan the QR code with your authenticator app.",
  start: "Show the QR code",
  starting: "Making the QR code",
  startHint:
    "Each press makes a new QR code and replaces any you did not finish, so scan the one on the screen.",
  manualKeyLabel: "Or enter this key by hand",
  codeHeading: "2. Enter the code your app shows",
  confirm: "Finish setup",
  setupUnavailable: "The QR code could not be made right now. Reload the page in a few minutes.",
  verifyTitle: "Enter your authenticator code",
  verifyIntro: "Open your authenticator app and enter the code it shows for Heap Academy.",
  verify: "Check code",
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
  empty:
    "There are no courses yet. Start with New course: give it a title, an address and a summary, then add its chapters.",
  newCourse: "New course",
  columnOrder: "Order",
  loadFailed: "The courses could not be loaded. Reload the page to try again.",
  tableCaption: "Every course, with its status and lessons",
  columnCourse: "Course",
  columnStatus: "Status",
  columnPublished: "Published lessons",
  columnDrafts: "Draft lessons",
  status: { draft: "Draft", published: "Published", archived: "Archived" },
  errorLabel: "Error",
} as const;

/** Words shared by the structure editors (docs/spec/03-experience.md section 7.3). */
export const structure = {
  // The visible words come first, so a voice command that says them matches.
  moveUp: (name: string) => `Move up: ${name}`,
  moveDown: (name: string) => `Move down: ${name}`,
  moveUpShort: "Move up",
  moveDownShort: "Move down",
  errorLabel: "Error",
  savedLabel: "Saved",
  failure: {
    slug_taken: "Another course already uses this address. Choose a different one.",
    stale:
      "This was changed somewhere else after you opened it, so your change was not saved. Reloading shows the newer version and drops what you typed here, so copy anything you want to keep first.",
    no_published_lesson:
      "A course needs at least one published lesson before it can be published. Publish a lesson in this course first.",
    status_not_allowed:
      "The course cannot move to that status from its current one. Reload the page.",
    chapter_has_lessons:
      "This chapter still has lessons. Move or delete them before deleting the chapter.",
    cannot_move: "The order changed since this page loaded. Reload the page and try again.",
    not_found: "The course or chapter you changed no longer exists. Reload the page.",
    unavailable: "The change could not be saved right now. Try again in a minute.",
    invalid_input: "Some of the values were not accepted. Check them and save again.",
  },
  reload: "Reload the page",
  moved: "Order saved.",
} as const;

export const courseEditor = {
  newTitle: "New course",
  metaTitle: "Edit course",
  editTitle: (title: string) => `Course: ${title}`,
  loadFailed: "This course could not be loaded. Reload the page to try again.",
  backToCourses: "All courses",
  detailsHeading: "Details",
  titleLabel: "Title",
  titleHint: "1 to 60 characters.",
  slugLabel: "Address",
  slugHint:
    "Lowercase letters, digits and hyphens, such as python-basics. Learners see it in the course's link.",
  summaryLabel: "Summary",
  summaryHint: "One sentence, at most 140 characters.",
  outcomeLabel: (n: number) => `Outcome ${String(n)} (optional)`,
  outcomesLabel: "Outcomes",
  outcomesHint: "Up to five things a learner will be able to do. Start each with a verb.",
  fieldInvalid: {
    title: "Enter a title of 1 to 60 characters.",
    slug: "Use lowercase letters, digits and single hyphens, up to 60 characters.",
    summary: "Enter one sentence of 1 to 140 characters.",
    outcome: "Keep each outcome to 140 characters.",
  },
  create: "Create course",
  creating: "Creating course",
  save: "Save details",
  saving: "Saving details",
  saved: "Details saved.",
  unsavedWarning: "You have unsaved changes to this course. Leave without saving them?",
  statusHeading: "Status",
  statusNow: (status: string) => `This course is ${status}.`,
  statusAction: { draft: "Move back to draft", published: "Publish", archived: "Archive" },
  statusExplain: {
    draft: "Only admins can see it, in the dashboard.",
    published: "Everyone can see it on the site.",
    archived: "It is gone from the site. Learners keep their completions.",
  },
  statusName: { draft: "a draft", published: "published", archived: "archived" },
  changingStatus: "Changing status",
  statusChanged: (status: string) => `The course is now ${status}.`,
  confirmStatusTitle: {
    draft: "Move this course back to draft?",
    archived: "Archive this course?",
  },
  confirmStatusBody: {
    draft:
      "Learners will no longer see this course or its lessons on the site. Their completions are kept, and publishing it again brings it back.",
    archived:
      "The course and its lessons leave the site. Learners keep their completions. You can move it back to draft later.",
  },
  chaptersHeading: "Chapters",
  chaptersEmpty: "This course has no chapters yet. Add the first one below.",
  chapterLessonsEmpty: "No lessons in this chapter yet.",
  lessonStatus: { draft: "Draft", published: "Published", archived: "Archived" },
  newChapterTitleLabel: "Title of the new chapter",
  newChapterSummaryLabel: "Summary of the new chapter (optional)",
  renameTitleLabel: (title: string) => `New title for ${title}`,
  renameSummaryLabel: (title: string) => `New summary for ${title} (optional)`,
  /** The numbers learners see beside a chapter and a lesson: 2, and 2.3. */
  chapterNumber: (chapter: number) => String(chapter),
  lessonNumber: (chapter: number, lesson: number) => `${String(chapter)}.${String(lesson)}`,
  chapterTitleInvalid: "Enter a chapter title of 1 to 60 characters.",
  addChapterHeading: "Add a chapter",
  addChapter: "Add chapter",
  addingChapter: "Adding chapter",
  rename: "Rename",
  renameChapter: (title: string) => `Rename ${title}`,
  saveChapter: "Save chapter",
  savingChapter: "Saving chapter",
  cancel: "Cancel",
  deleteChapter: (title: string) => `Delete ${title}`,
  deleteShort: "Delete",
  deleteConfirmTitle: "Delete this chapter?",
  deleteConfirmBody: (title: string) =>
    `Deleting removes the chapter "${title}". You cannot undo this.`,
  deleteConfirm: "Delete chapter",
  chapterSaved: "Chapter saved.",
  chapterAdded: "Chapter added.",
  chapterDeleted: "Chapter deleted.",
  chapterLessonsLabel: (title: string) => `Lessons in ${title}`,
} as const;

/** Export and import on the course editor (docs/spec/04-content-system.md section 8; FR-ADM-12). */
export const transfer = {
  heading: "Export and import",
  exportExplain:
    "Export saves this course, with every chapter and lesson, solutions and wrong answers included, as one JSON file.",
  exportCourse: "Export course",
  exporting: "Exporting course",
  exported: (fileName: string) => `Saved as ${fileName}.`,
  exportFailed: "The course could not be exported right now. Try again in a minute.",
  exportBroken:
    "A lesson in this course could not be read, so the course was not exported. Open each lesson to find the one that does not load.",
  importHeading: "Import a lesson",
  importExplain:
    "Import adds one lesson from a JSON file as a draft at the end of the chapter you choose. Nothing in it runs. Publish it like any other lesson, after Validate passes.",
  importNeedsChapter: "Add a chapter before you import a lesson.",
  chapterLabel: "Chapter",
  fileLabel: "Lesson file",
  fileHint: "A .json file in the lesson export format.",
  importLesson: "Import lesson",
  importing: "Importing lesson",
  fileMissing: "Choose a lesson file.",
  fileTooLarge: "This file is too large to be one lesson. Choose a lesson file.",
  fileUnreadable: "This file could not be read. Choose it again.",
  notJson: "This file is not JSON. Choose a lesson file exported from Heap Academy.",
  fieldInvalid: (field: string) =>
    `The lesson was not imported: ${field} is missing or not valid. Fix it in the file and choose it again.`,
  imported: (title: string, chapter: string) =>
    `Imported "${title}" as a draft at the end of ${chapter}.`,
  slugChanged: (slug: string, wanted: string) =>
    `Another lesson in this course uses ${wanted}, so its address is ${slug}.`,
  openLesson: (title: string) => `Open ${title}`,
  failure: {
    invalid_file: "The lesson was not imported. Choose the file again.",
    import_left_draft:
      "The lesson was not imported, and an empty draft with its title may be left at the end of the chapter. Reload the page to check before you try again.",
    chapter_not_found: "That chapter is no longer in this course. Reload the page.",
    not_found: "This course no longer exists. Reload the page.",
    unavailable: "The change could not be saved right now. Try again in a minute.",
    invalid_input: "The lesson was not imported. Choose the file again.",
  },
} as const;

/** The lesson editor (docs/spec/03-experience.md section 7.4). */
export const lessonEditor = {
  metaTitle: "Edit lesson",
  editTitle: (title: string) => `Lesson: ${title}`,
  loadFailed: "This lesson could not be loaded. Reload the page to try again.",
  backToCourse: (course: string) => `Back to ${course}`,
  sectionsLabel: "Sections of this lesson",
  statusNow: { draft: "Draft", published: "Published", archived: "Archived" },
  /** The label of a neutral notice, such as how a published lesson's code changes. */
  noteLabel: "Note",
  statusLabel: "Status",
  unsaved: "Unsaved changes",
  allSaved: "All changes saved",
  save: "Save lesson",
  saving: "Saving lesson",
  saved: "Lesson saved.",
  unsavedWarning: "You have unsaved changes to this lesson. Leave without saving them?",
  detailsHeading: "Details",
  titleLabel: "Title",
  titleHint: "1 to 60 characters.",
  slugLabel: "Address",
  slugHint:
    "Lowercase letters, digits and hyphens, such as ask-then-answer. Unique in this course.",
  chapterLabel: "Chapter",
  chapterHint: "Moving the lesson to another chapter puts it last there.",
  xpLabel: "XP",
  xpHint: "A whole number from 5 to 50. XP already earned does not change.",
  instructionsHeading: "Instructions",
  instructionsLabel: "Instructions in Markdown",
  instructionsHint:
    "Headings of level two and three, emphasis, code, fenced code blocks, lists, tables, quotes and https links. Anything else is dropped. Needed before publishing.",
  previewHeading: "Preview",
  previewDescription: "Exactly as learners will see it.",
  previewEmpty: "Nothing to preview yet. Write the instructions in the Markdown field.",
  previewUpdating: "Updating the preview",
  previewFailed: "The preview could not be updated. It shows the last version that worked.",
  hintsLabel: "Hints",
  hintsHint: "Up to five, each at most 300 characters. Learners reveal them one at a time.",
  hintLabel: (n: number) => `Hint ${String(n)} (optional)`,
  codeHeading: "Code",
  starterLabel: "Starter",
  starterHint: "What the learner sees first. It may be empty.",
  solutionLabel: "Solution",
  solutionHint: "Your correct answer. Only admins ever see it.",
  wrongAnswersLabel: "Wrong answers",
  wrongAnswersHint:
    "Up to three programs a learner might write by mistake. Each must fail at least one test case before the lesson can be published.",
  wrongAnswersEmpty: "No wrong answers yet.",
  wrongAnswerLabel: (n: number) => `Wrong answer ${String(n)}: what the mistake is`,
  wrongAnswerCodeLabel: (n: number) => `Wrong answer ${String(n)}: code`,
  addWrongAnswer: "Add a wrong answer",
  removeWrongAnswer: (n: number) => `Remove wrong answer ${String(n)}`,
  removeShort: "Remove",
  publishedCodeNote:
    "This lesson is published. A change to its starter, solution, wrong answers or test cases is saved only together with a passing validation.",
  testCasesHeading: "Test cases",
  publishHeading: "Publish",
  fieldInvalid: {
    title: "Enter a title of 1 to 60 characters.",
    slug: "Use lowercase letters, digits and single hyphens, up to 60 characters.",
    xp: "Enter a whole number from 5 to 50.",
    instructionsMd: "Keep the instructions to 20,000 characters.",
    hint: "Keep each hint to 300 characters.",
    starterCode: "Keep the starter to 10,000 characters.",
    solutionCode: "Keep the solution to 10,000 characters.",
    wrongAnswerLabel: "Say what the mistake is, in 1 to 80 characters.",
    wrongAnswerCode: "Keep each wrong answer to 10,000 characters.",
  },
  failure: {
    slug_taken: "Another lesson in this course already uses this address. Choose a different one.",
    stale:
      "This lesson was changed somewhere else after you opened it, so your change was not saved. Reloading shows the newer version and drops what you typed here, so copy anything you want to keep first.",
    needs_validation:
      "This lesson is published. A change to its starter, solution, wrong answers or test cases is saved only together with a passing validation, so nothing was saved.",
    published_incomplete:
      "A published lesson needs instructions and at least one test case, so nothing was saved.",
    chapter_not_found: "That chapter is no longer in this course. Reload the page.",
    slug_needed: "Write a title with letters or digits, so the lesson gets an address.",
    not_found: "This lesson no longer exists. Go back to the course.",
    unavailable: "The lesson could not be saved right now. Try again in a minute.",
    invalid_input: "Some of the values were not accepted. Check them and save again.",
  },
  /** Save on a published lesson validates first (section 7.6); why nothing was saved. */
  validateFirst: {
    failed:
      "This lesson is published, so Save validates it first. A rule failed, so nothing was saved. The checklist under Publish says what to fix.",
    stopped:
      "This lesson is published, so Save validates it first. The validation was stopped, so nothing was saved.",
    unavailable:
      "This lesson is published, so Save validates it first. Python could not run the programs, so nothing was saved. Press Save to try again.",
    unavailableStart:
      "This lesson is published, so Save validates it first. Python could not start, so nothing was saved. Press Try again under Publish, then Save.",
  },
} as const;

/** The status of one lesson, in the lesson editor's Publish section (section 7.6; FR-ADM-09). */
export const lessonStatus = {
  heading: "Status",
  now: (status: string) => `This lesson is ${status}.`,
  name: { draft: "a draft", published: "published", archived: "archived" },
  explain: {
    draft: "Only admins can see it, in the dashboard.",
    published: "Learners can open it while its course is published.",
    archived: "It is gone from the site. Learners keep their completions.",
  },
  publishWaits:
    "Publish appears here once every rule above passed for the lesson as it is now in the editor.",
  publishSaves: "Publish saves the lesson as it is in the editor, then puts it on the site.",
  action: { draft: "Move back to draft", published: "Publish", archived: "Archive" },
  changing: "Changing status",
  changed: (status: string) => `The lesson is now ${status}.`,
  confirmTitle: {
    draft: "Move this lesson back to draft?",
    archived: "Archive this lesson?",
  },
  confirmBody: {
    draft:
      "Learners will no longer see this lesson on the site. Their completions are kept, and publishing it again brings it back.",
    archived:
      "Learners will not see this lesson on the site. Anyone who completed it keeps the completion and its XP. You can move it back to draft later.",
  },
  cancel: "Cancel",
  /** Why a status change was refused. A refused Publish save uses the save's messages. */
  failure: {
    needs_validation:
      "The lesson changed after its last passing validation, so it was not published. Validate it, then publish.",
    published_incomplete:
      "A published lesson needs instructions and at least one test case, so it was not published.",
    status_not_allowed:
      "The lesson's status was changed somewhere else, so this change was not made. Reloading shows it and drops what you typed here, so copy anything you want to keep first.",
    stale:
      "This lesson was changed somewhere else after you opened it, so its status did not change. Reloading shows the newer version and drops what you typed here, so copy anything you want to keep first.",
    not_found: "This lesson no longer exists. Go back to the course.",
    unavailable: "The status could not be changed right now. Try again in a minute.",
    invalid_input: "The change was not accepted. Reload the page and try again.",
  },
} as const;

const count = new Intl.NumberFormat("en");

const testCaseGroup = (n: number) => `Test case ${String(n)}`;
const testCaseTitleName = (name: string) => (name.trim() === "" ? ": no name yet" : `: ${name}`);

/** The test case list of the lesson editor (docs/spec/03-experience.md section 7.5; FR-ADM-05). */
export const testCaseList = {
  intro: (limit: number) =>
    `Each test case runs the program on its own and compares what it prints. Learners see every test case, including its follow-up code. A lesson has 1 to ${count.format(limit)}.`,
  empty: "No test case yet. A lesson needs at least one before it can be published.",
  full: (limit: number) =>
    `This lesson has ${count.format(limit)} test cases, the most a lesson can have.`,
  add: "Add a test case",
  /** The group around one test case's fields, and the number at the start of its title. */
  group: testCaseGroup,
  /** The rest of the title after the number; title() is the two together. */
  titleName: testCaseTitleName,
  title: (n: number, name: string) => `${testCaseGroup(n)}${testCaseTitleName(name)}`,
  nameLabel: "Name",
  nameHint: (limit: number) =>
    `What the learner reads, written as a requirement, such as: Prints the total on one line. 1 to ${count.format(limit)} characters.`,
  stdinLabel: "Input",
  stdinHint: "What the program is given, one answer per line. It may be empty.",
  expectedLabel: "Expected output",
  expectedHint: "Exactly what the program must print. A prompt given to input() is part of it.",
  matchLabel: "How to compare",
  matchHint: "Letter case and spaces at the start of a line always count.",
  match: {
    normalized: "Ignore spaces at line ends and blank lines at the end",
    exact: "Character for character",
    contains: "The output contains this text",
  },
  hintLabel: "Hint (optional)",
  hintHint: "Shown when this test case fails. Say what to look at, never the answer.",
  afterCodeLabel: "Follow-up code (optional)",
  afterCodeHint:
    "Python that runs after the learner's program, for checking a variable or calling a function.",
  duplicate: (name: string) => `Duplicate: ${name}`,
  duplicateShort: "Duplicate",
  remove: (name: string) => `Delete: ${name}`,
  removeShort: "Delete",
  problem: {
    nameMissing: "Give this test case a name.",
    tooLong: {
      name: (limit: number) => `Keep the name to ${count.format(limit)} characters.`,
      stdin: (limit: number) => `Keep the input to ${count.format(limit)} characters.`,
      expected: (limit: number) => `Keep the expected output to ${count.format(limit)} characters.`,
      hint: (limit: number) => `Keep the hint to ${count.format(limit)} characters.`,
      afterCode: (limit: number) => `Keep the follow-up code to ${count.format(limit)} characters.`,
    },
  },
} as const;

const listed = (items: readonly string[]) =>
  items.length <= 1
    ? (items[0] ?? "")
    : `${items.slice(0, -1).join(", ")} and ${items[items.length - 1] ?? ""}`;

/** Validate in the lesson editor (docs/spec/03-experience.md section 7.6; FR-ADM-06, FR-ADM-07). */
export const validation = {
  intro:
    "Validate runs the solution, the starter and each wrong answer against every test case, in the same Python learners use. A lesson is published only when every rule passed for the lesson as it is in the editor.",
  pythonLabel: "Python",
  python: {
    loading: "Loading. Validate waits for it.",
    ready: "Ready.",
    failed: "Python could not start, so nothing can be validated.",
  },
  retry: "Try again",
  checklistLabel: "Checklist",
  rule: {
    complete: "The lesson has a title, an address, instructions and at least one test case.",
    solution_passes: "The solution passes every test case.",
    starter_fails: "The starter fails at least one test case.",
    wrong_answers_fail: "Every wrong answer fails at least one test case.",
    no_time_limit: "No run reached the time limit.",
  },
  state: { passed: "Passed", failed: "Failed", not_run: "Not checked" },
  part: {
    title: "a title",
    slug: "an address",
    instructions: "instructions",
    test_cases: "a test case",
  },
  missing: (parts: readonly string[]) => `Still missing: ${listed(parts)}.`,
  testCaseRef: (n: number, name: string) =>
    name.trim() === "" ? `test case ${String(n)}` : `test case ${String(n)} (${name})`,
  solutionFailed: (cases: readonly string[]) =>
    cases.length === 1
      ? `The solution did not pass ${listed(cases)}. Open it to see what the solution printed.`
      : `The solution did not pass ${listed(cases)}. Open each to see what the solution printed.`,
  /** Opens one of the test cases the solution failed, in the test case list. */
  openTestCase: (ref: string) => `Open ${ref}`,
  starterPasses:
    "The starter passes every test case, so a learner would have nothing to do. Change the starter, or make a test case stricter.",
  wrongAnswersPass: (numbers: readonly number[]) =>
    numbers.length === 1
      ? `Wrong answer ${String(numbers[0])} passes every test case. Add a test case that this mistake fails.`
      : `Wrong answers ${listed(numbers.map(String))} pass every test case. Add a test case that each of these mistakes fails.`,
  program: {
    solution: "the solution",
    starter: "the starter",
    wrongAnswer: (n: number) => `wrong answer ${String(n)}`,
  },
  timedOut: (seconds: number, programs: readonly string[]) =>
    `Stopped at the ${count.format(seconds)} second limit: ${listed(programs)}. Look for a loop that never ends.`,
  validate: "Validate",
  validating: "Validating",
  validatesWhenReady: "Validates when Python is ready",
  stop: "Stop",
  status: {
    running: "Validating the lesson.",
    stopping: "Stopping the validation.",
    passed: "Validation finished. Every rule passed.",
    failed: (n: number) =>
      n === 1
        ? "Validation finished. 1 rule failed."
        : `Validation finished. ${String(n)} rules failed.`,
    stopped: "Validation stopped. No rule was decided.",
  },
  unavailableLabel: "Error",
  unavailable:
    "Python could not run the programs, so nothing was checked. Press Validate to try again.",
  unavailableStart:
    "Python could not start, so nothing was checked. Press Try again, then Validate.",
  outdatedLabel: "Note",
  outdated: "You changed the lesson after this validation. Validate again before publishing.",
  /** The solution's result inside one test case (section 7.5). */
  solutionHeading: "What the solution printed",
  verdict: { pass: "Passed", fail: "Failed", not_run: "Not run" },
  /** The verdict in a test case's title, as a screen reader reads it after the name. */
  titleVerdict: (verdict: string) => `, ${verdict}`,
  reason: {
    mismatch: "The output is different from the expected output.",
    program_error: "The solution stopped with an error.",
    after_code_error: "The follow-up code stopped with an error.",
    output_limit: (limit: number) =>
      `The solution printed more than ${count.format(limit)} characters.`,
    time_limit: (seconds: number) =>
      `The solution reached the ${count.format(seconds)} second limit.`,
    stopped: "The validation was stopped.",
    crashed: "Python stopped working during this test case.",
  },
  /** Python's own message, which names the error, such as "ValueError: invalid literal". */
  error: (message: string, line: number | undefined) =>
    line === undefined ? message : `Line ${String(line)}: ${message}`,
  noOutput: "Nothing was printed.",
  truncated: (limit: number) => `The output was cut at ${count.format(limit)} characters.`,
  cleaned:
    "Control characters were removed from this output, so it cannot be copied into the expected output.",
  verdictOutdated:
    "You changed the expected output or how to compare after this validation. Validate again for a verdict.",
  fill: "Fill from solution",
  fillLabel: (name: string) => `Fill from solution: ${name}`,
} as const;

/** Lessons in the course editor's chapters (docs/spec/03-experience.md section 7.3). */
export const lessonRows = {
  addLessonHeading: (chapter: string) => `Add a lesson to ${chapter}`,
  newLessonTitleLabel: (chapter: string) => `Title of the new lesson in ${chapter}`,
  addLesson: "Add lesson",
  addingLesson: "Adding lesson",
  lessonTitleInvalid: "Enter a lesson title of 1 to 60 characters.",
} as const;
