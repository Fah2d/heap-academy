"use client";

import type { ComponentProps, ReactNode } from "react";
import { profileGallery as words } from "@/messages/gallery";
import { DeleteAccount, type DeleteAccountActions } from "./delete-account";
import { ProfileView } from "./profile-view";

type Summary = ComponentProps<typeof ProfileView>["summary"];

/** How the sample deletion answers: never, so it stays pending; yes; or no. */
export type GalleryDeletion = "hangs" | "succeeds" | "fails";

const FILLED: Summary = {
  displayName: words.sampleName,
  timeZone: "UTC",
  xp: 30,
  lessons: 3,
  completedLessonIds: [],
  currentStreak: 2,
  longestStreak: 4,
};

const EMPTY: Summary = {
  ...FILLED,
  xp: 0,
  lessons: 0,
  currentStreak: 0,
  longestStreak: 0,
};

const never = <Value,>() => new Promise<Value>(() => undefined);

function deletion(outcome: GalleryDeletion): DeleteAccountActions {
  return {
    deleteAccount: () => {
      if (outcome === "hangs") return never();
      return Promise.resolve(
        outcome === "succeeds"
          ? { ok: true as const }
          : { ok: false as const, error: "unavailable" },
      );
    },
    // The deleted state stays: here no session ends and no page follows.
    signOut: () => never(),
  };
}

/**
 * The profile with sample numbers and answers that never reach a server
 * (`/dev/profile`): a learner with progress, a new learner, and a deletion
 * that stays pending, succeeds or fails. The name and the deletion dialog
 * are the real components.
 */
export function ProfileGallery({
  empty,
  outcome,
  signOut,
}: {
  empty: boolean;
  outcome: GalleryDeletion;
  signOut: ReactNode;
}) {
  return (
    <ProfileView
      summary={empty ? EMPTY : FILLED}
      courses={
        empty ? [] : [{ slug: "python-basics", title: words.sampleCourse, completed: 3, total: 5 }]
      }
      coursePath={(slug) => `/courses/${slug}`}
      updateProfile={() => Promise.resolve({ ok: true })}
      signOut={signOut}
      deleteAccount={<DeleteAccount {...deletion(outcome)} />}
    />
  );
}
