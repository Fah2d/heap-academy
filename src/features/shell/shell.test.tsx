// @vitest-environment jsdom
import { act, cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { StrictMode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { gallery } from "@/messages/gallery";
import { errorPage, notFound } from "@/messages/system";
import { pageTitle, shell } from "@/messages/shell";
import type { ErrorReporter } from "./client/report-client-error";
import { ErrorView, errorReference } from "./components/error-view";
import { NotFoundView } from "./components/not-found-view";
import { PrimitiveGallery } from "./components/primitive-gallery";
// fonts.ts runs only under the Next.js compiler, so the test imports the
// modules directly rather than through index.ts.
import { SiteShell } from "./components/site-shell";

afterEach(cleanup);

const REQUEST_ID = "9b2f6c1e-4a7d-4e0b-8f3a-2d5c7e9a1b4f";

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
    render(
      <ErrorView
        error={new Error("boom")}
        retry={retry}
        report={() => Promise.resolve(undefined)}
      />,
    );
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

  it("[FR-SYS-01] [NFR-OBS-01] does not report a server error, which the server has logged", () => {
    const report = vi.fn<ErrorReporter>(() => Promise.resolve(REQUEST_ID));
    render(<ErrorView error={serverError("2741609137")} retry={() => undefined} report={report} />);
    expect(report).not.toHaveBeenCalled();
  });

  it("[FR-SYS-01] [NFR-OBS-01] [NFR-OBS-02] reports a browser error once, then shows the server's request ID", async () => {
    window.history.replaceState(null, "", "/courses/python?email=ada%40example.com#top");
    const report = vi.fn<ErrorReporter>(() => Promise.resolve(REQUEST_ID));
    render(
      <StrictMode>
        <ErrorView
          error={new Error("thrown in the browser")}
          retry={() => undefined}
          report={report}
        />
      </StrictMode>,
    );
    const reference = await screen.findByText(REQUEST_ID);
    expect(reference.tagName).toBe("CODE");
    expect(reference.closest("p")?.textContent).toBe(`${errorPage.referenceLabel} ${REQUEST_ID}`);
    expect(screen.getByText(errorPage.referenceHint)).toBeTruthy();
    expect(report).toHaveBeenCalledOnce();
    expect(report).toHaveBeenCalledWith({ code: "unexpected-exception", route: "/courses/python" });
  });

  it("[FR-SYS-01] shows no reference while the report is on its way, or when it fails", async () => {
    let settle: (reference: string | undefined) => void = () => undefined;
    const report = vi.fn<ErrorReporter>(
      () =>
        new Promise((resolve) => {
          settle = resolve;
        }),
    );
    render(
      <ErrorView
        error={new Error("thrown in the browser")}
        retry={() => undefined}
        report={report}
      />,
    );
    expect(screen.queryByText(errorPage.referenceLabel, { exact: false })).toBeNull();
    await act(async () => {
      settle(undefined);
      await Promise.resolve();
    });
    expect(report).toHaveBeenCalledOnce();
    expect(screen.queryByText(errorPage.referenceLabel, { exact: false })).toBeNull();
    expect(screen.queryByText(errorPage.referenceHint)).toBeNull();
  });

  it("[FR-SYS-01] [NFR-OBS-01] reports a new error again and never shows the reference of the one before", async () => {
    const answers = [Promise.resolve(REQUEST_ID), new Promise<string | undefined>(() => undefined)];
    const report = vi.fn<ErrorReporter>(() => answers.shift() ?? Promise.resolve(undefined));
    const { rerender } = render(
      <ErrorView error={new Error("first")} retry={() => undefined} report={report} />,
    );
    await screen.findByText(REQUEST_ID);
    rerender(<ErrorView error={new Error("second")} retry={() => undefined} report={report} />);
    expect(report).toHaveBeenCalledTimes(2);
    expect(screen.queryByText(REQUEST_ID)).toBeNull();
  });

  it("[FR-SYS-01] [NFR-OBS-01] takes the digest as the reference, and invents nothing", () => {
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

describe("page title", () => {
  it("[FR-SYS-01] builds the error pages' title from the one template", () => {
    expect(pageTitle(errorPage.title)).toBe(`${errorPage.title} | ${shell.productName}`);
    expect(shell.titleTemplate).toContain("%s");
  });

  it("[ADR-0014] keeps a dollar sign in a title as written", () => {
    expect(pageTitle("Cost: $' and $&")).toBe(`Cost: $' and $& | ${shell.productName}`);
  });
});

describe("primitive gallery", () => {
  it("[ADR-0014] shows the button with an icon and the full-width button", () => {
    render(<PrimitiveGallery />);
    const withIcon = screen
      .getAllByRole("button", { name: gallery.run })
      .filter((button) => button.querySelector('[aria-hidden="true"] svg') !== null);
    // Run is a secondary action (DESIGN.md section 4.5), so it is shown only as one.
    expect(withIcon).toHaveLength(1);
    expect(withIcon[0]?.className.split(/\s+/)).not.toContain("bg-action");
    const fullWidth = screen
      .getAllByRole("button", { name: gallery.check })
      .filter((button) => button.className.split(/\s+/).includes("w-full"));
    expect(fullWidth).toHaveLength(1);
  });
});
