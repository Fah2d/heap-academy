import { redirect } from "next/navigation";
import { pageIdentity } from "@/infrastructure/auth/page-identity";
import { supabaseProfileStore } from "@/infrastructure/db/profile-store";
import { createSessionClient } from "@/infrastructure/db/session-client";
import { updateProfile } from "../server/actions";
import { profileSummary } from "../server/profile";
import { ProfileView } from "./profile-view";
import { TimeZoneReporter } from "./time-zone-reporter";

/**
 * `/profile`: for a signed-in learner; a visitor is sent to sign in and back.
 * A profile that cannot be read ends on the shared error page, with Try again.
 */
export async function ProfilePage() {
  const identity = await pageIdentity();
  if (identity === null) redirect("/sign-in?returnTo=%2Fprofile");
  const store = supabaseProfileStore(await createSessionClient("read-only"));
  const summary = await profileSummary(identity.userId, store);
  if (summary === null) throw new Error("profile: could not be read");
  return (
    <>
      <TimeZoneReporter stored={summary.timeZone} updateProfile={updateProfile} />
      <ProfileView summary={summary} updateProfile={updateProfile} />
    </>
  );
}
