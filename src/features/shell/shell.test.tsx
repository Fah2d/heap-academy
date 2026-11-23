// @vitest-environment jsdom
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { gallery } from "@/messages/gallery";
import { legal, privacy, terms } from "@/messages/legal";
import { errorPage, notFound } from "@/messages/system";
import { pageTitle, shell } from "@/messages/shell";
import { ErrorView, errorReference } from "./components/error-view";
import { GlobalErrorBody } from "./components/global-error-body";
import { LegalPage } from "./components/legal-page";
import { NotFoundView } from "./components/not-found-view";
import { PrimitiveGallery } from "./components/primitive-gallery";
// fonts.ts runs only under the Next.js compiler, so the test imports the
// modules directly rather than through index.ts.
import { FOOTER_LINKS, SiteFooter } from "./components/site-footer";
import { SiteShell } from "./components/site-shell";

// The footer reads the current address to mark its current link.
const navigation = vi.hoisted(() => ({ pathname: "/" }));
vi.mock("next/navigation", () => ({ usePathname: () => navigation.pathname }));

beforeEach(() => {
  navigation.pathname = "/";
});
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

describe("site footer", () => {
  it("[FR-SYS-03] is the contentinfo landmark, after main, with the privacy and terms links", () => {
    render(
      <SiteShell>
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
