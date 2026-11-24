// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SignOutButton } from "./account-buttons";

const clear = vi.fn(async () => undefined);
vi.mock("@/features/progress", () => ({ deviceProgress: () => ({ clear }) }));

afterEach(cleanup);

describe("[FR-AUTH-05] sign out", () => {
  it("forgets the completions on this device and still submits the form", async () => {
    const submit = vi.fn((event: { preventDefault: () => void }) => event.preventDefault());
    render(
      <form onSubmit={submit}>
        <SignOutButton label="Sign out" pendingLabel="Signing out" />
      </form>,
    );
    await userEvent.click(screen.getByRole("button", { name: "Sign out" }));
    expect(clear).toHaveBeenCalledOnce();
    expect(submit).toHaveBeenCalledOnce();
  });
});
