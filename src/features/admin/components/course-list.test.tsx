// @vitest-environment jsdom
import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { dashboard as words } from "@/messages/admin";
import { CourseList } from "./course-list";

afterEach(cleanup);

describe("CourseList [docs/spec/03-experience.md section 7.2]", () => {
  it("lists each course with its status and lesson counts", () => {
    render(
      <CourseList
        result={{
          ok: true,
          courses: [
            {
              id: "00000000-0000-4000-8000-000000000010",
              slug: "python",
              title: "<b>Python</b>",
              status: "draft",
              publishedLessons: 0,
              draftLessons: 3,
            },
          ],
        }}
      />,
    );
    const table = screen.getByRole("table", { name: words.tableCaption });
    const row = within(table).getByRole("row", { name: /Python/ });
    // A title is text, never markup (T-07).
    expect(within(row).getByRole("rowheader").textContent).toContain("<b>Python</b>");
    expect(within(row).getByText(words.status.draft)).toBeTruthy();
    expect(
      within(row)
        .getAllByRole("cell")
        .map((cell) => cell.textContent),
    ).toEqual([words.status.draft, "0", "3"]);
  });

  it("says so when there are no courses, with no table", () => {
    render(<CourseList result={{ ok: true, courses: [] }} />);
    expect(screen.getByText(words.empty)).toBeTruthy();
    expect(screen.queryByRole("table")).toBeNull();
  });

  it("says so when the list could not load", () => {
    render(<CourseList result={{ ok: false }} />);
    expect(screen.getByText(words.loadFailed)).toBeTruthy();
    expect(screen.queryByRole("table")).toBeNull();
  });
});
