// @vitest-environment jsdom
import { act, cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useEffect } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { signIn as words } from "@/messages/sign-in";
import type { BotChallengeProps } from "./bot-challenge";
import { RESEND_SECONDS, type SignInActions, SignInView } from "./sign-in-view";

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

/** A challenge that hands out a fresh token on mount and on every reset. */
function PassingChallenge({ onToken, resetKey }: BotChallengeProps) {
  useEffect(() => {
    onToken(`token-${resetKey}-${Math.random()}`);
  }, [onToken, resetKey]);
  return null;
}

function SilentChallenge() {
  return null;
}

function BrokenChallenge({ onLoadFailed }: BotChallengeProps) {
  useEffect(() => onLoadFailed(), [onLoadFailed]);
  return null;
}

function actions(overrides: Partial<SignInActions> = {}): SignInActions {
  return {
    requestEmailCode: vi.fn(() => Promise.resolve({ ok: true as const, value: null })),
    verifyEmailCode: vi.fn(() =>
      Promise.resolve({ ok: true as const, value: { returnTo: "/courses/python" } }),
    ),
    startGoogleSignIn: vi.fn(() => Promise.resolve({ failed: true })),
    ...overrides,
  };
}

function view(
  props: Partial<Parameters<typeof SignInView>[0]> = {},
  given: SignInActions = actions(),
) {
  const navigate = vi.fn();
  render(
    <SignInView
      returnTo="/courses/python"
      inAppBrowser={false}
      googleFailed={false}
      challengeSiteKey="1x00000000000000000000AA"
      actions={given}
      navigate={navigate}
      Challenge={PassingChallenge}
      {...props}
    />,
  );
  return { navigate, actions: given };
}

async function sendCodeTo(address: string) {
  await userEvent.type(screen.getByRole("textbox", { name: words.emailLabel }), address);
  await userEvent.click(screen.getByRole("button", { name: words.sendCode }));
}

describe("sign-in view", () => {
  it("[FR-AUTH-01] [FR-AUTH-02] offers Google first, then the email code, under one heading", () => {
    view();
    expect(screen.getByRole("heading", { level: 1, name: words.title })).toBeTruthy();
    const google = screen.getByRole("button", { name: words.google });
    const email = screen.getByRole("textbox", { name: words.emailLabel });
    expect(google.compareDocumentPosition(email) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("[FR-AUTH-03] in an in-app browser, leads with the email code, says why, and can still show Google", async () => {
    view({ inAppBrowser: true });
    expect(screen.getByText(words.inAppBrowser)).toBeTruthy();
    expect(screen.queryByRole("button", { name: words.google })).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: words.showGoogle }));
    const google = screen.getByRole("button", { name: words.google });
    const email = screen.getByRole("textbox", { name: words.emailLabel });
    expect(email.compareDocumentPosition(google) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("[FR-AUTH-01] says when Google sign-in did not finish", () => {
    view({ googleFailed: true });
    expect(screen.getByText(words.googleFailed)).toBeTruthy();
  });

  it("[FR-AUTH-01] shows a notice when Google cannot start, and posts the return path", async () => {
    const given = actions();
    view({}, given);
    await userEvent.click(screen.getByRole("button", { name: words.google }));
    expect(await screen.findByText(words.googleUnavailable)).toBeTruthy();
    const form = vi.mocked(given.startGoogleSignIn).mock.calls[0]?.[1];
    expect(form?.get("returnTo")).toBe("/courses/python");
  });

  it("[FR-AUTH-02] refuses an address without an @ before asking the server", async () => {
    const { actions: given } = view();
    await sendCodeTo("not-an-address");
    expect(screen.getByText(words.emailInvalid)).toBeTruthy();
    expect(given.requestEmailCode).not.toHaveBeenCalled();
  });

  it("[FR-AUTH-06] waits for the bot challenge before sending", async () => {
    const { actions: given } = view({ Challenge: SilentChallenge });
    expect(screen.getByText(words.challengeLoading)).toBeTruthy();
    await sendCodeTo("ada@example.test");
    expect(screen.getByText(words.challengeNeeded)).toBeTruthy();
    expect(given.requestEmailCode).not.toHaveBeenCalled();
  });

  it("[FR-AUTH-06] says when the bot challenge did not load", () => {
    view({ Challenge: BrokenChallenge });
    expect(screen.getByRole("alert").textContent).toContain(words.challengeNotLoaded);
  });

  it("[FR-AUTH-02] [FR-AUTH-06] sends the code with the token, then asks for the code in the same view", async () => {
    const { actions: given } = view();
    await sendCodeTo("ada@example.test");
    expect(given.requestEmailCode).toHaveBeenCalledWith({
      email: "ada@example.test",
      challengeToken: expect.stringMatching(/^token-0-/),
    });
    expect(await screen.findByText(words.codeSentTo("ada@example.test"))).toBeTruthy();
    const field = screen.getByRole("textbox", { name: words.codeLabel });
    expect(document.activeElement).toBe(field);
    expect(field.getAttribute("autocomplete")).toBe("one-time-code");
    expect(field.getAttribute("inputmode")).toBe("numeric");
  });

  it.each([
    ["rate_limited", words.sendRateLimited],
    ["challenge_failed", words.challengeFailed],
    ["unavailable", words.unavailable],
  ])("[FR-AUTH-06] shows the send failure %s", async (error, text) => {
    view({}, actions({ requestEmailCode: () => Promise.resolve({ ok: false as const, error }) }));
    await sendCodeTo("ada@example.test");
    expect((await screen.findByRole("alert")).textContent).toContain(text);
    expect(screen.getByRole("textbox", { name: words.emailLabel })).toBeTruthy();
  });

  it("[FR-AUTH-02] [FR-AUTH-04] accepts a pasted code with a space and returns to the page the learner came from", async () => {
    const { actions: given, navigate } = view();
    await sendCodeTo("ada@example.test");
    const field = await screen.findByRole("textbox", { name: words.codeLabel });
    await userEvent.click(field);
    await userEvent.paste("123 456");
    await userEvent.click(screen.getByRole("button", { name: words.verify }));
    expect(given.verifyEmailCode).toHaveBeenCalledWith({
      email: "ada@example.test",
      code: "123456",
      returnTo: "/courses/python",
    });
    expect(navigate).toHaveBeenCalledWith("/courses/python");
  });

  it("[FR-AUTH-02] refuses a code that is not six digits before asking the server", async () => {
    const { actions: given } = view();
    await sendCodeTo("ada@example.test");
    await userEvent.type(await screen.findByRole("textbox", { name: words.codeLabel }), "12a");
    await userEvent.click(screen.getByRole("button", { name: words.verify }));
    expect(screen.getByText(words.codeInvalid)).toBeTruthy();
    expect(given.verifyEmailCode).not.toHaveBeenCalled();
  });

  it.each([
    ["code_rejected", words.codeRejected],
    ["rate_limited", words.tooManyAttempts],
    ["unavailable", words.unavailable],
  ])("[FR-AUTH-02] shows the verify failure %s and stays on the code step", async (error, text) => {
    const { navigate } = view(
      {},
      actions({ verifyEmailCode: () => Promise.resolve({ ok: false as const, error }) }),
    );
    await sendCodeTo("ada@example.test");
    await userEvent.type(await screen.findByRole("textbox", { name: words.codeLabel }), "123456");
    await userEvent.click(screen.getByRole("button", { name: words.verify }));
    expect((await screen.findByRole("alert")).textContent).toContain(text);
    expect(navigate).not.toHaveBeenCalled();
    expect(screen.getByRole("textbox", { name: words.codeLabel })).toBeTruthy();
  });

  it("[FR-AUTH-02] holds the resend control for the provider's interval, with the time left shown", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const user = userEvent.setup({ advanceTimers: (ms) => vi.advanceTimersByTime(ms) });
    const { actions: given } = view();
    await user.type(screen.getByRole("textbox", { name: words.emailLabel }), "ada@example.test");
    await user.click(screen.getByRole("button", { name: words.sendCode }));
    const resend = await screen.findByRole("button", { name: words.resend });
    expect(resend.hasAttribute("disabled")).toBe(true);
    expect(screen.getByText(words.resendWait(RESEND_SECONDS))).toBeTruthy();
    // One second at a time: each tick renders, and the render sets the next timer.
    for (let second = 0; second < RESEND_SECONDS; second += 1) {
      await act(() => vi.advanceTimersByTimeAsync(1000));
    }
    expect(screen.queryByText(words.resendWait(1))).toBeNull();
    expect(screen.getByRole("button", { name: words.resend }).hasAttribute("disabled")).toBe(false);
    await user.click(screen.getByRole("button", { name: words.resend }));
    expect(given.requestEmailCode).toHaveBeenCalledTimes(2);
    // A token is used once: the resend carries a fresh one.
    const tokens = vi
      .mocked(given.requestEmailCode)
      .mock.calls.map(([input]) => input.challengeToken);
    expect(tokens[1]).not.toBe(tokens[0]);
    expect(await screen.findByText(words.resent)).toBeTruthy();
  });

  it("[FR-AUTH-02] lets the learner change the email", async () => {
    view();
    await sendCodeTo("ada@example.test");
    await userEvent.click(await screen.findByRole("button", { name: words.changeEmail }));
    const field = screen.getByRole("textbox", { name: words.emailLabel });
    expect((field as HTMLInputElement).value).toBe("ada@example.test");
    expect(document.activeElement).toBe(field);
  });

  it("[FR-AUTH-03] moves focus to Google's button when the learner asks to see it", async () => {
    view({ inAppBrowser: true });
    await userEvent.click(screen.getByRole("button", { name: words.showGoogle }));
    expect(document.activeElement).toBe(screen.getByRole("button", { name: words.google }));
  });

  it("[FR-AUTH-02] shows a failure inside the form that caused it, next to its button", async () => {
    view(
      {},
      actions({
        requestEmailCode: () => Promise.resolve({ ok: false as const, error: "unavailable" }),
      }),
    );
    await sendCodeTo("ada@example.test");
    const alert = await screen.findByRole("alert");
    const form = screen.getByRole("button", { name: words.sendCode }).closest("form");
    expect(form?.contains(alert)).toBe(true);
  });
});
