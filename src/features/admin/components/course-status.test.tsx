// @vitest-environment jsdom
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { courseEditor as words, structure } from "@/messages/admin";
import { CourseStatusPanel, type SetCourseStatus } from "./course-status";

// The status of a course (FR-ADM-03, FR-ADM-09): the moves of the content
// system only; taking a course off the site asks first and says what
// learners will see; a course with no published lesson is refused with the
// reason.

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

const ID = "00000000-0000-4000-8000-000000000c01";
const LOADED = "2026-11-21T08:00:00.123456+00:00";
const NEWER = "2026-11-21T08:05:00.654321+00:00";

describe("CourseStatusPanel [FR-ADM-03, FR-ADM-09]", () => {
  it("offers a draft Publish and Archive, and no other move", () => {
    render(
      <CourseStatusPanel
        courseId={ID}
        status="draft"
        loadedAt={LOADED}
        setStatus={vi.fn()}
        onChanged={vi.fn()}
      />,
    );
    expect(screen.getByText(new RegExp(words.statusNow(words.statusName.draft)))).toBeTruthy();
    const buttons = screen.getAllByRole("button").map((button) => button.textContent);
    expect(buttons).toEqual([words.statusAction.published, words.statusAction.archived]);
  });

  it("moves focus to the new status once the pressed button is gone", async () => {
    const user = userEvent.setup();
    const setStatus = vi.fn<SetCourseStatus>(() =>
      Promise.resolve({ ok: true, value: { updatedAt: NEWER } }),
    );
    function Panel() {
      const [status, setNow] = useState<"draft" | "published" | "archived">("draft");
      return (
        <CourseStatusPanel
          courseId={ID}
          status={status}
          loadedAt={LOADED}
          setStatus={setStatus}
          onChanged={(next) => setNow(next)}
        />
      );
    }
    render(<Panel />);
    await user.click(screen.getByRole("button", { name: words.statusAction.published }));
    expect(screen.queryByRole("button", { name: words.statusAction.published })).toBeNull();
    expect(document.activeElement?.textContent).toContain(
      words.statusNow(words.statusName.published),
    );
  });

  it("offers an archived course only the way back to draft", () => {
    render(
      <CourseStatusPanel
        courseId={ID}
        status="archived"
        loadedAt={LOADED}
        setStatus={vi.fn()}
        onChanged={vi.fn()}
      />,
    );
    expect(screen.getAllByRole("button").map((button) => button.textContent)).toEqual([
      words.statusAction.draft,
    ]);
  });

  it("shows the reason when a course with no published lesson cannot be published", async () => {
    const onChanged = vi.fn();
    const user = userEvent.setup();
    render(
      <CourseStatusPanel
        courseId={ID}
        status="draft"
        loadedAt={LOADED}
        setStatus={() => Promise.resolve({ ok: false, error: "no_published_lesson" })}
        onChanged={onChanged}
      />,
    );
    await user.click(screen.getByRole("button", { name: words.statusAction.published }));
    await expectAlert(structure.failure.no_published_lesson);
    expect(onChanged).not.toHaveBeenCalled();
  });

  it("asks before taking a published course off the site, and changes nothing on Cancel", async () => {
    const setStatus = vi.fn<SetCourseStatus>(() =>
      Promise.resolve({ ok: true, value: { updatedAt: NEWER } }),
    );
    const onChanged = vi.fn();
    const user = userEvent.setup();
    render(
      <CourseStatusPanel
        courseId={ID}
        status="published"
        loadedAt={LOADED}
        setStatus={setStatus}
        onChanged={onChanged}
      />,
    );
    await user.click(screen.getByRole("button", { name: words.statusAction.draft }));
    let dialog = screen.getByRole("dialog", { name: words.confirmStatusTitle.draft });
    expect(dialog.textContent).toContain(words.confirmStatusBody.draft);
    await user.click(within(dialog).getByRole("button", { name: words.cancel }));
    expect(setStatus).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: words.statusAction.archived }));
    dialog = screen.getByRole("dialog", { name: words.confirmStatusTitle.archived });
    await user.click(within(dialog).getByRole("button", { name: words.statusAction.archived }));
    expect(setStatus).toHaveBeenCalledWith({ id: ID, loadedAt: LOADED, status: "archived" });
    expect(onChanged).toHaveBeenCalledWith("archived", NEWER);
    // The words come with the transition's last render, which can follow onChanged.
    await waitFor(() => {
      expect(screen.getByRole("status").textContent).toBe(
        words.statusChanged(words.statusName.archived),
      );
    });
  });

  it("refuses a stale change with a prompt to reload", async () => {
    const user = userEvent.setup();
    render(
      <CourseStatusPanel
        courseId={ID}
        status="draft"
        loadedAt={LOADED}
        setStatus={() => Promise.resolve({ ok: false, error: "stale" })}
        onChanged={vi.fn()}
      />,
    );
    await user.click(screen.getByRole("button", { name: words.statusAction.published }));
    await expectAlert(structure.failure.stale);
    expect(screen.getByRole("button", { name: structure.reload })).toBeTruthy();
  });
});
