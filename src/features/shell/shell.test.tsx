// @vitest-environment jsdom
import { act, cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { StrictMode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { gallery } from "@/messages/gallery";
import { legal, privacy, terms } from "@/messages/legal";
import { errorPage, notFound } from "@/messages/system";
import { pageTitle, shell } from "@/messages/shell";
import type { ErrorReporter } from "@/domain/client-error";
import { ErrorView, errorReference } from "./components/error-view";
import { GlobalErrorBody } from "./components/global-error-body";
import { LegalPage } from "./components/legal-page";
import { NotFoundView } from "./components/not-found-view";
import { PrimitiveGallery } from "./components/primitive-gallery";
// fonts.ts runs only under the Next.js compiler, so the test imports the
// modules directly rather than through index.ts.
import { FOOTER_LINKS, SiteFooter } from "./components/site-footer";
import { LessonBar, SiteBar, SiteShell } from "./components/site-shell";

// The footer reads the current address to mark its current link.
const navigation = vi.hoisted(() => ({ pathname: "/courses" }));
vi.mock("next/navigation", () => ({ usePathname: () => navigation.pathname }));

beforeEach(() => {
  navigation.pathname = "/courses";
});
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

  it("[FR-SYS-01] offers no way back to the home page when the home page is what failed", () => {
    navigation.pathname = "/";
    render(<ErrorView error={new Error("boom")} retry={() => undefined} />);
    expect(screen.getByRole("button", { name: errorPage.retry })).toBeTruthy();
    expect(screen.queryByRole("link", { name: errorPage.homeLink })).toBeNull();
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

  it("[FR-SYS-01] lets the reference wrap only after its hyphens, and copies it unchanged", async () => {
    render(
      <ErrorView
        error={new Error("thrown in the browser")}
        retry={() => undefined}
        report={() => Promise.resolve(REQUEST_ID)}
      />,
    );
    const reference = await screen.findByText(REQUEST_ID);
    expect(reference.textContent).toBe(REQUEST_ID);
    expect(reference.innerHTML).toBe(REQUEST_ID.split("-").join("-<wbr>"));
    expect(reference.className.split(/\s+/)).not.toContain("break-all");
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
      <SiteShell bar={<SiteBar navigation={null} />} account={<a href="/sign-in">Account</a>}>
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
      <SiteShell bar={<SiteBar navigation={null} />} account={<a href="/sign-in">Account</a>}>
        <p>Content</p>
      </SiteShell>,
    );
    expect(screen.getByRole("banner")).toBeTruthy();
    expect(screen.getByRole("link", { name: shell.productName }).getAttribute("href")).toBe("/");
  });

  it("[FR-AUTH-05] puts the account control in a labelled navigation landmark in the header", () => {
    render(
      <SiteShell bar={<SiteBar navigation={null} />} account={<a href="/sign-in">Account</a>}>
        <p>Content</p>
      </SiteShell>,
    );
    const nav = screen.getByRole("navigation", { name: shell.accountNavigation });
    expect(screen.getByRole("banner").contains(nav)).toBe(true);
    expect(nav.textContent).toBe("Account");
  });

  it("[FR-CAT-01] puts the site's own pages in a main navigation landmark after the wordmark", () => {
    render(
      <SiteShell
        bar={<SiteBar navigation={<a href="/courses">Courses</a>} />}
        account={<a href="/sign-in">Account</a>}
      >
        <p>Content</p>
      </SiteShell>,
    );
    const nav = screen.getByRole("navigation", { name: shell.mainNavigation });
    expect(screen.getByRole("banner").contains(nav)).toBe(true);
    expect(nav.textContent).toBe("Courses");
    const links = screen.getAllByRole("link").map((link) => link.textContent);
    expect(links.indexOf("Courses")).toBe(links.indexOf(shell.productName) + 1);
  });
});

describe("lesson bar", () => {
  it("[FR-WSP-01] is one compact bar in the banner: back to the course, the lesson's title as the h1, the account control", () => {
    render(
      <SiteShell
        bar={
          <LessonBar
            back={{ href: "/courses/python", label: "Back to Python" }}
            title="Say hello"
          />
        }
        account={<a href="/sign-in">Account</a>}
      >
        <p>Content</p>
      </SiteShell>,
    );
    const banner = screen.getByRole("banner");
    const back = within(banner).getByRole("link", { name: "Back to Python" });
    expect(back.getAttribute("href")).toBe("/courses/python");
    expect(within(banner).getByRole("heading", { level: 1 }).textContent).toBe("Say hello");
    expect(within(banner).getByRole("navigation", { name: shell.accountNavigation })).toBeTruthy();
    // The wordmark row is replaced, not stacked above the bar.
    expect(screen.queryByRole("link", { name: shell.productName })).toBeNull();
    expect(screen.queryByRole("navigation", { name: shell.mainNavigation })).toBeNull();
  });
});

describe("site footer", () => {
  it("[FR-SYS-03] is the contentinfo landmark, after main, with the privacy and terms links", () => {
    render(
      <SiteShell bar={<SiteBar navigation={null} />} account={null}>
        <p>Content</p>
      </SiteShell>,
    );
    const footer = screen.getByRole("contentinfo");
    const main = screen.getByRole("main");
    expect(main.compareDocumentPosition(footer) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(main.contains(footer)).toBe(false);
    const links = within(footer).getAllByRole("link");
    expect(links.map((link) => [link.textContent, link.getAttribute("href")])).toEqual([
      [shell.footer.privacy, "/privacy"],
      [shell.footer.terms, "/terms"],
    ]);
    for (const link of links) expect(link.getAttribute("aria-current")).toBeNull();
  });

  it("[FR-SYS-03] links only to pages that exist under src/app", () => {
    for (const { href } of FOOTER_LINKS) {
      expect(existsSync(join(process.cwd(), "src", "app", href, "page.tsx")), href).toBe(true);
    }
  });

  it("[FR-SYS-03] marks the link of the page that is open", () => {
    navigation.pathname = "/terms";
    render(<SiteFooter />);
    const footer = screen.getByRole("contentinfo");
    expect(
      within(footer).getByRole("link", { name: shell.footer.terms }).getAttribute("aria-current"),
    ).toBe("page");
    expect(
      within(footer).getByRole("link", { name: shell.footer.privacy }).getAttribute("aria-current"),
    ).toBeNull();
  });

  it("[FR-SYS-03] is on the page that replaces a failed root layout", () => {
    render(<GlobalErrorBody error={new Error("layout failed")} retry={() => undefined} />);
    expect(screen.getByRole("heading", { level: 1, name: errorPage.heading })).toBeTruthy();
    const footer = screen.getByRole("contentinfo");
    expect(screen.getByRole("main").contains(footer)).toBe(false);
    expect(
      within(footer)
        .getAllByRole("link")
        .map((link) => link.getAttribute("href")),
    ).toEqual(["/privacy", "/terms"]);
  });
});

describe("legal pages", () => {
  for (const content of [privacy, terms]) {
    it(`[FR-SYS-03] shows the ${content.title} with its date and every section in order`, () => {
      const { container } = render(<LegalPage content={content} />);
      expect(screen.getByRole("heading", { level: 1, name: content.title })).toBeTruthy();
      const time = container.querySelector("time");
      expect(time?.getAttribute("dateTime")).toBe(content.updated.iso);
      expect(time?.closest("p")?.textContent).toBe(`${legal.updatedLabel} ${content.updated.text}`);
      expect(screen.getByText(content.intro)).toBeTruthy();
      const headings = screen.getAllByRole("heading", { level: 2 });
      expect(headings.map((heading) => heading.textContent)).toEqual(
        content.sections.map((section) => section.heading),
      );
      // Only the page's own landmarks: the sections are not regions.
      expect(screen.queryAllByRole("region")).toEqual([]);
      for (const section of content.sections) {
        const heading = screen.getByRole("heading", { level: 2, name: section.heading });
        const body = heading.closest("section");
        if (body === null) throw new Error(`${section.heading} is not in a section`);
        for (const block of section.blocks) {
          if (block.kind === "paragraph") {
            expect(within(body).getByText(block.text).tagName).toBe("P");
          } else if (block.kind === "list") {
            const items = within(body)
              .getAllByRole("listitem")
              .map((item) => item.textContent);
            for (const item of block.items) expect(items).toContain(item);
          } else {
            const link = within(body).getByRole("link", { name: block.label });
            expect(link.getAttribute("href")).toBe(block.href);
            expect(link.closest("p")?.textContent).toBe(
              `${block.before}${block.label}${block.after}`,
            );
          }
        }
      }
    });
  }
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
