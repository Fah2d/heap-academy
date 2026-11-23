// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { courseEditor as words, structure } from "@/messages/admin";
import { CourseDetailsForm, type SaveCourse } from "./course-details-form";
import { NewCourseForm } from "./new-course-form";

// The Details of a course (FR-ADM-03, FR-ADM-10): every field that is wrong
// is named before anything is sent; a create opens the new editor; an edit
// names the loaded version; a stale save is refused with a prompt to reload.

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
const never = () => new Promise<never>(() => undefined);
const initial = {
  title: "Python basics",
  slug: "python-basics",
  summary: "Write your first programs.",
  outcomes: ["Print a line"],
};

describe("CourseDetailsForm [FR-ADM-03, FR-ADM-10]", () => {
  it("names each wrong field, focuses the first, and sends nothing", async () => {
    const save = vi.fn<SaveCourse>(never);
    const user = userEvent.setup();
    render(<NewCourseForm saveCourse={save} navigate={() => undefined} />);
    await user.type(screen.getByLabelText(words.slugLabel), "Not A Slug");
    await user.click(screen.getByRole("button", { name: words.create }));
    expect(save).not.toHaveBeenCalled();
    expect(screen.getByText(words.fieldInvalid.title)).toBeTruthy();
    expect(screen.getByText(words.fieldInvalid.slug)).toBeTruthy();
    expect(screen.getByText(words.fieldInvalid.summary)).toBeTruthy();
    await vi.waitFor(() =>
      expect(document.activeElement).toBe(screen.getByLabelText(words.titleLabel)),
    );
  });

  it("creates a course with the outcome lines filled, then opens its editor", async () => {
    const save = vi.fn<SaveCourse>(() => Promise.resolve({ ok: true, value: { id: ID } }));
    const navigate = vi.fn();
    const user = userEvent.setup();
    render(<NewCourseForm saveCourse={save} navigate={navigate} />);
    await user.type(screen.getByLabelText(words.titleLabel), " Python basics ");
    await user.type(screen.getByLabelText(words.slugLabel), "python-basics");
    await user.type(screen.getByLabelText(words.summaryLabel), "Write your first programs.");
    await user.type(screen.getByLabelText(words.outcomeLabel(2)), "Print a line");
    await user.click(screen.getByRole("button", { name: words.create }));
    expect(save).toHaveBeenCalledWith({ details: initial });
    expect(navigate).toHaveBeenCalledWith(`/admin/courses/${ID}`);
    // Nothing is left unsaved, so the browser does not ask on the way out.
    const unload = new Event("beforeunload", { cancelable: true });
    window.dispatchEvent(unload);
    expect(unload.defaultPrevented).toBe(false);
  });

  it("names a taken address and keeps what was typed", async () => {
    const user = userEvent.setup();
    render(
      <NewCourseForm
        saveCourse={() => Promise.resolve({ ok: false, error: "slug_taken" })}
        navigate={() => undefined}
      />,
    );
    await user.type(screen.getByLabelText(words.titleLabel), "T");
    await user.type(screen.getByLabelText(words.slugLabel), "taken");
    await user.type(screen.getByLabelText(words.summaryLabel), "S");
    await user.click(screen.getByRole("button", { name: words.create }));
    // The Address field's own error, with focus on it.
    const slug = screen.getByLabelText<HTMLInputElement>(words.slugLabel);
    expect(slug.getAttribute("aria-invalid")).toBe("true");
    expect(screen.getByText(structure.failure.slug_taken)).toBeTruthy();
    await new Promise((resolve) => requestAnimationFrame(resolve));
    expect(document.activeElement).toBe(slug);
    expect(slug.value).toBe("taken");
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("saves an edit over the loaded version and reports it", async () => {
    const save = vi.fn<SaveCourse>(() =>
      Promise.resolve({ ok: true, value: { id: ID, updatedAt: NEWER } }),
    );
    const onSaved = vi.fn();
    const user = userEvent.setup();
    render(
      <CourseDetailsForm
        course={{ id: ID, loadedAt: LOADED }}
        initial={initial}
        save={save}
        onSaved={onSaved}
      />,
    );
    expect(screen.getByLabelText<HTMLInputElement>(words.outcomeLabel(1)).value).toBe(
      "Print a line",
    );
    await user.type(screen.getByLabelText(words.titleLabel), "!");
    await user.click(screen.getByRole("button", { name: words.save }));
    expect(save).toHaveBeenCalledWith({
      id: ID,
      loadedAt: LOADED,
      details: { ...initial, title: "Python basics!" },
    });
    expect(onSaved).toHaveBeenCalledWith(NEWER);
    expect(screen.getByRole("status").textContent).toBe(words.saved);
  });

  it("refuses a stale save with a prompt to reload, and keeps the changes", async () => {
    const user = userEvent.setup();
    render(
      <CourseDetailsForm
        course={{ id: ID, loadedAt: LOADED }}
        initial={initial}
        save={() => Promise.resolve({ ok: false, error: "stale" })}
      />,
    );
    await user.type(screen.getByLabelText(words.summaryLabel), " More.");
    await user.click(screen.getByRole("button", { name: words.save }));
    await expectAlert(structure.failure.stale);
    expect(screen.getByRole("button", { name: structure.reload })).toBeTruthy();
    expect(screen.getByLabelText<HTMLInputElement>(words.summaryLabel).value).toBe(
      "Write your first programs. More.",
    );
    // Still unsaved: leaving asks.
    const unload = new Event("beforeunload", { cancelable: true });
    window.dispatchEvent(unload);
    expect(unload.defaultPrevented).toBe(true);
  });

  it("shows the saving state while the save is on its way", async () => {
    const user = userEvent.setup();
    render(
      <CourseDetailsForm course={{ id: ID, loadedAt: LOADED }} initial={initial} save={never} />,
    );
    await user.click(screen.getByRole("button", { name: words.save }));
    // Pending keeps the button focusable, so focus does not fall to the page.
    const saving = screen.getByRole("button", { name: words.saving });
    expect(saving.hasAttribute("data-pending")).toBe(true);
    expect(document.activeElement).toBe(saving);
  });
});
