// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { secondStep as words } from "@/messages/admin";
import type { ActionOutcome } from "../types";
import { type SecondStepAction, SecondStepForm } from "./second-step-form";

afterEach(cleanup);

function form(answer: () => Promise<ActionOutcome<null>>, autoFocus = false) {
  const action = vi.fn<SecondStepAction>(answer);
  const navigate = vi.fn();
  render(
    <SecondStepForm
      action={action}
      submitLabel="Continue"
      autoFocus={autoFocus}
      navigate={navigate}
    />,
  );
  return { action, navigate, field: screen.getByRole("textbox", { name: words.codeLabel }) };
}

const submit = () => userEvent.click(screen.getByRole("button", { name: "Continue" }));

describe("SecondStepForm [FR-ADM-02]", () => {
  it("sends six digits, spaces removed, and opens the dashboard with a full load", async () => {
    const { action, navigate, field } = form(() => Promise.resolve({ ok: true, value: null }));
    await userEvent.type(field, "123 456");
    await submit();
    expect(action).toHaveBeenCalledWith({ code: "123456" });
    expect(navigate).toHaveBeenCalledWith("/admin");
  });

  it.each(["12345", "abcdef", ""])(
    "refuses %j in the browser without calling the action",
    async (code) => {
      const { action, field } = form(() => Promise.resolve({ ok: true, value: null }));
      if (code !== "") await userEvent.type(field, code);
      await submit();
      expect(action).not.toHaveBeenCalled();
      expect(field.getAttribute("aria-invalid")).toBe("true");
      expect(screen.getByText(words.codeInvalid)).toBeTruthy();
    },
  );

  it.each([
    ["code_rejected", words.codeRejected],
    ["rate_limited", words.tooManyAttempts],
    ["setup_replaced", words.setupReplaced],
    ["unavailable", words.unavailable],
    ["not_found", words.unavailable],
    ["unauthenticated", words.unavailable],
  ])("announces %s, clears the field, and stays on the page", async (error, text) => {
    const { navigate, field } = form(() => Promise.resolve({ ok: false, error }));
    await userEvent.type(field, "123456");
    await submit();
    expect((await screen.findByRole("alert")).textContent).toContain(text);
    expect((field as HTMLInputElement).value).toBe("");
    expect(document.activeElement).toBe(field);
    expect(navigate).not.toHaveBeenCalled();
  });

  it("marks the field when the server refuses the input", async () => {
    const { field } = form(() => Promise.resolve({ ok: false, error: "invalid_input" }));
    await userEvent.type(field, "123456");
    await submit();
    expect(field.getAttribute("aria-invalid")).toBe("true");
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("reports the service down when the action cannot be reached", async () => {
    const { field } = form(() => Promise.reject(new Error("network")));
    await userEvent.type(field, "123456");
    await submit();
    expect((await screen.findByRole("alert")).textContent).toContain(words.unavailable);
  });

  it("shows the checking state and blocks a second submit while the code is checked", async () => {
    let finish: (value: ActionOutcome<null>) => void = () => undefined;
    const { action, field } = form(() => new Promise((resolve) => (finish = resolve)));
    await userEvent.type(field, "123456");
    await submit();
    const button = await screen.findByRole("button", { name: words.checking });
    expect(button.hasAttribute("disabled") || button.getAttribute("aria-disabled") === "true").toBe(
      true,
    );
    await userEvent.click(button);
    expect(action).toHaveBeenCalledOnce();
    finish({ ok: false, error: "code_rejected" });
    expect((await screen.findByRole("alert")).textContent).toContain(words.codeRejected);
  });

  it("puts focus in the field on load only when asked", () => {
    const { field } = form(() => Promise.resolve({ ok: true, value: null }), true);
    expect(document.activeElement).toBe(field);
    cleanup();
    const second = form(() => Promise.resolve({ ok: true, value: null }), false);
    expect(document.activeElement).not.toBe(second.field);
  });

  it("asks the browser for a one-time code from the numeric keypad", () => {
    const { field } = form(() => Promise.resolve({ ok: true, value: null }));
    expect(field.getAttribute("autocomplete")).toBe("one-time-code");
    expect(field.getAttribute("inputmode")).toBe("numeric");
  });
});
