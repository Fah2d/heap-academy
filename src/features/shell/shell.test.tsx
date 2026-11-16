// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { errorPage, notFound } from "@/messages/system";
import { shell } from "@/messages/shell";
import { ErrorView, errorReference } from "./components/error-view";
import { NotFoundView } from "./components/not-found-view";
// fonts.ts runs only under the Next.js compiler, so the test imports the
// modules directly rather than through index.ts.
import { SiteShell } from "./components/site-shell";

afterEach(cleanup);

function serverError(digest: string): Error {
  return Object.assign(new Error("An error occurred in the Server Components render."), { digest });
}

describe("not-found page", () => {
  it("[FR-SYS-01] says what happened and offers the home page", () => {
    render(<NotFoundView />);
    expect(screen.getByRole("heading", { level: 1, name: notFound.heading })).toBeTruthy();
    expect(screen.getByText(notFound.body)).toBeTruthy();
    expect(screen.getByRole("link", { name: notFound.homeLink }).getAttribute("href")).toBe("/");
  });
});

describe("error page", () => {
  it("[FR-SYS-01] says what happened and lets the learner try again", async () => {
    const retry = vi.fn();
    render(<ErrorView error={new Error("boom")} retry={retry} />);
    expect(screen.getByRole("heading", { level: 1, name: errorPage.heading })).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: errorPage.retry }));
    expect(retry).toHaveBeenCalledOnce();
    expect(screen.getByRole("link", { name: errorPage.homeLink }).getAttribute("href")).toBe("/");
  });

  it("[FR-SYS-01] [NFR-OBS-01] shows the server's digest as the reference", () => {
    render(<ErrorView error={serverError("2741609137")} retry={() => undefined} />);
    const reference = screen.getByText("2741609137");
    expect(reference.tagName).toBe("CODE");
    expect(reference.closest("p")?.textContent).toBe(`${errorPage.referenceLabel} 2741609137`);
    expect(screen.getByText(errorPage.referenceHint)).toBeTruthy();
  });

  it("[FR-SYS-01] asks for no reference when it has none to show", () => {
    render(<ErrorView error={new Error("thrown in the browser")} retry={() => undefined} />);
    expect(screen.queryByText(errorPage.referenceLabel, { exact: false })).toBeNull();
    expect(screen.queryByText(errorPage.referenceHint)).toBeNull();
  });

  // A browser error is logged nowhere until the client error report exists, so
  // no reference could lead to it (owner's decision on pull request #3).
  it("[FR-SYS-01] [NFR-OBS-01] shows only the server's digest, and invents nothing", () => {
    expect(errorReference(serverError("123"))).toBe("123");
    expect(errorReference(serverError(""))).toBeUndefined();
    expect(errorReference("a thrown string")).toBeUndefined();
    expect(errorReference(new Error("x"))).toBeUndefined();
  });
});

describe("site shell", () => {
  it("[NFR-A11Y-03] puts the skip link first and points it at the main landmark", async () => {
    render(
      <SiteShell>
        <p>Content</p>
      </SiteShell>,
    );
    await userEvent.tab();
    const skip = screen.getByRole("link", { name: shell.skipLink });
    expect(document.activeElement).toBe(skip);
    expect(skip.getAttribute("href")).toBe("#main");
    expect(screen.getByRole("main").id).toBe("main");
  });

  it("[ADR-0031] shows the wordmark as live text linking home, and a banner landmark", () => {
    render(
      <SiteShell>
        <p>Content</p>
      </SiteShell>,
    );
    expect(screen.getByRole("banner")).toBeTruthy();
    expect(screen.getByRole("link", { name: shell.productName }).getAttribute("href")).toBe("/");
  });
});
