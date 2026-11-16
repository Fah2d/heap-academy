// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { errorPage, notFound } from "@/messages/system";
import { shell } from "@/messages/shell";
import { ErrorView, errorReference } from "./components/error-view";
import { NotFoundView } from "./components/not-found-view";
import { RequestIdProvider } from "./components/request-id-context";
import { SiteShell } from "./components/site-shell";
// fonts.ts runs only under the Next.js compiler, so the test imports the
// modules directly rather than through index.ts.
import { parseRequestId } from "./request-id";

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

  it("[FR-SYS-01] [NFR-OBS-01] shows the request ID when the error has no digest", () => {
    const requestId = parseRequestId("req_7f3a9c2e41b8");
    render(
      <RequestIdProvider requestId={requestId}>
        <ErrorView error={new Error("thrown in the browser")} retry={() => undefined} />
      </RequestIdProvider>,
    );
    expect(screen.getByText("req_7f3a9c2e41b8").tagName).toBe("CODE");
  });

  it("[FR-SYS-01] prefers the digest, falls back to the request ID, and invents nothing", () => {
    expect(errorReference(serverError("123"), "req_abcdefgh")).toBe("123");
    expect(errorReference(serverError(""), "req_abcdefgh")).toBe("req_abcdefgh");
    expect(errorReference("a thrown string", "req_abcdefgh")).toBe("req_abcdefgh");
    expect(errorReference(new Error("x"), undefined)).toBeUndefined();
  });
});

describe("request ID", () => {
  it("[NFR-OBS-01] accepts a well-formed ID and rejects anything else", () => {
    expect(parseRequestId("0b6f7c1e-4d2a-4f3e-9a51-2c8e7d6b5a40")).toBe(
      "0b6f7c1e-4d2a-4f3e-9a51-2c8e7d6b5a40",
    );
    expect(parseRequestId(null)).toBeUndefined();
    expect(parseRequestId("<script>")).toBeUndefined();
    expect(parseRequestId("short")).toBeUndefined();
    expect(parseRequestId("x".repeat(65))).toBeUndefined();
  });
});

describe("site shell", () => {
  it("[NFR-A11Y-06] puts the skip link first and points it at the main landmark", async () => {
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
