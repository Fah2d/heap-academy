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
