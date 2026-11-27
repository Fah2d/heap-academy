"use client";

import { useEffect, useRef } from "react";

// The bot challenge on the email form (FR-AUTH-06): Cloudflare Turnstile,
// rendered explicitly. Its script comes from BOT_CHALLENGE_ORIGIN; the page
// policy lets this nonce-trusted bundle add it ('strict-dynamic') and frames
// the widget on the sign-in page only (06-security-privacy.md section 5.2).
// The token goes to the server action, and the auth provider checks it.

const SCRIPT_URL = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";

// Cloudflare's flexible widget fills its column but is never narrower than
// 300 px; the compact one is 150 by 140 px. A narrower column, such as a
// 320 px phone with its gutters, gets the compact one, so the widget stays
// inside the gutter. --challenge-height-compact reserves its height. All in
// CSS px, which Cloudflare uses whatever the font size; the same number is
// --container-challenge, which decides the reserved height.
const FLEXIBLE_MIN_WIDTH = 300;

type TurnstileOptions = {
  sitekey: string;
  callback: (token: string) => void;
  "expired-callback": () => void;
  "error-callback": () => void;
  theme: "dark";
  size: "flexible" | "compact";
};
type Turnstile = {
  render: (element: HTMLElement, options: TurnstileOptions) => string;
  reset: (widgetId: string) => void;
  remove: (widgetId: string) => void;
};

declare global {
  interface Window {
    turnstile?: Turnstile;
  }
}

let loading: Promise<Turnstile> | undefined;

function loadTurnstile(): Promise<Turnstile> {
  if (window.turnstile) return Promise.resolve(window.turnstile);
  loading ??= new Promise<Turnstile>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = SCRIPT_URL;
    script.async = true;
    script.onload = () => {
      if (window.turnstile) resolve(window.turnstile);
      else reject(new Error("turnstile missing"));
    };
    script.onerror = () => {
      loading = undefined;
      reject(new Error("turnstile failed to load"));
    };
    document.head.append(script);
  });
  return loading;
}

export type BotChallengeProps = {
  siteKey: string;
  /** A new token, or null when the last one expired or failed. */
  onToken: (token: string | null) => void;
  /** The script did not load: the view says so. */
  onLoadFailed: () => void;
  /** Changing it asks for a fresh token: each token can be used once. */
  resetKey: number;
};

export function BotChallenge({ siteKey, onToken, onLoadFailed, resetKey }: BotChallengeProps) {
  const container = useRef<HTMLDivElement>(null);
  const widget = useRef<{ api: Turnstile; id: string } | null>(null);
  const callbacks = useRef({ onToken, onLoadFailed });
  useEffect(() => {
    callbacks.current = { onToken, onLoadFailed };
  }, [onToken, onLoadFailed]);

  useEffect(() => {
    let cancelled = false;
    loadTurnstile().then(
      (api) => {
        if (cancelled || container.current === null) return;
        const id = api.render(container.current, {
          sitekey: siteKey,
          callback: (token) => callbacks.current.onToken(token),
          "expired-callback": () => callbacks.current.onToken(null),
          "error-callback": () => callbacks.current.onToken(null),
          theme: "dark",
          // The exact width, as the container query reads it, not a rounded one.
          size:
            container.current.getBoundingClientRect().width < FLEXIBLE_MIN_WIDTH
              ? "compact"
              : "flexible",
        });
        widget.current = { api, id };
      },
      () => {
        if (!cancelled) callbacks.current.onLoadFailed();
      },
    );
    return () => {
      cancelled = true;
      if (widget.current) widget.current.api.remove(widget.current.id);
      widget.current = null;
    };
  }, [siteKey]);

  useEffect(() => {
    if (resetKey === 0 || widget.current === null) return;
    callbacks.current.onToken(null);
    widget.current.api.reset(widget.current.id);
  }, [resetKey]);

  // The column's own width decides the height kept for the widget, as it
  // decides the widget's size above.
  return (
    <div className="@container">
      <div
        ref={container}
        className="min-h-(--challenge-height) @max-challenge:min-h-(--challenge-height-compact)"
      />
    </div>
  );
}
