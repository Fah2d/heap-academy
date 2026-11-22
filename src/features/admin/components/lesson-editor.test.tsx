// @vitest-environment jsdom
import { act, cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { LessonDocument } from "@/content/markdown";
import { lessonEditor as words, structure } from "@/messages/admin";
import type { EditorLessonDetail } from "../types";
import { PREVIEW_DELAY_MS } from "./instructions-preview";
import { LESSON_SECTIONS, LessonEditor, type SaveLesson } from "./lesson-editor";

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
  testCount: 2,
  loadedAt: LOADED,
};

const doc = (text: string): LessonDocument => ({
  blocks: [{ kind: "paragraph", children: [{ kind: "text", text }] }],
});

function setup(
  overrides: { save?: SaveLesson; render?: (markdown: string) => Promise<unknown> } = {},
  detail: EditorLessonDetail = lesson,
) {
  const save =
    overrides.save ??
    vi.fn<SaveLesson>(() => Promise.resolve({ ok: true, value: { updatedAt: NEWER } }));
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
      renderPreview={renderPreview}
    />,
  );
  return { save, renderPreview };
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
        .map((link) => link.getAttribute("href")),
    ).toEqual(LESSON_SECTIONS.map((section) => `#${section.id}`));
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
    expect(screen.getByText(words.testCount(2))).toBeTruthy();
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

  it("marks a taken address on its field", async () => {
    setup({ save: () => Promise.resolve({ ok: false, error: "slug_taken" }) });
    await userEvent.click(saveButton());
    expect(await screen.findAllByText(words.failure.slug_taken)).not.toHaveLength(0);
    expect(field(words.slugLabel).getAttribute("aria-invalid")).toBe("true");
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

  it("notes that a published lesson's code changes only with a validation", () => {
    setup({}, { ...lesson, status: "published" });
    expect(screen.getByText(words.publishedCodeNote)).toBeTruthy();
  });
});

describe("InstructionsPreview [NFR-SEC-07]", () => {
  it("renders the instructions after typing pauses, through the server's renderer", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const { renderPreview } = setup();
    const markdown = field(words.instructionsLabel);
    await userEvent.type(markdown, " more");
    expect(screen.getByText(words.previewUpdating)).toBeTruthy();
    await act(() => vi.advanceTimersByTimeAsync(PREVIEW_DELAY_MS));
    expect(renderPreview).toHaveBeenLastCalledWith({ markdown: "## Ask more" });
    expect(screen.getByTestId("instructions-preview").textContent).toBe("rendered: ## Ask more");
    expect(screen.queryByText(words.previewUpdating)).toBeNull();
  });

  it("keeps the last preview and says so when the renderer fails", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    setup({ render: () => Promise.resolve({ ok: false, error: "unavailable" }) });
    await userEvent.type(field(words.instructionsLabel), "!");
    await act(() => vi.advanceTimersByTimeAsync(PREVIEW_DELAY_MS));
    expect(screen.getByText(words.previewFailed)).toBeTruthy();
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
