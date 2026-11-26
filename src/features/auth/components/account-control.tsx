import { SignedInProgressSync } from "@/features/progress";
import { account } from "@/messages/sign-in";
import { viewer } from "../server/viewer";
import { SignInLink } from "./account-buttons";
import { ProfileNavLink } from "./profile-nav-link";
import { SignOutForm } from "./sign-out-form";

/**
 * The account control at the end of the header (docs/spec/03-experience.md
 * section 4): "Sign in" for a visitor, "Sign out" for a signed-in learner.
 * A signed-in learner also gets "Profile". Being on every page, it also starts
 * the progress sync for a signed-in learner (FR-PRG-02).
 */
export async function AccountControl() {
  const identity = await viewer();
  if (identity === null) return <SignInLink label={account.signIn} />;
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
      <SignedInProgressSync />
      <ProfileNavLink />
      <SignOutForm />
    </div>
  );
}
