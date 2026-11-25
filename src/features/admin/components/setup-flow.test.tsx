// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { secondStep as words } from "@/messages/admin";
import type { ActionOutcome } from "../types";
import { groupKey, type SetupCode, SetupFlow, type StartSetupAction } from "./setup-flow";

afterEach(cleanup);

/**
 * An announced notice's region is in the page first and its words follow a
 * frame later (`LiveRegion`), so the test waits for the words in the region.
 */
async function expectAlert(text: string) {
  await waitFor(() => {
    expect(screen.getByRole("alert").textContent).toContain(text);
  });
}

const code: SetupCode = { qrCodeSvg: "<svg/>", secret: "JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP" };

function flow(answer: () => Promise<ActionOutcome<SetupCode>>) {
  const startSetup = vi.fn<StartSetupAction>(answer);
  const confirmSetup = vi.fn(() => Promise.resolve({ ok: true as const, value: null }));
  const navigate = vi.fn();
  render(<SetupFlow startSetup={startSetup} confirmSetup={confirmSetup} navigate={navigate} />);
  return { startSetup, confirmSetup, navigate };
}

const start = () => userEvent.click(screen.getByRole("button", { name: words.start }));

describe("SetupFlow [FR-ADM-02]", () => {
  it("makes nothing until asked: no QR code, no code field, one button", () => {
    const { startSetup } = flow(() => Promise.resolve({ ok: true, value: code }));
    expect(startSetup).not.toHaveBeenCalled();
    expect(screen.queryByRole("img")).toBeNull();
    expect(screen.queryByRole("textbox")).toBeNull();
    expect(screen.getByText(words.startHint)).toBeTruthy();
  });

  it("shows the QR code, the key in groups of four, and the code field after the press", async () => {
    const { startSetup } = flow(() => Promise.resolve({ ok: true, value: code }));
    await start();
    expect(startSetup).toHaveBeenCalledWith({});
    const image = screen.getByRole("img", { name: words.qrAlt });
    expect(image.getAttribute("src")).toContain("data:image/svg+xml");
    const term = screen.getByText(words.manualKeyLabel);
    expect(term.tagName).toBe("DT");
    expect(term.nextElementSibling?.textContent).toBe("JBSW Y3DP EHPK 3PXP JBSW Y3DP EHPK 3PXP");
    expect(screen.getByRole("textbox", { name: words.codeLabel })).toBeTruthy();
    expect(screen.queryByRole("button", { name: words.start })).toBeNull();
  });

  it("goes to verify when an app was added in the meantime", async () => {
    const { navigate } = flow(() => Promise.resolve({ ok: false, error: "already_enrolled" }));
    await start();
    expect(navigate).toHaveBeenCalledWith("/admin/verify");
  });

  it.each([
    ["the service is down", () => Promise.resolve({ ok: false as const, error: "unavailable" })],
    ["the action cannot be reached", () => Promise.reject(new Error("network"))],
  ])("announces the failure when %s, and offers the button again", async (_, answer) => {
    flow(answer);
    await start();
    await expectAlert(words.setupUnavailable);
    expect(screen.getByRole("button", { name: words.start })).toBeTruthy();
    expect(screen.queryByRole("img")).toBeNull();
  });

  it("shows the waiting state while the QR code is made", async () => {
    let finish: (value: ActionOutcome<SetupCode>) => void = () => undefined;
    flow(() => new Promise((resolve) => (finish = resolve)));
    await start();
    const button = await screen.findByRole("button", { name: words.starting });
    expect(button.hasAttribute("disabled") || button.getAttribute("aria-disabled") === "true").toBe(
      true,
    );
    finish({ ok: true, value: code });
    expect(await screen.findByRole("img", { name: words.qrAlt })).toBeTruthy();
  });
});

describe("groupKey", () => {
  it("splits into groups of four and keeps a short tail", () => {
    expect(groupKey("ABCDEFGHIJ")).toBe("ABCD EFGH IJ");
    expect(groupKey("")).toBe("");
  });
});
