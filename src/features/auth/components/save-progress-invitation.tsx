"use client";

import { useRef, useState, useSyncExternalStore } from "react";
import { invitation as words } from "@/messages/sign-in";
import { Button, Link } from "@/ui";
import { useSignInHref } from "./account-buttons";

// The invitation to save progress (FR-AUTH-07; docs/spec/03-experience.md
// section 6.6). The root layout hands it to the progress feature for a guest
// only, and the workspace shows it below a new completion. It never blocks
// the next action, and once hidden it does not return in this browser
// session. Where the browser refuses session storage, hiding lasts as long
// as the page.
//
// The host gives the card a parent that can take focus (tabIndex -1): focus
// moves there when the card is hidden, so it is not lost to the page.

const DISMISSED = "heap-academy.invitation-hidden";

function readHidden(): boolean {
  try {
    return window.sessionStorage.getItem(DISMISSED) === "1";
  } catch {
    // Session storage refused: the card shows, and hiding it lasts the page.
    return false;
  }
}

function writeHidden(): void {
  try {
    window.sessionStorage.setItem(DISMISSED, "1");
  } catch {
    // Session storage refused: the state below still hides the card.
  }
}

const subscribeToNothing = () => () => undefined;

export function SaveProgressInvitation() {
  const { href } = useSignInHref();
  const card = useRef<HTMLElement>(null);
  const [hidden, setHidden] = useState(false);
  // Hidden on the server: the card belongs to a completion, which only the browser has.
  const hiddenEarlier = useSyncExternalStore(subscribeToNothing, readHidden, () => true);
  if (hidden || hiddenEarlier) return null;
  const hide = () => {
    writeHidden();
    card.current?.parentElement?.focus();
    setHidden(true);
  };
  return (
    <section
      ref={card}
      aria-label={words.label}
      data-invitation
      className="flex flex-col items-start gap-3 rounded-panel border border-border bg-surface p-4"
    >
      <p className="max-inline-prose text-base text-text">{words.body}</p>
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
        <Link href={href} variant="standalone" fullLoad>
          {words.signIn}
        </Link>
        <Button variant="secondary" onPress={hide}>
          {words.dismiss}
        </Button>
      </div>
    </section>
  );
}
