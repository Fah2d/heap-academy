import { verifiedIdentity } from "@/infrastructure/auth/verified-identity";
import { createSessionClient } from "@/infrastructure/db/session-client";
import { account } from "@/messages/sign-in";
import { signOut } from "../server/actions";
import { SignInLink, SignOutButton } from "./account-buttons";

/**
 * The account control at the end of the header (docs/spec/03-experience.md
 * section 4): "Sign in" for a visitor, "Sign out" for a signed-in learner.
 * The profile page joins it in WP-6.3.
 */
export async function AccountControl() {
  const identity = await verifiedIdentity(await createSessionClient("read-only"));
  if (identity === null) return <SignInLink label={account.signIn} />;
  return (
    <form action={signOut}>
      <SignOutButton label={account.signOut} pendingLabel={account.signingOut} />
    </form>
  );
}
