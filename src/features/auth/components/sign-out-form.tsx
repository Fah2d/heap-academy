import { account } from "@/messages/sign-in";
import { signOut } from "../server/actions";
import { SignOutButton } from "./account-buttons";

/** "Sign out", in the header and in the profile's account section (FR-AUTH-05). */
export function SignOutForm() {
  return (
    <form action={signOut}>
      <SignOutButton label={account.signOut} pendingLabel={account.signingOut} />
    </form>
  );
}
