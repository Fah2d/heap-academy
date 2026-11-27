// @vitest-environment jsdom
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { profile as words } from "@/messages/profile";
import { DeleteAccount, type DeleteAccountActions } from "./delete-account";

const mocks = vi.hoisted(() => ({ clear: vi.fn(async () => {}) }));
vi.mock("@/features/progress", () => ({ deviceProgress: () => ({ clear: mocks.clear }) }));

beforeEach(() => vi.clearAllMocks());
afterEach(cleanup);

const defaults = () => ({
  deleteAccount: vi.fn<DeleteAccountActions["deleteAccount"]>(async () => ({ ok: true })),
  signOut: vi.fn<DeleteAccountActions["signOut"]>(async () => {}),
});

async function open(over: Partial<DeleteAccountActions> = {}) {
  const spies = defaults();
  const actions = { ...spies, ...over };
  const user = userEvent.setup();
  render(<DeleteAccount {...actions} />);
  await user.click(screen.getByRole("button", { name: words.deleteAccount }));
  const type = async (text: string) => {
    await user.type(screen.getByRole("textbox", { name: words.confirmLabel }), text);
    await user.click(screen.getByRole("button", { name: words.deleteAccount }));
  };
  return { actions, spies, user, type };
}

describe("[FR-PRF-03] [J-10] the delete account dialog", () => {
  it("says what is erased, and deletes nothing until the word is typed", async () => {
    const { actions, type } = await open();
    expect(screen.getByText(words.deleteWarning)).toBeTruthy();
    await type("delete");
    expect(screen.getByText(words.confirmProblem)).toBeTruthy();
    expect(actions.deleteAccount).not.toHaveBeenCalled();
  });

  it("closes on Cancel with nothing deleted", async () => {
    const { actions, user } = await open();
    await user.click(screen.getByRole("button", { name: words.cancel }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(actions.deleteAccount).not.toHaveBeenCalled();
  });

  it("deletes, forgets the device's completions, and then signs out", async () => {
    const { spies: actions, type } = await open();
    await type("DELETE");
    await waitFor(() => expect(actions.signOut).toHaveBeenCalledOnce());
    expect(actions.deleteAccount.mock.calls).toEqual([[{ confirmation: "DELETE" }]]);
    expect(mocks.clear).toHaveBeenCalledOnce();
    expect(mocks.clear.mock.invocationCallOrder[0]).toBeLessThan(
      actions.signOut.mock.invocationCallOrder[0] ?? 0,
    );
    expect(screen.getByRole("status").textContent).toBe(words.deleted);
  });

  // If ending the session stalls, the learner still has a way out, and the
  // dialog no longer asks a question already answered (WP-9.1 design review, m9).
  it("names the outcome and offers the home page once the account is deleted", async () => {
    const { type } = await open({ signOut: () => new Promise(() => {}) });
    await type("DELETE");
    const dialog = await screen.findByRole("dialog", { name: words.deletedTitle });
    expect(within(dialog).getByRole("link", { name: words.deletedHome }).getAttribute("href")).toBe(
      "/",
    );
  });

  it("shows that it is working", async () => {
    const { type } = await open({ deleteAccount: () => new Promise(() => {}) });
    await type("DELETE");
    expect(await screen.findByRole("button", { name: words.deleting })).toBeTruthy();
  });

  it.each([
    ["sign_in_again", words.deleteSignInAgain],
    ["not_signed_in", words.deleteSignedOut],
    ["unavailable", words.deleteFailed],
  ])("explains %s and keeps the device's completions", async (error, text) => {
    const { actions, type } = await open({
      deleteAccount: async () => ({ ok: false, error }),
    });
    await type("DELETE");
    expect(await screen.findByText(text)).toBeTruthy();
    expect(mocks.clear).not.toHaveBeenCalled();
    expect(actions.signOut).not.toHaveBeenCalled();
  });

  it("treats a thrown action as a failure", async () => {
    const { type } = await open({
      deleteAccount: async () => {
        throw new Error("network");
      },
    });
    await type("DELETE");
    expect(await screen.findByText(words.deleteFailed)).toBeTruthy();
  });
});
