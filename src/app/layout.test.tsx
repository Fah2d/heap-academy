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
vi.mock("@/features/catalog", () => ({ CoursesNavLink: () => null, SITE_ORIGIN: "http://x.test" }));
vi.mock("@/features/shell", () => ({
  fontVariables: "",
  SiteShell: ({ children }: { children: ReactNode }) => children,
}));

const { default: RootLayout } = await import("./layout");
const { useDeviceCompletions } = await import("@/features/progress");

function Probe() {
  return <p>{[...(useDeviceCompletions() ?? [])].join(" ")}</p>;
}

describe("the root layout", () => {
  it("[FR-PRG-02] hands the account's lessons to the page it renders", async () => {
    expect(renderToString(await RootLayout({ children: <Probe /> }))).toContain(`<p>${LESSON}</p>`);
  });
});
