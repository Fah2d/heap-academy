// @vitest-environment jsdom
import { cleanup, render, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { BotChallenge } from "./bot-challenge";

// The widget's size follows the room it has: Cloudflare's flexible widget is
// at least 300 px wide, so a narrower column, such as a 320 px phone with its
// gutters, gets the compact one instead of a widget past the gutter.

function withWidth(width: number) {
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue(
    DOMRect.fromRect({ width, height: 0 }),
  );
}

function renderedSize() {
  const renderWidget = vi.fn(() => "widget");
  window.turnstile = { render: renderWidget, reset: vi.fn(), remove: vi.fn() };
  render(<BotChallenge siteKey="site-key" onToken={vi.fn()} onLoadFailed={vi.fn()} resetKey={0} />);
  return renderWidget;
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  delete window.turnstile;
});

describe("[FR-AUTH-06] the bot challenge", () => {
  it("fills the column when the column holds the widget", async () => {
    withWidth(400);
    const renderWidget = renderedSize();
    await waitFor(() => {
      expect(renderWidget).toHaveBeenCalledWith(
        expect.any(HTMLElement),
        expect.objectContaining({ size: "flexible" }),
      );
    });
  });

  it("is compact when the column is narrower than the widget's least width", async () => {
    withWidth(288);
    const renderWidget = renderedSize();
    await waitFor(() => {
      expect(renderWidget).toHaveBeenCalledWith(
        expect.any(HTMLElement),
        expect.objectContaining({ size: "compact" }),
      );
    });
  });

  it("is compact just under the least width, and fills the column at it", async () => {
    withWidth(299.5);
    const narrow = renderedSize();
    await waitFor(() => {
      expect(narrow).toHaveBeenCalledWith(
        expect.any(HTMLElement),
        expect.objectContaining({ size: "compact" }),
      );
    });
    cleanup();
    withWidth(300);
    const wide = renderedSize();
    await waitFor(() => {
      expect(wide).toHaveBeenCalledWith(
        expect.any(HTMLElement),
        expect.objectContaining({ size: "flexible" }),
      );
    });
  });
});
