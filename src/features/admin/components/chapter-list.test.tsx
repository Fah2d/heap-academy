// @vitest-environment jsdom
import { act, cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { courseEditor as words, structure } from "@/messages/admin";
import type { EditorChapter } from "../types";
import { type ChapterActions, ChapterList } from "./chapter-list";

// The structure of a course (FR-ADM-03, docs/spec/03-experience.md section
// 7.3): chapters in order with their lessons and status, Move up and Move
// down, rename, delete an empty chapter after a question, and add a chapter.

const router = vi.hoisted(() => ({ push: vi.fn(), refresh: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => router }));

afterEach(cleanup);

/**
 * An announced notice's region is in the page first and its words follow a
 * frame later (`LiveRegion`), so the test waits for the words in the region.
 */
async function expectAlert(text: string) {
  await waitFor(() => {
    expect(screen.getByRole("alert").textContent).toContain(text);
  });
}

const COURSE = "00000000-0000-4000-8000-000000000c01";
const ONE = "00000000-0000-4000-8000-000000000d01";
const TWO = "00000000-0000-4000-8000-000000000d02";
const LESSON = "00000000-0000-4000-8000-000000000e01";

const chapters: EditorChapter[] = [
  {
    id: ONE,
    title: "Basics",
    summary: "Printing and names.",
    loadedAt: "2026-11-21T08:00:00.000001+00:00",
    lessons: [{ id: LESSON, title: "Hello", status: "published" }],
  },
  {
    id: TWO,
    title: "Loops",
    summary: "",
    loadedAt: "2026-11-21T08:00:00.000002+00:00",
    lessons: [],
  },
];

const ok = <Value,>(value: Value) => Promise.resolve({ ok: true as const, value });

function actions(overrides: Partial<ChapterActions> = {}): ChapterActions {
  return {
    saveChapter: vi.fn(() => ok({ id: TWO })),
    deleteChapter: vi.fn(() => ok(null)),
    reorder: vi.fn(() => ok(null)),
    createLesson: vi.fn(() => ok({ id: "00000000-0000-4000-8000-0000000000e1" })),
    ...overrides,
  };
}

describe("ChapterList [FR-ADM-03]", () => {
  it("lists chapters in order with their lessons and status", () => {
    render(<ChapterList courseId={COURSE} chapters={chapters} refresh={vi.fn()} {...actions()} />);
    const lessons = screen.getByRole("list", { name: words.chapterLessonsLabel("Basics") });
    expect(within(lessons).getByText("Hello")).toBeTruthy();
    expect(within(lessons).getByText(words.lessonStatus.published)).toBeTruthy();
    expect(screen.getByText(words.chapterLessonsEmpty)).toBeTruthy();
    // A chapter with lessons cannot be deleted, so it offers no Delete.
    expect(screen.queryByRole("button", { name: words.deleteChapter("Basics") })).toBeNull();
    expect(screen.getByRole("button", { name: words.deleteChapter("Loops") })).toBeTruthy();
  });

  it("says what to do when the course has no chapter", () => {
    render(<ChapterList courseId={COURSE} chapters={[]} refresh={vi.fn()} {...actions()} />);
    expect(screen.getByText(words.chaptersEmpty)).toBeTruthy();
    expect(screen.getByRole("button", { name: words.addChapter })).toBeTruthy();
  });

  it("adds a chapter, reads the course again, and empties the form", async () => {
    const all = actions();
    const refresh = vi.fn();
    const user = userEvent.setup();
    render(<ChapterList courseId={COURSE} chapters={[]} refresh={refresh} {...all} />);
    await user.click(screen.getByRole("button", { name: words.addChapter }));
    expect(screen.getByText(words.chapterTitleInvalid)).toBeTruthy();
    expect(all.saveChapter).not.toHaveBeenCalled();
    await user.type(screen.getByLabelText(words.newChapterTitleLabel), "  Basics ");
    await user.click(screen.getByRole("button", { name: words.addChapter }));
    expect(all.saveChapter).toHaveBeenCalledWith({
      courseId: COURSE,
      title: "Basics",
      summary: "",
    });
    expect(refresh).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("status").textContent).toBe(words.chapterAdded);
    const title = screen.getByLabelText<HTMLInputElement>(words.newChapterTitleLabel);
    expect(title.value).toBe("");
    // Focus goes back to the empty title, for the next chapter.
    expect(document.activeElement).toBe(title);
  });

  it("renames a chapter in place, and Cancel leaves it as it was", async () => {
    const all = actions();
    const user = userEvent.setup();
    render(<ChapterList courseId={COURSE} chapters={chapters} refresh={vi.fn()} {...all} />);
    await user.click(screen.getByRole("button", { name: words.renameChapter("Loops") }));
    // The rename field takes focus, with a name apart from the new chapter's field.
    const opened = screen.getByLabelText<HTMLInputElement>(words.renameTitleLabel("Loops"));
    expect(document.activeElement).toBe(opened);
    // The chapter keeps its heading while it is renamed (axe heading-order).
    expect(screen.getByRole("heading", { level: 3, name: "Loops" })).toBeTruthy();
    await user.click(screen.getByRole("button", { name: words.cancel }));
    expect(all.saveChapter).not.toHaveBeenCalled();
    // Focus goes back to Rename.
    expect(document.activeElement).toBe(
      screen.getByRole("button", { name: words.renameChapter("Loops") }),
    );
    await user.click(screen.getByRole("button", { name: words.renameChapter("Loops") }));
    const field = screen.getByLabelText<HTMLInputElement>(words.renameTitleLabel("Loops"));
    expect(field.value).toBe("Loops");
    await user.clear(field);
    await user.type(field, "Repeating");
    await user.click(screen.getByRole("button", { name: words.saveChapter }));
    expect(all.saveChapter).toHaveBeenCalledWith({
      courseId: COURSE,
      id: TWO,
      loadedAt: "2026-11-21T08:00:00.000002+00:00",
      title: "Repeating",
      summary: "",
    });
    expect(screen.queryByRole("button", { name: words.saveChapter })).toBeNull();
    expect(document.activeElement).toBe(
      screen.getByRole("button", { name: words.renameChapter("Loops") }),
    );
  });

  it("[FR-ADM-10] refuses a rename over a newer chapter, with a prompt to reload", async () => {
    const refresh = vi.fn();
    const user = userEvent.setup();
    render(
      <ChapterList
        courseId={COURSE}
        chapters={chapters}
        refresh={refresh}
        {...actions({ saveChapter: () => Promise.resolve({ ok: false, error: "stale" }) })}
      />,
    );
    await user.click(screen.getByRole("button", { name: words.renameChapter("Loops") }));
    await user.type(screen.getByLabelText(words.renameTitleLabel("Loops")), " again");
    await user.click(screen.getByRole("button", { name: words.saveChapter }));
    await expectAlert(structure.failure.stale);
    expect(screen.getByRole("button", { name: structure.reload })).toBeTruthy();
    // The typed title stays, so it can be copied before reloading.
    expect(screen.getByLabelText<HTMLInputElement>(words.renameTitleLabel("Loops")).value).toBe(
      "Loops again",
    );
    expect(refresh).not.toHaveBeenCalled();
  });

  it("[FR-ADM-10] reports typed chapter text that is not saved, and clears it once saved", async () => {
    const reported: boolean[] = [];
    const user = userEvent.setup();
    render(
      <ChapterList
        courseId={COURSE}
        chapters={chapters}
        refresh={vi.fn()}
        onUnsavedChange={(unsaved) => reported.push(unsaved)}
        {...actions()}
      />,
    );
    expect(reported.at(-1)).toBe(false);
    await user.type(screen.getByLabelText(words.newChapterTitleLabel), "Lists");
    expect(reported.at(-1)).toBe(true);
    await user.click(screen.getByRole("button", { name: words.renameChapter("Loops") }));
    await user.type(screen.getByLabelText(words.renameTitleLabel("Loops")), "!");
    await user.click(screen.getByRole("button", { name: words.addChapter }));
    // The rename still holds text.
    expect(reported.at(-1)).toBe(true);
    await user.click(screen.getByRole("button", { name: words.cancel }));
    expect(reported.at(-1)).toBe(false);
  });

  it("keeps focus on a pressed button while its change is saved", async () => {
    let finish: (value: { ok: true; value: null }) => void = () => undefined;
    const user = userEvent.setup();
    render(
      <ChapterList
        courseId={COURSE}
        chapters={chapters}
        refresh={vi.fn()}
        {...actions({
          reorder: () =>
            new Promise((resolve) => {
              finish = resolve;
            }),
        })}
      />,
    );
    const down = screen.getByRole("button", { name: structure.moveDown("Basics") });
    await user.click(down);
    // Pending, not disabled: the button stays focusable and ignores presses.
    expect(down.hasAttribute("disabled")).toBe(false);
    expect(down.hasAttribute("data-pending")).toBe(true);
    expect(document.activeElement).toBe(down);
    await act(async () => {
      finish({ ok: true, value: null });
      await Promise.resolve();
    });
  });

  it("deletes an empty chapter only after the question", async () => {
    const all = actions();
    const user = userEvent.setup();
    render(<ChapterList courseId={COURSE} chapters={chapters} refresh={vi.fn()} {...all} />);
    await user.click(screen.getByRole("button", { name: words.deleteChapter("Loops") }));
    const dialog = screen.getByRole("dialog", { name: words.deleteConfirmTitle });
    expect(dialog.textContent).toContain(words.deleteConfirmBody("Loops"));
    await user.click(within(dialog).getByRole("button", { name: words.deleteConfirm }));
    expect(all.deleteChapter).toHaveBeenCalledWith({ id: TWO });
    expect(screen.getByText(words.chapterDeleted).getAttribute("role")).toBe("status");
  });

  it("moves a chapter and puts focus back on its button in the new order", async () => {
    const all = actions();
    const user = userEvent.setup();
    const { rerender } = render(
      <ChapterList courseId={COURSE} chapters={chapters} refresh={vi.fn()} {...all} />,
    );
    await user.click(screen.getByRole("button", { name: structure.moveUp("Loops") }));
    expect(all.reorder).toHaveBeenCalledWith({
      kind: "chapter",
      courseId: COURSE,
      id: TWO,
      direction: "up",
    });
    await act(async () => {
      rerender(
        <ChapterList
          courseId={COURSE}
          chapters={[chapters[1]!, chapters[0]!]}
          refresh={vi.fn()}
          {...all}
        />,
      );
      await Promise.resolve();
    });
    // Loops is first now: Move up is disabled, so focus is on Move down.
    expect(document.activeElement).toBe(
      screen.getByRole("button", { name: structure.moveDown("Loops") }),
    );
  });

  it("shows why a change was refused and reads nothing again", async () => {
    const refresh = vi.fn();
    const user = userEvent.setup();
    render(
      <ChapterList
        courseId={COURSE}
        chapters={chapters}
        refresh={refresh}
        {...actions({ reorder: () => Promise.resolve({ ok: false, error: "cannot_move" }) })}
      />,
    );
    await user.click(screen.getByRole("button", { name: structure.moveDown("Basics") }));
    await expectAlert(structure.failure.cannot_move);
    expect(refresh).not.toHaveBeenCalled();
  });
});
