// @vitest-environment jsdom
import { act, cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { courseEditor as words, structure } from "@/messages/admin";
import type { EditorChapter } from "../types";
import { type ChapterActions, ChapterList } from "./chapter-list";

// The structure of a course (FR-ADM-03, docs/spec/03-experience.md section
// 7.3): chapters in order with their lessons and status, Move up and Move
// down, rename, delete an empty chapter after a question, and add a chapter.

afterEach(cleanup);

const COURSE = "00000000-0000-4000-8000-000000000c01";
const ONE = "00000000-0000-4000-8000-000000000d01";
const TWO = "00000000-0000-4000-8000-000000000d02";
const LESSON = "00000000-0000-4000-8000-000000000e01";

const chapters: EditorChapter[] = [
  {
    id: ONE,
    title: "Basics",
    summary: "Printing and names.",
    lessons: [{ id: LESSON, title: "Hello", status: "published" }],
  },
  { id: TWO, title: "Loops", summary: "", lessons: [] },
];

const ok = <Value,>(value: Value) => Promise.resolve({ ok: true as const, value });

function actions(overrides: Partial<ChapterActions> = {}): ChapterActions {
  return {
    saveChapter: vi.fn(() => ok({ id: TWO })),
    deleteChapter: vi.fn(() => ok(null)),
    reorder: vi.fn(() => ok(null)),
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
    await user.type(screen.getByLabelText(words.chapterTitleLabel), "  Basics ");
    await user.click(screen.getByRole("button", { name: words.addChapter }));
    expect(all.saveChapter).toHaveBeenCalledWith({
      courseId: COURSE,
      title: "Basics",
      summary: "",
    });
    expect(refresh).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("status").textContent).toBe(words.chapterAdded);
    expect(screen.getByLabelText<HTMLInputElement>(words.chapterTitleLabel).value).toBe("");
  });

  it("renames a chapter in place, and Cancel leaves it as it was", async () => {
    const all = actions();
    const user = userEvent.setup();
    render(<ChapterList courseId={COURSE} chapters={chapters} refresh={vi.fn()} {...all} />);
    await user.click(screen.getByRole("button", { name: words.renameChapter("Loops") }));
    await user.click(screen.getByRole("button", { name: words.cancel }));
    expect(all.saveChapter).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: words.renameChapter("Loops") }));
    const field = screen.getAllByLabelText<HTMLInputElement>(words.chapterTitleLabel)[0]!;
    expect(field.value).toBe("Loops");
    await user.clear(field);
    await user.type(field, "Repeating");
    await user.click(screen.getByRole("button", { name: words.saveChapter }));
    expect(all.saveChapter).toHaveBeenCalledWith({
      courseId: COURSE,
      id: TWO,
      title: "Repeating",
      summary: "",
    });
    expect(screen.queryByRole("button", { name: words.saveChapter })).toBeNull();
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
    expect(screen.getByRole("status").textContent).toBe(words.chapterDeleted);
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
    expect(screen.getByRole("alert").textContent).toContain(structure.failure.cannot_move);
    expect(refresh).not.toHaveBeenCalled();
  });
});
