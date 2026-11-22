// @vitest-environment jsdom
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { courseEditor, lessonEditor, lessonRows as words, structure } from "@/messages/admin";
import type { EditorChapter } from "../types";
import { AddLessonForm, LessonRows } from "./lesson-rows";

// A chapter's lessons in the course editor (FR-ADM-03, docs/spec/03-experience.md
// section 7.3): each opens its editor and moves with the keyboard; Add lesson
// creates a draft and opens it.

const router = vi.hoisted(() => ({ push: vi.fn(), refresh: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => router }));

afterEach(() => {
  cleanup();
  router.push.mockReset();
});

const COURSE = "00000000-0000-4000-8000-000000000c01";
const FIRST = "00000000-0000-4000-8000-000000000e01";
const SECOND = "00000000-0000-4000-8000-000000000e02";
const chapter: EditorChapter = {
  id: "00000000-0000-4000-8000-000000000d01",
  title: "First steps",
  summary: "",
  loadedAt: "2026-11-22T08:00:00.000001+00:00",
  lessons: [
    { id: FIRST, title: "Print", status: "published" },
    { id: SECOND, title: "Ask", status: "draft" },
  ],
};
const ok = <Value,>(value: Value) => Promise.resolve({ ok: true as const, value });

describe("LessonRows [FR-ADM-03]", () => {
  it("numbers each lesson, links it to its editor, and shows its status", () => {
    render(<LessonRows chapter={chapter} chapterNumber={2} reorder={vi.fn()} refresh={vi.fn()} />);
    const list = screen.getByRole("list", {
      name: courseEditor.chapterLessonsLabel("First steps"),
    });
    const rows = within(list).getAllByRole("listitem");
    expect(rows.map((row) => row.textContent?.slice(0, 3))).toEqual(["2.1", "2.2"]);
    expect(screen.getByRole("link", { name: "Ask" }).getAttribute("href")).toBe(
      `/admin/lessons/${SECOND}`,
    );
    expect(within(rows[0]!).getByText(courseEditor.lessonStatus.published)).toBeTruthy();
    expect(
      (screen.getByRole("button", { name: structure.moveUp("Print") }) as HTMLButtonElement)
        .disabled,
    ).toBe(true);
  });

  it("moves a lesson in its chapter and reads the course again", async () => {
    const reorder = vi.fn(() => ok(null));
    const refresh = vi.fn();
    render(<LessonRows chapter={chapter} chapterNumber={1} reorder={reorder} refresh={refresh} />);
    await userEvent.click(screen.getByRole("button", { name: structure.moveDown("Print") }));
    expect(reorder).toHaveBeenCalledWith({
      kind: "lesson",
      chapterId: chapter.id,
      id: FIRST,
      direction: "down",
    });
    expect(refresh).toHaveBeenCalledOnce();
    expect(screen.getByRole("status").textContent).toBe(structure.moved);
  });

  it("explains a refused move and reads nothing again", async () => {
    const refresh = vi.fn();
    render(
      <LessonRows
        chapter={chapter}
        chapterNumber={1}
        reorder={() => Promise.resolve({ ok: false, error: "cannot_move" })}
        refresh={refresh}
      />,
    );
    await userEvent.click(screen.getByRole("button", { name: structure.moveUp("Ask") }));
    expect(await screen.findByText(structure.failure.cannot_move)).toBeTruthy();
    expect(refresh).not.toHaveBeenCalled();
  });

  it("says when the chapter has no lessons", () => {
    render(
      <LessonRows
        chapter={{ ...chapter, lessons: [] }}
        chapterNumber={1}
        reorder={vi.fn()}
        refresh={vi.fn()}
      />,
    );
    expect(screen.getByText(courseEditor.chapterLessonsEmpty)).toBeTruthy();
  });
});

describe("AddLessonForm [FR-ADM-03]", () => {
  const titleField = () =>
    screen.getByRole("textbox", { name: words.newLessonTitleLabel("First steps") });

  it("creates a draft at the end of the chapter and opens its editor", async () => {
    const createLesson = vi.fn(() => ok({ id: SECOND }));
    const onUnsaved = vi.fn();
    render(
      <AddLessonForm
        courseId={COURSE}
        chapter={chapter}
        createLesson={createLesson}
        onUnsavedChange={onUnsaved}
      />,
    );
    await userEvent.type(titleField(), "  Loops ");
    expect(onUnsaved).toHaveBeenLastCalledWith(`lesson-${chapter.id}`, true);
    await userEvent.click(screen.getByRole("button", { name: words.addLesson }));
    expect(createLesson).toHaveBeenCalledWith({
      courseId: COURSE,
      chapterId: chapter.id,
      title: "Loops",
    });
    expect(router.push).toHaveBeenCalledWith(`/admin/lessons/${SECOND}`);
    expect(onUnsaved).toHaveBeenLastCalledWith(`lesson-${chapter.id}`, false);
  });

  it("refuses an empty title on its field, and sends nothing", async () => {
    const createLesson = vi.fn();
    render(
      <AddLessonForm
        courseId={COURSE}
        chapter={chapter}
        createLesson={createLesson}
        onUnsavedChange={vi.fn()}
      />,
    );
    await userEvent.click(screen.getByRole("button", { name: words.addLesson }));
    expect(createLesson).not.toHaveBeenCalled();
    expect(screen.getByText(words.lessonTitleInvalid)).toBeTruthy();
  });

  it.each([
    ["slug_needed", lessonEditor.failure.slug_needed],
    ["chapter_not_found", lessonEditor.failure.chapter_not_found],
    ["cannot_move", structure.failure.cannot_move],
  ])("explains a refusal: %s", async (error, text) => {
    render(
      <AddLessonForm
        courseId={COURSE}
        chapter={chapter}
        createLesson={() => Promise.resolve({ ok: false, error })}
        onUnsavedChange={vi.fn()}
      />,
    );
    await userEvent.type(titleField(), "مرحبا");
    await userEvent.click(screen.getByRole("button", { name: words.addLesson }));
    expect(await screen.findByText(text)).toBeTruthy();
    expect(router.push).not.toHaveBeenCalled();
  });
});
