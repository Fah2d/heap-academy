// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { account } from "@/messages/sign-in";
import { AccountControl } from "./account-control";

const { pageIdentity } = vi.hoisted(() => ({ pageIdentity: vi.fn() }));
vi.mock("@/infrastructure/auth/page-identity", () => ({ pageIdentity }));
vi.mock("../server/actions", () => ({ signOut: vi.fn() }));
vi.mock("@/features/progress", () => ({
  SignedInProgressSync: () => <span data-testid="sync" />,
  deviceProgress: () => ({ clear: vi.fn() }),
}));
vi.mock("next/navigation", () => ({
  usePathname: () => "/",
  useSearchParams: () => new URLSearchParams(),
}));

afterEach(cleanup);

describe("[FR-PRG-02] the progress sync runs for a signed-in learner only", () => {
  it("is not rendered for a visitor", async () => {
    pageIdentity.mockResolvedValue(null);
    render(await AccountControl());
    expect(screen.queryByTestId("sync")).toBeNull();
  });

  it("is rendered beside Sign out for a signed-in learner", async () => {
    pageIdentity.mockResolvedValue({ userId: "u" });
    render(await AccountControl());
    expect(screen.getByTestId("sync")).toBeTruthy();
    expect(screen.getByRole("button", { name: account.signOut })).toBeTruthy();
  });
});
