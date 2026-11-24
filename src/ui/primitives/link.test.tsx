// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Link } from "@/ui";

// Next.js's link navigates on the client. jsdom has no router, so the mock
// marks what it renders, and the test can tell the two kinds of link apart.
vi.mock("next/link", () => ({
  default: ({ children, ...props }: { children: ReactNode; href: string }) => (
    <a data-client-navigation="" {...props}>
      {children}
    </a>
  ),
}));

afterEach(cleanup);

describe("Link", () => {
  it("[FR-AUTH-06] navigates on the client by default", () => {
    render(
      <Link href="/courses" variant="nav">
        Courses
      </Link>,
    );
    expect(
      screen.getByRole("link", { name: "Courses" }).hasAttribute("data-client-navigation"),
    ).toBe(true);
  });

  it("[FR-AUTH-06] makes a full-load link a plain anchor, so the page loads with its own headers", () => {
    render(
      <Link href="/sign-in?returnTo=%2F" variant="nav" current fullLoad>
        Sign in
      </Link>,
    );
    const link = screen.getByRole("link", { name: "Sign in" });
    expect(link.hasAttribute("data-client-navigation")).toBe(false);
    expect(link.getAttribute("href")).toBe("/sign-in?returnTo=%2F");
    expect(link.getAttribute("aria-current")).toBe("page");
    expect(link.classList.contains("border-action")).toBe(true);
  });
});
