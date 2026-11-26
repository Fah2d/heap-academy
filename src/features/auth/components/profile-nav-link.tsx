"use client";

import { usePathname } from "next/navigation";
import { account } from "@/messages/sign-in";
import { Link } from "@/ui";

const PROFILE_PATH = "/profile";

/** Profile in the header, for a signed-in learner (docs/spec/03-experience.md section 3). */
export function ProfileNavLink() {
  return (
    <Link href={PROFILE_PATH} variant="nav" current={usePathname() === PROFILE_PATH}>
      {account.profile}
    </Link>
  );
}
