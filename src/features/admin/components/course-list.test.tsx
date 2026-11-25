// @vitest-environment jsdom
import { act, cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { dashboard as words, structure } from "@/messages/admin";
import type { AdminCourse } from "../types";
import { CourseList } from "./course-list";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));

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

const course = (id: string, title: string, extra: Partial<AdminCourse> = {}): AdminCourse => ({
  id,
  slug: id.slice(-4),
  title,
  status: "draft",
  publishedLessons: 0,
  draftLessons: 0,
  ...extra,
});

const A = "00000000-0000-4000-8000-00000000000a";
const B = "00000000-0000-4000-8000-00000000000b";
const never = () => new Promise<never>(() => undefined);

describe("CourseList [docs/spec/03-experience.md section 7.2, FR-ADM-03]", () => {
  it("lists each course with its status, lesson counts, editor link and order", () => {
    render(
      <CourseList
        result={{
          ok: true,
          courses: [course(A, "<b>Python</b>", { publishedLessons: 0, draftLessons: 3 })],
        }}
        reorder={never}
        refresh={() => undefined}
      />,
    );
    const table = screen.getByRole("table", { name: words.tableCaption });
    const row = within(table).getByRole("row", { name: /Python/ });
    // A title is text, never markup (T-07).
    expect(within(row).getByRole("rowheader").textContent).toContain("<b>Python</b>");
    expect(within(row).getByRole("link", { name: "<b>Python</b>" }).getAttribute("href")).toBe(
      `/admin/courses/${A}`,
    );
    const cells = within(row).getAllByRole("cell");
    expect(cells.slice(0, 3).map((cell) => cell.textContent)).toEqual([
      words.status.draft,
      "0",
      "3",
    ]);
    // One course: it can move neither way.
    expect(
      within(row).getByRole("button", { name: structure.moveUp("<b>Python</b>") }),
    ).toHaveProperty("disabled", true);
    expect(screen.getByRole("link", { name: words.newCourse }).getAttribute("href")).toBe(
      "/admin/courses/new",
    );
  });

  it("says what to do first when there are no courses, with New course and no table", () => {
    render(<CourseList result={{ ok: true, courses: [] }} reorder={never} />);
    expect(screen.getByText(words.empty)).toBeTruthy();
    expect(screen.getByRole("link", { name: words.newCourse })).toBeTruthy();
    expect(screen.queryByRole("table")).toBeNull();
  });

  it("says so when the list could not load, with no table and no action", () => {
    render(<CourseList result={{ ok: false }} reorder={never} />);
    expect(screen.getByText(words.loadFailed)).toBeTruthy();
    expect(screen.queryByRole("table")).toBeNull();
    expect(screen.queryByRole("link", { name: words.newCourse })).toBeNull();
  });

  it("moves a course, reads the list again, and keeps focus on the pressed button", async () => {
    const reorder = vi.fn(() => Promise.resolve({ ok: true as const, value: null }));
    const refresh = vi.fn();
    const user = userEvent.setup();
    const { rerender } = render(
      <CourseList
        result={{ ok: true, courses: [course(A, "Alpha"), course(B, "Beta")] }}
        reorder={reorder}
        refresh={refresh}
      />,
    );
    // First and last cannot move past the ends.
    expect(screen.getByRole("button", { name: structure.moveUp("Alpha") })).toHaveProperty(
      "disabled",
      true,
    );
    expect(screen.getByRole("button", { name: structure.moveDown("Beta") })).toHaveProperty(
      "disabled",
      true,
    );
    await user.click(screen.getByRole("button", { name: structure.moveDown("Alpha") }));
    expect(reorder).toHaveBeenCalledWith({ kind: "course", id: A, direction: "down" });
    expect(refresh).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("status").textContent).toBe(structure.moved);
    // The refreshed list arrives in the new order.
    await act(async () => {
      rerender(
        <CourseList
          result={{ ok: true, courses: [course(B, "Beta"), course(A, "Alpha")] }}
          reorder={reorder}
          refresh={refresh}
        />,
      );
      await Promise.resolve();
    });
    // Alpha is last now, so Move down is disabled and focus is on Move up.
    expect(document.activeElement).toBe(
      screen.getByRole("button", { name: structure.moveUp("Alpha") }),
    );
  });

  it("shows why a move was refused, and reads nothing again", async () => {
    const refresh = vi.fn();
    const user = userEvent.setup();
    render(
      <CourseList
        result={{ ok: true, courses: [course(A, "Alpha"), course(B, "Beta")] }}
        reorder={() => Promise.resolve({ ok: false, error: "cannot_move" })}
        refresh={refresh}
      />,
    );
    await user.click(screen.getByRole("button", { name: structure.moveUp("Beta") }));
    await expectAlert(structure.failure.cannot_move);
    expect(refresh).not.toHaveBeenCalled();
  });

  it("treats a thrown action as a failure, not a crash", async () => {
    const user = userEvent.setup();
    render(
      <CourseList
        result={{ ok: true, courses: [course(A, "Alpha"), course(B, "Beta")] }}
        reorder={() => Promise.reject(new Error("network"))}
        refresh={() => undefined}
      />,
    );
    await user.click(screen.getByRole("button", { name: structure.moveUp("Beta") }));
    await expectAlert(structure.failure.unavailable);
  });
});
