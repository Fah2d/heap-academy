// @vitest-environment jsdom
import { act, cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { LessonDocument } from "@/content/markdown";
import type { TestResult } from "@/grader/grade";
import { HARNESS_VERSION } from "@/grader/harness";
import { parseTestCases, type TestCase, type TestCaseId } from "@/grader/test-case";
import {
  lessonStatus,
  lessonEditor as words,
  structure,
  testCaseList,
  validation,
} from "@/messages/admin";
import type { CheckProgram } from "../client/validate-lesson";
import type { OpenValidationRuntime, PythonState } from "../client/validation-runtime";
import { gradableHash } from "../gradable-hash";
import type { EditorLessonDetail } from "../types";
import { PREVIEW_DELAY_MS } from "./instructions-preview";
import { LESSON_SECTIONS, LessonEditor, type SaveLesson } from "./lesson-editor";
import type { SetLessonStatus } from "./lesson-status";

// The lesson editor (FR-ADM-04, FR-ADM-10, docs/spec/03-experience.md section
// 7.4): its sections, saving through the action with the loaded version, the
// refusals, the unsaved-changes state and warning, and the live preview.

// jsdom lays nothing out, and CodeMirror measures text ranges; an empty
// measurement lets the editor run without a layout.
const emptyRect = { x: 0, y: 0, top: 0, left: 0, right: 0, bottom: 0, width: 0, height: 0 };
Range.prototype.getClientRects = () =>
  Object.assign([], { item: () => null }) as unknown as DOMRectList;
Range.prototype.getBoundingClientRect = () => ({ ...emptyRect, toJSON: () => emptyRect });

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

const CHAPTER = "00000000-0000-4000-8000-000000000d01";
const OTHER = "00000000-0000-4000-8000-000000000d02";
const LOADED = "2026-11-22T08:00:00.123456+00:00";
const NEWER = "2026-11-22T08:05:00.654321+00:00";
const STATUS_AT = "2026-11-22T08:06:00.111111+00:00";

const lesson: EditorLessonDetail = {
  id: "00000000-0000-4000-8000-000000000e01",
  courseId: "00000000-0000-4000-8000-000000000c01",
  courseTitle: "Python basics",
  chapterId: CHAPTER,
  chapters: [
    { id: CHAPTER, title: "First steps" },
    { id: OTHER, title: "Loops" },
  ],
  title: "Ask, then answer",
  slug: "ask-then-answer",
  xp: 10,
  status: "draft",
  instructionsMd: "## Ask",
  hints: ["Use input()"],
  starterCode: "# start\n",
  solutionCode: "print(input())\n",
  wrongAnswers: [{ label: "No input", code: 'print("x")' }],
  testCases: [
    {
      id: "t1" as TestCaseId,
      name: "Echoes Ada",
      stdin: "Ada\n",
      afterCode: "",
      expected: "Ada",
      match: "normalized",
      hint: "",
    },
    {
      id: "t2" as TestCaseId,
      name: "Echoes Omar",
      stdin: "Omar\n",
      afterCode: "",
      expected: "Omar",
      match: "normalized",
      hint: "",
    },
  ],
  loadedAt: LOADED,
};

const doc = (text: string): LessonDocument => ({
  blocks: [{ kind: "paragraph", children: [{ kind: "text", text }] }],
});

/**
 * The solution prints each test case's expected output; every other program
 * prints "x". Test cases the worker protocol refuses (it parses them with
 * `parseTestCases`) get no result, as from the controller.
 */
const honest: CheckProgram = (source, tests) =>
  Promise.resolve(
    !parseTestCases(tests).ok
      ? undefined
      : tests.map((testCase: TestCase): TestResult => {
          const actual = source === lesson.solutionCode ? `${testCase.expected}\n` : "x\n";
          return actual === `${testCase.expected}\n`
            ? {
                testCaseId: testCase.id,
                status: "passed",
                actual,
                truncated: false,
                harnessVersion: HARNESS_VERSION,
              }
            : {
                testCaseId: testCase.id,
                status: "failed",
                reason: "mismatch",
                actual,
                truncated: false,
                harnessVersion: HARNESS_VERSION,
              };
        }),
  );

/** A Python runtime the test drives: its state, its checks, Stop and closing. */
function fakeRuntime(checkProgram: CheckProgram = honest) {
  let setState: (state: PythonState) => void = () => undefined;
  const runtime = {
    checkProgram: vi.fn(checkProgram),
    stop: vi.fn(),
    retry: vi.fn(),
    dispose: vi.fn(),
  };
  const open = vi.fn<OpenValidationRuntime>((onState) => {
    setState = onState;
    onState("ready");
    return runtime;
  });
  return { runtime, open, setState: (state: PythonState) => act(() => setState(state)) };
}

function setup(
  overrides: {
    save?: SaveLesson;
    setStatus?: SetLessonStatus;
    render?: (markdown: string) => Promise<unknown>;
    python?: ReturnType<typeof fakeRuntime>;
  } = {},
  detail: EditorLessonDetail = lesson,
) {
  const python = overrides.python ?? fakeRuntime();
  const save =
    overrides.save ??
    vi.fn<SaveLesson>(() => Promise.resolve({ ok: true, value: { updatedAt: NEWER } }));
  const setStatus =
    overrides.setStatus ??
    vi.fn<SetLessonStatus>(() => Promise.resolve({ ok: true, value: { updatedAt: STATUS_AT } }));
  const renderPreview = vi.fn(({ markdown }: { markdown: string }) =>
    overrides.render === undefined
      ? Promise.resolve({ ok: true as const, value: doc(`rendered: ${markdown}`) })
      : (overrides.render(markdown) as Promise<{ ok: true; value: LessonDocument }>),
  );
  render(
    <LessonEditor
      lesson={detail}
      initialPreview={doc("saved preview")}
      nonce="bm9uY2U="
      save={save}
      setStatus={setStatus}
      renderPreview={renderPreview}
      newTestCaseId={() => "00000000-0000-4000-8000-0000000000a1"}
      openRuntime={python.open}
    />,
  );
  return { save, setStatus, renderPreview, python };
}

const field = (name: string) => screen.getByRole("textbox", { name });
const saveButton = () => screen.getByRole("button", { name: words.save });

describe("LessonEditor [FR-ADM-04]", () => {
  it("shows the status, every section in the side list, and the saved values", () => {
    setup();
    const nav = screen.getByRole("navigation", { name: words.sectionsLabel });
    expect(
      within(nav)
        .getAllByRole("link")
        .map(
          (link) =>
            document.getElementById((link.getAttribute("href") ?? "").slice(1))?.textContent,
        ),
    ).toEqual(LESSON_SECTIONS.map((section) => section.title));
    for (const section of LESSON_SECTIONS) {
      expect(screen.getByRole("heading", { level: 2, name: section.title })).toBeTruthy();
    }
    expect(screen.getByText(words.statusNow.draft)).toBeTruthy();
    expect(screen.getByText(words.allSaved)).toBeTruthy();
    expect((field(words.titleLabel) as HTMLInputElement).value).toBe(lesson.title);
    expect(
      (screen.getByRole("combobox", { name: words.chapterLabel }) as HTMLSelectElement).value,
    ).toBe(CHAPTER);
    expect((field(words.hintLabel(1)) as HTMLInputElement).value).toBe("Use input()");
    expect(screen.getAllByRole("textbox", { name: /Hint \d \(optional\)/ })).toHaveLength(5);
    expect(screen.getByRole("button", { name: testCaseList.title(1, "Echoes Ada") })).toBeTruthy();
    expect(screen.getByRole("button", { name: testCaseList.title(2, "Echoes Omar") })).toBeTruthy();
    expect(screen.getByTestId("instructions-preview").textContent).toBe("saved preview");
    expect(screen.getByRole("textbox", { name: words.starterLabel }).textContent).toBe("# start");
  });

  it("[FR-ADM-10] saves the draft with the version it loaded, then with the new one", async () => {
    const { save } = setup();
    await userEvent.clear(field(words.titleLabel));
    await userEvent.type(field(words.titleLabel), "  Ask first  ");
    await userEvent.selectOptions(
      screen.getByRole("combobox", { name: words.chapterLabel }),
      OTHER,
    );
    expect(screen.getByText(words.unsaved)).toBeTruthy();
    await userEvent.click(saveButton());
    expect(save).toHaveBeenCalledWith({
      id: lesson.id,
      loadedAt: LOADED,
      draft: {
        chapterId: OTHER,
        title: "Ask first",
        slug: lesson.slug,
        xp: 10,
        instructionsMd: lesson.instructionsMd,
        hints: ["Use input()"],
        starterCode: lesson.starterCode,
        solutionCode: lesson.solutionCode,
        wrongAnswers: lesson.wrongAnswers,
      },
      testCases: lesson.testCases,
    });
    expect(await screen.findByText(words.saved)).toBeTruthy();
    expect(screen.getByText(words.allSaved)).toBeTruthy();
    expect((field(words.titleLabel) as HTMLInputElement).value).toBe("Ask first");
    await userEvent.type(field(words.slugLabel), "-2");
    expect(screen.queryByText(words.saved)).toBeNull();
    await userEvent.click(saveButton());
    expect(save).toHaveBeenLastCalledWith(expect.objectContaining({ loadedAt: NEWER }));
  });

  it("[FR-ADM-10] keeps text typed while a save is in flight, and still calls it unsaved", async () => {
    let finish: (value: { ok: true; value: { updatedAt: string } }) => void = () => undefined;
    const save = vi.fn<SaveLesson>(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
    setup({ save });
    await userEvent.clear(field(words.titleLabel));
    await userEvent.type(field(words.titleLabel), "Ask one ");
    await userEvent.click(saveButton());
    await userEvent.type(field(words.titleLabel), "two");
    await act(async () => {
      finish({ ok: true, value: { updatedAt: NEWER } });
      await Promise.resolve();
    });
    expect((field(words.titleLabel) as HTMLInputElement).value).toBe("Ask one two");
    expect(screen.getByText(words.unsaved)).toBeTruthy();
    expect(screen.queryByText(words.saved)).toBeNull();
    await userEvent.click(saveButton());
    expect(save).toHaveBeenLastCalledWith(
      expect.objectContaining({
        loadedAt: NEWER,
        draft: expect.objectContaining({ title: "Ask one two" }),
      }),
    );
    // React joins every async transition in flight, so a save left pending
    // would keep the next test's Save button pending too.
    await act(async () => {
      finish({ ok: true, value: { updatedAt: NEWER } });
      await Promise.resolve();
    });
  });

  it("[FR-ADM-10] tidies a field after a save only where it still holds what was saved", async () => {
    let finish: (value: { ok: true; value: { updatedAt: string } }) => void = () => undefined;
    const save = vi.fn<SaveLesson>(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
    setup({ save });
    await userEvent.clear(field(words.titleLabel));
    await userEvent.type(field(words.titleLabel), "  Ask first  ");
    await userEvent.click(saveButton());
    await userEvent.type(field(words.hintLabel(2)), "Then print it");
    await act(async () => {
      finish({ ok: true, value: { updatedAt: NEWER } });
      await Promise.resolve();
    });
    expect((field(words.titleLabel) as HTMLInputElement).value).toBe("Ask first");
    expect((field(words.hintLabel(2)) as HTMLInputElement).value).toBe("Then print it");
    expect(screen.getByText(words.unsaved)).toBeTruthy();
  });

  it("names every wrong field and sends nothing", async () => {
    const { save } = setup();
    await userEvent.clear(field(words.titleLabel));
    await userEvent.clear(field(words.xpLabel));
    await userEvent.type(field(words.xpLabel), "70");
    await userEvent.clear(field(words.wrongAnswerLabel(1)));
    await userEvent.click(saveButton());
    expect(save).not.toHaveBeenCalled();
    expect(screen.getByText(words.fieldInvalid.title)).toBeTruthy();
    expect(screen.getByText(words.fieldInvalid.xp)).toBeTruthy();
    expect(screen.getByText(words.fieldInvalid.wrongAnswerLabel)).toBeTruthy();
  });

  it("[FR-ADM-10] refuses a save over a newer version, with a prompt to reload", async () => {
    setup({ save: () => Promise.resolve({ ok: false, error: "stale" }) });
    await userEvent.type(field(words.titleLabel), "!");
    await userEvent.click(saveButton());
    expect(await screen.findByText(words.failure.stale)).toBeTruthy();
    expect(screen.getByRole("button", { name: structure.reload })).toBeTruthy();
    expect(screen.getByText(words.unsaved)).toBeTruthy();
  });

  it.each(["needs_validation", "published_incomplete", "unavailable", "invalid_input", "made_up"])(
    "explains a refused save: %s",
    async (error) => {
      setup({ save: () => Promise.resolve({ ok: false, error }) });
      await userEvent.click(saveButton());
      const known = Object.hasOwn(words.failure, error)
        ? words.failure[error as keyof typeof words.failure]
        : words.failure.unavailable;
      expect(await screen.findByText(known)).toBeTruthy();
      expect(screen.queryByRole("button", { name: structure.reload })).toBeNull();
    },
  );

  it("marks a taken address on its field, and says so once", async () => {
    setup({ save: () => Promise.resolve({ ok: false, error: "slug_taken" }) });
    await userEvent.click(saveButton());
    expect(await screen.findAllByText(words.failure.slug_taken)).toHaveLength(1);
    expect(field(words.slugLabel).getAttribute("aria-invalid")).toBe("true");
  });

  it("focuses a taken address in the render that marks it, however late the save ends", async () => {
    // A frame that comes at once stands for a slow machine, where the next
    // frame arrives before React has marked the field.
    const frame = vi.spyOn(window, "requestAnimationFrame").mockImplementation((callback) => {
      callback(0);
      return 0;
    });
    try {
      setup({ save: () => Promise.resolve({ ok: false, error: "slug_taken" }) });
      await userEvent.click(saveButton());
      await screen.findAllByText(words.failure.slug_taken);
      expect(document.activeElement).toBe(field(words.slugLabel));
    } finally {
      frame.mockRestore();
    }
  });

  it("says a save that throws could not be made", async () => {
    setup({ save: () => Promise.reject(new Error("network")) });
    await userEvent.click(saveButton());
    expect(await screen.findByText(words.failure.unavailable)).toBeTruthy();
  });

  it("[FR-ADM-10] asks before the page unloads while anything is unsaved", async () => {
    setup();
    const unload = () => {
      const event = new Event("beforeunload", { cancelable: true });
      window.dispatchEvent(event);
      return event.defaultPrevented;
    };
    expect(unload()).toBe(false);
    await userEvent.type(field(words.hintLabel(2)), "Try print()");
    expect(unload()).toBe(true);
  });

  it("adds up to three wrong answers and removes one", async () => {
    setup();
    await userEvent.click(screen.getByRole("button", { name: words.addWrongAnswer }));
    await userEvent.click(screen.getByRole("button", { name: words.addWrongAnswer }));
    expect(screen.queryByRole("button", { name: words.addWrongAnswer })).toBeNull();
    expect(screen.getAllByRole("textbox", { name: /what the mistake is/ })).toHaveLength(3);
    await userEvent.click(screen.getByRole("button", { name: words.removeWrongAnswer(1) }));
    expect(screen.getAllByRole("textbox", { name: /what the mistake is/ })).toHaveLength(2);
    expect(screen.getByRole("button", { name: words.addWrongAnswer })).toBeTruthy();
  });

  it("gives each editor on a page its own section IDs", () => {
    setup();
    setup();
    const targets = screen
      .getAllByRole("navigation", { name: words.sectionsLabel })
      .flatMap((nav) =>
        within(nav)
          .getAllByRole("link")
          .map((link) => link.getAttribute("href")),
      );
    expect(new Set(targets).size).toBe(targets.length);
  });

  it("[NFR-A11Y-03] keeps focus on the wrong answers when one is added or removed", async () => {
    setup();
    await userEvent.click(screen.getByRole("button", { name: words.addWrongAnswer }));
    await waitFor(() => expect(document.activeElement).toBe(field(words.wrongAnswerLabel(2))));
    await userEvent.click(screen.getByRole("button", { name: words.removeWrongAnswer(1) }));
    await waitFor(() => expect(document.activeElement).toBe(field(words.wrongAnswerLabel(1))));
    await userEvent.click(screen.getByRole("button", { name: words.removeWrongAnswer(1) }));
    await waitFor(() =>
      expect(document.activeElement).toBe(
        screen.getByRole("button", { name: words.addWrongAnswer }),
      ),
    );
  });

  it("[FR-ADM-04] marks a refused code field on the editor itself, with its error, and focuses it", async () => {
    const { save } = setup({}, { ...lesson, solutionCode: "x".repeat(10_001) });
    await userEvent.click(saveButton());
    const solution = screen.getByRole("textbox", { name: words.solutionLabel });
    expect(solution.getAttribute("aria-invalid")).toBe("true");
    const described = (solution.getAttribute("aria-describedby") ?? "")
      .split(" ")
      .map((id) => document.getElementById(id)?.textContent);
    expect(described).toContain(words.fieldInvalid.solutionCode);
    expect(described).toContain(words.solutionHint);
    await waitFor(() => expect(document.activeElement).toBe(solution));
    expect(save).not.toHaveBeenCalled();
  });

  it("[FR-ADM-05] saves the test cases as edited, and calls an edit to them unsaved", async () => {
    const { save } = setup();
    await userEvent.click(
      screen.getByRole("button", { name: testCaseList.title(2, "Echoes Omar") }),
    );
    await userEvent.click(screen.getByRole("button", { name: "Move up: Echoes Omar" }));
    expect(screen.getByText(words.unsaved)).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: testCaseList.add }));
    const added = screen.getByRole("group", { name: testCaseList.group(3) });
    await userEvent.type(
      within(added).getByRole("textbox", { name: testCaseList.nameLabel }),
      "Prints nothing for no input",
    );
    await userEvent.click(saveButton());
    expect(save).toHaveBeenCalledWith(
      expect.objectContaining({
        testCases: [
          lesson.testCases[1],
          lesson.testCases[0],
          {
            id: "00000000-0000-4000-8000-0000000000a1",
            name: "Prints nothing for no input",
            stdin: "",
            afterCode: "",
            expected: "",
            match: "normalized",
            hint: "",
          },
        ],
      }),
    );
    expect(await screen.findByText(words.saved)).toBeTruthy();
    expect(screen.getByText(words.allSaved)).toBeTruthy();
  });

  it("[FR-ADM-05] opens a test case with a problem, focuses its field, and sends nothing", async () => {
    const { save } = setup({}, {
      ...lesson,
      testCases: [lesson.testCases[0], { ...lesson.testCases[1], name: "", hint: "h".repeat(201) }],
    } as EditorLessonDetail);
    const second = screen.getByRole("button", { name: testCaseList.title(2, "") });
    expect(second.getAttribute("aria-expanded")).toBe("false");
    await userEvent.click(saveButton());
    expect(save).not.toHaveBeenCalled();
    expect(second.getAttribute("aria-expanded")).toBe("true");
    const group = screen.getByRole("group", { name: testCaseList.group(2) });
    const name = within(group).getByRole("textbox", { name: testCaseList.nameLabel });
    await waitFor(() => expect(document.activeElement).toBe(name));
    expect(within(group).getByText(testCaseList.problem.nameMissing)).toBeTruthy();
    expect(within(group).getByText("Keep the hint to 200 characters.")).toBeTruthy();
  });

  it("notes that a published lesson's code changes only with a validation", () => {
    setup({}, { ...lesson, status: "published" });
    expect(screen.getByText(words.publishedCodeNote)).toBeTruthy();
  });
});

const validate = () => userEvent.click(screen.getByRole("button", { name: validation.validate }));
const liveStatus = () =>
  screen
    .getAllByRole("status")
    .map((element) => element.textContent)
    .join(" ");

describe("LessonEditor validation [FR-ADM-06, FR-ADM-07]", () => {
  it("starts Python when the editor opens, says while it loads, and closes it with the editor", async () => {
    const python = fakeRuntime();
    python.open.mockImplementation((onState) => {
      onState("loading");
      return python.runtime;
    });
    const { unmount } = render(
      <LessonEditor
        lesson={lesson}
        initialPreview={doc("saved preview")}
        nonce="bm9uY2U="
        save={vi.fn<SaveLesson>()}
        setStatus={vi.fn<SetLessonStatus>()}
        renderPreview={vi.fn()}
        openRuntime={python.open}
      />,
    );
    expect(python.open).toHaveBeenCalledTimes(1);
    expect(screen.getByText(validation.python.loading)).toBeTruthy();
    act(() => python.open.mock.calls[0]?.[0]("ready"));
    expect(python.runtime.checkProgram).not.toHaveBeenCalled();
    unmount();
    expect(python.runtime.dispose).toHaveBeenCalledTimes(1);
  });

  it("[T-23] runs no program when a published lesson opens", () => {
    const { python } = setup({}, { ...lesson, status: "published" });
    expect(python.runtime.checkProgram).not.toHaveBeenCalled();
  });

  it("[FR-ADM-05] Validate opens a test case with a problem and focuses its field, and runs nothing", async () => {
    const { python } = setup({}, {
      ...lesson,
      testCases: [lesson.testCases[0], { ...lesson.testCases[1], name: "" }],
    } as EditorLessonDetail);
    await validate();
    expect(python.runtime.checkProgram).not.toHaveBeenCalled();
    const group = screen.getByRole("group", { name: testCaseList.group(2) });
    const name = within(group).getByRole("textbox", { name: testCaseList.nameLabel });
    await waitFor(() => expect(document.activeElement).toBe(name));
    expect(within(group).getByText(testCaseList.problem.nameMissing)).toBeTruthy();
    expect(screen.queryByText(validation.unavailable)).toBeNull();
  });

  it("[FR-GRD-05] Validate checks the solution, the starter and the wrong answer, then shows the checklist and each verdict", async () => {
    const { python } = setup();
    expect(screen.getByRole("heading", { level: 2, name: words.publishHeading })).toBeTruthy();
    await validate();
    await waitFor(() => expect(liveStatus()).toContain(validation.status.passed));
    expect(python.runtime.checkProgram.mock.calls.map(([source]) => source)).toEqual([
      lesson.solutionCode,
      lesson.starterCode,
      'print("x")',
    ]);
    await userEvent.click(
      screen.getByRole("button", {
        name: `${testCaseList.title(1, "Echoes Ada")}${validation.titleVerdict(validation.verdict.pass)}`,
      }),
    );
    const first = within(screen.getByRole("group", { name: testCaseList.group(1) }));
    expect(first.getByText(validation.verdict.pass)).toBeTruthy();
    expect(first.getByTestId("solution-output").textContent).toBe("Ada\n");
  });

  it("[FR-ADM-07] [T-22] a save after a passing validation sends its hash; one after a gradable edit does not", async () => {
    const { save } = setup();
    await validate();
    await waitFor(() => expect(liveStatus()).toContain(validation.status.passed));
    await userEvent.click(saveButton());
    await waitFor(() => expect(save).toHaveBeenCalledTimes(1));
    const hash = await gradableHash({
      starterCode: lesson.starterCode,
      solutionCode: lesson.solutionCode,
      wrongAnswers: lesson.wrongAnswers,
      testCases: lesson.testCases,
    });
    expect(vi.mocked(save).mock.calls[0]?.[0].validatedHash).toBe(hash);
    await screen.findByRole("button", { name: words.save });

    await userEvent.click(
      screen.getByRole("button", {
        name: `${testCaseList.title(2, "Echoes Omar")}${validation.titleVerdict(validation.verdict.pass)}`,
      }),
    );
    const second = within(screen.getByRole("group", { name: testCaseList.group(2) }));
    await userEvent.type(second.getByLabelText(testCaseList.expectedLabel), "!");
    expect(screen.getByText(validation.outdated)).toBeTruthy();
    await userEvent.click(saveButton());
    await waitFor(() => expect(save).toHaveBeenCalledTimes(2));
    expect(vi.mocked(save).mock.calls[1]?.[0]).not.toHaveProperty("validatedHash");
  });

  it("[FR-ADM-07] sends no hash for a failed validation, and names the failed rule", async () => {
    const starterPasses: CheckProgram = (source, tests) =>
      honest(source === lesson.starterCode ? lesson.solutionCode : source, tests);
    const { save } = setup({ python: fakeRuntime(starterPasses) });
    await validate();
    await waitFor(() => expect(liveStatus()).toContain(validation.status.failed(1)));
    expect(screen.getByText(validation.starterPasses)).toBeTruthy();
    await userEvent.click(saveButton());
    await waitFor(() => expect(save).toHaveBeenCalledTimes(1));
    expect(vi.mocked(save).mock.calls[0]?.[0]).not.toHaveProperty("validatedHash");
  });

  it("[FR-GRD-05] opens a test case the solution failed from the checklist and focuses it", async () => {
    const solutionFails: CheckProgram = (source, tests) =>
      honest(source === lesson.solutionCode ? 'print("no")' : source, tests);
    setup({ python: fakeRuntime(solutionFails) });
    await validate();
    await waitFor(() => expect(liveStatus()).toContain(validation.status.failed(1)));
    await userEvent.click(
      screen.getByRole("button", {
        name: validation.openTestCase(validation.testCaseRef(2, "Echoes Omar")),
      }),
    );
    const opened = screen.getByRole("button", {
      name: `${testCaseList.title(2, "Echoes Omar")}${validation.titleVerdict(validation.verdict.fail)}`,
    });
    expect(opened.getAttribute("aria-expanded")).toBe("true");
    await waitFor(() => expect(document.activeElement).toBe(opened));
  });

  it("[FR-ADM-06] Stop stops the check in progress, and the checklist decides nothing", async () => {
    let finish: (results: TestResult[] | undefined) => void = () => undefined;
    const waiting: CheckProgram = () =>
      new Promise((resolve) => {
        finish = resolve;
      });
    const { python } = setup({ python: fakeRuntime(waiting) });
    await validate();
    expect(liveStatus()).toContain(validation.status.running);
    await userEvent.click(screen.getByRole("button", { name: validation.stop }));
    expect(python.runtime.stop).toHaveBeenCalledTimes(1);
    expect(liveStatus()).toContain(validation.status.stopping);
    await act(async () => {
      finish(undefined);
      await Promise.resolve();
    });
    await waitFor(() => expect(liveStatus()).toContain(validation.status.stopped));
    expect(python.runtime.checkProgram).toHaveBeenCalledTimes(1);
  });

  it("does not wait on a Python that could not start: Validate says nothing was checked at once", async () => {
    const python = fakeRuntime();
    python.open.mockImplementation((onState) => {
      onState("failed");
      return python.runtime;
    });
    setup({ python });
    await validate();
    expect(screen.getByText(validation.unavailableStart)).toBeTruthy();
    expect(python.runtime.checkProgram).not.toHaveBeenCalled();
  });

  it("leaves Validating when the validation itself fails, and passes the error on", async () => {
    const reported = vi.fn();
    const onRejection = (event: PromiseRejectionEvent) => {
      event.preventDefault();
      reported(event.reason);
    };
    window.addEventListener("unhandledrejection", onRejection);
    const unhandled = (reason: unknown) => reported(reason);
    process.on("unhandledRejection", unhandled);
    try {
      // No result for either test case: the checklist cannot be decided, which is a defect.
      setup({ python: fakeRuntime(() => Promise.resolve([])) });
      await validate();
      await waitFor(() => expect(screen.getByText(validation.unavailable)).toBeTruthy());
      await waitFor(() =>
        expect(reported).toHaveBeenCalledWith(new Error("validation_runs_do_not_match")),
      );
    } finally {
      window.removeEventListener("unhandledrejection", onRejection);
      process.off("unhandledRejection", unhandled);
    }
  });

  it("says when Python could not run the programs, and Try again restarts a failed Python", async () => {
    const { python } = setup({ python: fakeRuntime(() => Promise.resolve(undefined)) });
    await validate();
    await waitFor(() => expect(screen.getByText(validation.unavailable)).toBeTruthy());
    python.setState("failed");
    await userEvent.click(screen.getByRole("button", { name: validation.retry }));
    expect(python.runtime.retry).toHaveBeenCalledTimes(1);
  });
});

const publishButton = () => screen.queryByRole("button", { name: lessonStatus.action.published });
const passValidation = async () => {
  await validate();
  await waitFor(() => expect(liveStatus()).toContain(validation.status.passed));
};
const expectedHash = () =>
  gradableHash({
    starterCode: lesson.starterCode,
    solutionCode: lesson.solutionCode,
    wrongAnswers: lesson.wrongAnswers,
    testCases: lesson.testCases,
  });

describe("LessonEditor status [FR-ADM-09]", () => {
  it("[FR-ADM-07] offers Publish only after a passing validation of the lesson as it is now", async () => {
    setup();
    expect(
      screen.getByText(lessonStatus.now(lessonStatus.name.draft), { exact: false }),
    ).toBeTruthy();
    expect(screen.getByText(lessonStatus.publishWaits)).toBeTruthy();
    expect(publishButton()).toBeNull();
    await passValidation();
    expect(publishButton()).toBeTruthy();
    expect(screen.queryByText(lessonStatus.publishWaits)).toBeNull();
    // Rule 1 reads the title too, so any edit after the validation takes Publish away.
    await userEvent.type(field(words.titleLabel), "!");
    expect(publishButton()).toBeNull();
    expect(screen.getByText(lessonStatus.publishWaits)).toBeTruthy();
  });

  it("[FR-ADM-07] offers no Publish after a failed validation", async () => {
    const starterPasses: CheckProgram = (source, tests) =>
      honest(source === lesson.starterCode ? lesson.solutionCode : source, tests);
    setup({ python: fakeRuntime(starterPasses) });
    await validate();
    await waitFor(() => expect(liveStatus()).toContain(validation.status.failed(1)));
    expect(publishButton()).toBeNull();
  });

  it("[T-22] Publish saves what was validated with its hash, then publishes the saved version", async () => {
    const { save, setStatus } = setup();
    await passValidation();
    await userEvent.click(publishButton() as HTMLElement);
    await waitFor(() =>
      expect(setStatus).toHaveBeenCalledWith({
        id: lesson.id,
        loadedAt: NEWER,
        status: "published",
      }),
    );
    expect(save).toHaveBeenCalledTimes(1);
    expect(vi.mocked(save).mock.calls[0]?.[0].validatedHash).toBe(await expectedHash());
    await waitFor(() =>
      expect(liveStatus()).toContain(lessonStatus.changed(lessonStatus.name.published)),
    );
    expect(screen.getByText(words.statusNow.published)).toBeTruthy();
    expect(screen.getByText(words.publishedCodeNote)).toBeTruthy();
    expect(document.activeElement?.textContent).toContain(
      lessonStatus.now(lessonStatus.name.published),
    );
    expect(publishButton()).toBeNull();
  });

  it("does not publish when the save before it is refused, and says why in the Publish section", async () => {
    const { setStatus } = setup({
      save: vi.fn<SaveLesson>(() => Promise.resolve({ ok: false, error: "stale" })),
    });
    await passValidation();
    await userEvent.click(publishButton() as HTMLElement);
    const publish = screen.getByRole("region", { name: words.publishHeading });
    await waitFor(() => expect(within(publish).getByText(words.failure.stale)).toBeTruthy());
    expect(within(publish).getByRole("button", { name: structure.reload })).toBeTruthy();
    expect(setStatus).not.toHaveBeenCalled();
    expect(screen.getByText(words.statusNow.draft)).toBeTruthy();
  });

  it("[FR-ADM-10] offers Reload when the status was changed somewhere else", async () => {
    setup({
      setStatus: vi.fn<SetLessonStatus>(() =>
        Promise.resolve({ ok: false, error: "status_not_allowed" }),
      ),
    });
    await userEvent.click(screen.getByRole("button", { name: lessonStatus.action.archived }));
    await userEvent.click(
      within(screen.getByRole("dialog")).getByRole("button", {
        name: lessonStatus.action.archived,
      }),
    );
    await waitFor(() =>
      expect(screen.getByText(lessonStatus.failure.status_not_allowed)).toBeTruthy(),
    );
    const publish = screen.getByRole("group", { name: lessonStatus.heading });
    expect(within(publish).getByRole("button", { name: structure.reload })).toBeTruthy();
  });

  it("[NFR-A11Y-03] says the new status once: focus reads it, and the live region stays out of sight", async () => {
    setup();
    await userEvent.click(screen.getByRole("button", { name: lessonStatus.action.archived }));
    await userEvent.click(
      within(screen.getByRole("dialog")).getByRole("button", {
        name: lessonStatus.action.archived,
      }),
    );
    const changed = await screen.findByText(lessonStatus.changed(lessonStatus.name.archived));
    expect(changed.className).toBe("sr-only");
  });

  it("says why the database refused to publish", async () => {
    setup({
      setStatus: vi.fn<SetLessonStatus>(() =>
        Promise.resolve({ ok: false, error: "needs_validation" }),
      ),
    });
    await passValidation();
    await userEvent.click(publishButton() as HTMLElement);
    await waitFor(() =>
      expect(screen.getByText(lessonStatus.failure.needs_validation)).toBeTruthy(),
    );
    expect(screen.getByText(words.statusNow.draft)).toBeTruthy();
  });

  it("does not publish while a field is wrong, and focuses it", async () => {
    const { save, setStatus } = setup();
    await passValidation();
    await userEvent.clear(field(words.xpLabel));
    await userEvent.type(field(words.xpLabel), "500");
    // XP is not part of the checklist, so Publish stays.
    await userEvent.click(publishButton() as HTMLElement);
    await waitFor(() => expect(document.activeElement).toBe(field(words.xpLabel)));
    expect(save).not.toHaveBeenCalled();
    expect(setStatus).not.toHaveBeenCalled();
  });

  it("asks before taking a published lesson off the site, and says what learners will see", async () => {
    const { setStatus } = setup({}, { ...lesson, status: "published" });
    await userEvent.click(screen.getByRole("button", { name: lessonStatus.action.draft }));
    const dialog = screen.getByRole("dialog", { name: lessonStatus.confirmTitle.draft });
    expect(within(dialog).getByText(lessonStatus.confirmBody.draft)).toBeTruthy();
    await userEvent.click(within(dialog).getByRole("button", { name: lessonStatus.cancel }));
    expect(setStatus).not.toHaveBeenCalled();

    await userEvent.click(screen.getByRole("button", { name: lessonStatus.action.draft }));
    await userEvent.click(
      within(screen.getByRole("dialog")).getByRole("button", { name: lessonStatus.action.draft }),
    );
    await waitFor(() =>
      expect(setStatus).toHaveBeenCalledWith({ id: lesson.id, loadedAt: LOADED, status: "draft" }),
    );
    await waitFor(() => expect(screen.getByText(words.statusNow.draft)).toBeTruthy());
    expect(screen.queryByText(words.publishedCodeNote)).toBeNull();
  });

  it("asks before archiving, then moves an archived lesson back to draft without asking", async () => {
    const { setStatus } = setup();
    expect(publishButton()).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: lessonStatus.action.archived }));
    const dialog = screen.getByRole("dialog", { name: lessonStatus.confirmTitle.archived });
    expect(within(dialog).getByText(lessonStatus.confirmBody.archived)).toBeTruthy();
    await userEvent.click(
      within(dialog).getByRole("button", { name: lessonStatus.action.archived }),
    );
    await waitFor(() => expect(screen.getByText(words.statusNow.archived)).toBeTruthy());
    expect(setStatus).toHaveBeenLastCalledWith({
      id: lesson.id,
      loadedAt: LOADED,
      status: "archived",
    });

    // The new status can render before the move's transition ends; a pending
    // button ignores presses, so wait for it to settle.
    const toDraft = screen.getByRole("button", { name: lessonStatus.action.draft });
    await waitFor(() => expect(toDraft.getAttribute("aria-disabled")).toBeNull());
    await userEvent.click(toDraft);
    expect(screen.queryByRole("dialog")).toBeNull();
    await waitFor(() =>
      expect(setStatus).toHaveBeenLastCalledWith({
        id: lesson.id,
        loadedAt: STATUS_AT,
        status: "draft",
      }),
    );
  });

  it("[FR-ADM-10] Save does not say a status is changing, and the moves wait for it", async () => {
    const save = vi.fn<SaveLesson>(() => new Promise(() => undefined));
    setup({ save });
    await userEvent.type(field(words.titleLabel), "!");
    await userEvent.click(saveButton());
    expect(screen.getByRole("button", { name: words.saving })).toBeTruthy();
    expect(liveStatus()).not.toContain(lessonStatus.changing);
    const archive = screen.getByRole("button", { name: lessonStatus.action.archived });
    expect(archive.hasAttribute("disabled")).toBe(true);
  });

  it("[FR-ADM-10] Archive does not say the lesson is saving, and Save waits for it", async () => {
    const setStatus = vi.fn<SetLessonStatus>(() => new Promise(() => undefined));
    setup({ setStatus });
    await userEvent.click(screen.getByRole("button", { name: lessonStatus.action.archived }));
    await userEvent.click(
      within(screen.getByRole("dialog")).getByRole("button", {
        name: lessonStatus.action.archived,
      }),
    );
    await waitFor(() => expect(liveStatus()).toContain(lessonStatus.changing));
    expect(screen.queryByRole("button", { name: words.saving })).toBeNull();
    expect(saveButton().hasAttribute("disabled")).toBe(true);
  });
});

describe("LessonEditor Save on a published lesson [FR-ADM-07, FR-ADM-09]", () => {
  const published = { ...lesson, status: "published" as const };

  it("[T-22] validates first, then saves with the hash of what passed", async () => {
    const { save, python } = setup({}, published);
    await userEvent.type(field(words.titleLabel), "!");
    await userEvent.click(saveButton());
    await waitFor(() => expect(save).toHaveBeenCalledTimes(1));
    expect(python.runtime.checkProgram).toHaveBeenCalledTimes(3);
    expect(liveStatus()).toContain(validation.status.passed);
    expect(vi.mocked(save).mock.calls[0]?.[0].validatedHash).toBe(await expectedHash());
  });

  it("does not validate again when a passing validation covers the lesson as it is", async () => {
    const { save, python } = setup({}, published);
    await passValidation();
    await userEvent.click(saveButton());
    await waitFor(() => expect(save).toHaveBeenCalledTimes(1));
    expect(python.runtime.checkProgram).toHaveBeenCalledTimes(3);
    expect(vi.mocked(save).mock.calls[0]?.[0].validatedHash).toBe(await expectedHash());
  });

  it("saves nothing when a rule fails, and says where to look", async () => {
    const starterPasses: CheckProgram = (source, tests) =>
      honest(source === lesson.starterCode ? lesson.solutionCode : source, tests);
    const { save } = setup({ python: fakeRuntime(starterPasses) }, published);
    await userEvent.click(saveButton());
    await waitFor(() => expect(screen.getByText(words.validateFirst.failed)).toBeTruthy());
    expect(screen.getByText(validation.starterPasses)).toBeTruthy();
    expect(save).not.toHaveBeenCalled();
  });

  it("[FR-ADM-06] saves nothing when the validation is stopped", async () => {
    let finish: (results: TestResult[] | undefined) => void = () => undefined;
    const waiting: CheckProgram = () =>
      new Promise((resolve) => {
        finish = resolve;
      });
    const { save } = setup({ python: fakeRuntime(waiting) }, published);
    await userEvent.click(saveButton());
    await userEvent.click(await screen.findByRole("button", { name: validation.stop }));
    await act(async () => {
      finish(undefined);
      await Promise.resolve();
    });
    await waitFor(() => expect(screen.getByText(words.validateFirst.stopped)).toBeTruthy());
    expect(save).not.toHaveBeenCalled();
  });

  it("saves nothing when Python could not start", async () => {
    const python = fakeRuntime();
    python.open.mockImplementation((onState) => {
      onState("failed");
      return python.runtime;
    });
    const { save } = setup({ python }, published);
    await userEvent.click(saveButton());
    await waitFor(() =>
      expect(screen.getByText(words.validateFirst.unavailableStart)).toBeTruthy(),
    );
    expect(save).not.toHaveBeenCalled();
  });

  it("saves a draft without validating", async () => {
    const { save, python } = setup();
    await userEvent.click(saveButton());
    await waitFor(() => expect(save).toHaveBeenCalledTimes(1));
    expect(python.runtime.checkProgram).not.toHaveBeenCalled();
  });
});

describe("InstructionsPreview [NFR-SEC-07]", () => {
  it("renders the instructions after typing pauses, through the server's renderer", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const { renderPreview } = setup();
    const markdown = field(words.instructionsLabel);
    const updating = screen.getByText(words.previewUpdating);
    // The line keeps its place, so the preview does not jump, and it is
    // never announced: only a failure is.
    expect(updating.className).toContain("invisible");
    expect(updating.closest("[role=status], [aria-live]")).toBeNull();
    await userEvent.type(markdown, " more");
    expect(updating.className).not.toContain("invisible");
    await act(() => vi.advanceTimersByTimeAsync(PREVIEW_DELAY_MS));
    expect(renderPreview).toHaveBeenLastCalledWith({ markdown: "## Ask more" });
    expect(screen.getByTestId("instructions-preview").textContent).toBe("rendered: ## Ask more");
    expect(screen.getByText(words.previewUpdating).className).toContain("invisible");
  });

  it("keeps the last preview and says so when the renderer fails", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    setup({ render: () => Promise.resolve({ ok: false, error: "unavailable" }) });
    await userEvent.type(field(words.instructionsLabel), "!");
    await act(() => vi.advanceTimersByTimeAsync(PREVIEW_DELAY_MS));
    expect(
      screen
        .getAllByRole("status")
        .some((region) => region.textContent.includes(words.previewFailed)),
    ).toBe(true);
    expect(screen.getByTestId("instructions-preview").textContent).toBe("saved preview");
  });

  it("shows the empty state when there is nothing to preview", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    setup({ render: () => Promise.resolve({ ok: true, value: { blocks: [] } }) });
    await userEvent.clear(field(words.instructionsLabel));
    await act(() => vi.advanceTimersByTimeAsync(PREVIEW_DELAY_MS));
    expect(screen.getByText(words.previewEmpty)).toBeTruthy();
  });
});
