import type { ReactNode } from "react";
import { renderToString } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("next/server", () => ({ connection: () => Promise.resolve() }));

const LESSON = "00000000-0000-4000-8000-00000000000a";

vi.mock("@/features/auth", () => ({
  AccountControl: () => null,
  accountLessons: () => Promise.resolve([LESSON]),
  guestInvitation: () => Promise.resolve(null),
}));
vi.mock("@/features/catalog", () => ({
  CoursesNavLink: () => <a href="/courses">courses</a>,
  SITE_ORIGIN: "http://x.test",
}));
vi.mock("@/features/shell", () => ({
  fontVariables: "",
  SiteBar: ({ navigation }: { navigation: ReactNode }) => <nav>site bar {navigation}</nav>,
  SiteShell: ({ bar, children }: { bar: ReactNode; children: ReactNode }) => (
    <>
      <header>{bar}</header>
      {children}
    </>
  ),
}));
// Async server component with its own test; renderToString cannot wait for it.
vi.mock("@/features/system", () => ({ CspNonceMeta: () => null }));

const { default: RootLayout } = await import("./layout");
const { useDeviceCompletions } = await import("@/features/progress");

function Probe() {
  return <p>{[...(useDeviceCompletions() ?? [])].join(" ")}</p>;
}

describe("the root layout", () => {
  it("[FR-PRG-02] hands the account's lessons to the page it renders", async () => {
    expect(renderToString(await RootLayout({ children: <Probe />, bar: null }))).toContain(
      `<p>${LESSON}</p>`,
    );
  });

  // Next.js renders a not-found page without the `bar` slot, so the header
  // would lose the wordmark and the site's pages (WP-8.2).
  it("[NFR-A11Y-03] keeps the site's bar when the page has no bar of its own", async () => {
    const html = renderToString(await RootLayout({ children: null, bar: undefined }));
    expect(html).toContain('<header><nav>site bar <a href="/courses">courses</a></nav></header>');
  });

  it("[NFR-A11Y-03] shows the page's own bar when it has one", async () => {
    const html = renderToString(await RootLayout({ children: null, bar: <p>lesson bar</p> }));
    expect(html).toContain("<header><p>lesson bar</p></header>");
  });
});
