"use client";

import { useEffect } from "react";
import type { BotChallengeProps } from "./bot-challenge";
import { type SignInActions, SignInView } from "./sign-in-view";

/** How the sample auth service answers a request for a code: never, yes, or too many. */
export type GallerySend = "hangs" | "sent" | "limited";
/** How it answers a code: never, not accepted, or too many tries. */
export type GalleryVerify = "hangs" | "rejected" | "limited";

const never = <Value,>() => new Promise<Value>(() => undefined);

/** Hands out a token at once, as the real challenge does once solved. */
function StandInChallenge({ onToken, resetKey }: BotChallengeProps) {
  useEffect(() => {
    onToken(`gallery-${String(resetKey)}`);
  }, [onToken, resetKey]);
  return null;
}

function galleryActions(send: GallerySend, verify: GalleryVerify): SignInActions {
  return {
    requestEmailCode: () => {
      if (send === "hangs") return never();
      return Promise.resolve(
        send === "sent"
          ? { ok: true as const, value: null }
          : { ok: false as const, error: "rate_limited" },
      );
    },
    verifyEmailCode: () =>
      verify === "hangs"
        ? never()
        : Promise.resolve({
            ok: false as const,
            error: verify === "rejected" ? "code_rejected" : "rate_limited",
          }),
    startGoogleSignIn: () => Promise.resolve({ failed: true }),
  };
}

/**
 * The sign-in view with a stand-in bot challenge and answers that never
 * reach the auth service (`/dev/sign-in`): sending, too many codes, the code
 * step, checking, a code not accepted, and too many tries. The view is the real component.
 */
export function SignInGallery({ send, verify }: { send: GallerySend; verify: GalleryVerify }) {
  return (
    <SignInView
      returnTo="/courses"
      inAppBrowser={false}
      googleFailed={false}
      challengeSiteKey="gallery"
      actions={galleryActions(send, verify)}
      navigate={() => undefined}
      Challenge={StandInChallenge}
    />
  );
}
