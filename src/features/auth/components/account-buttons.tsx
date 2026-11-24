"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { useFormStatus } from "react-dom";
import { Button, Link } from "@/ui";

const SIGN_IN = "/sign-in";

/**
 * "Sign in", carrying the page the visitor is on, so sign-in returns there
 * (FR-AUTH-04). A full load: after a client-side navigation the page would
 * keep the previous page's policy, which does not let the bot challenge frame
 * load, so no code could be sent (FR-AUTH-06).
 */
export function SignInLink({ label }: { label: string }) {
  const pathname = usePathname();
  const query = useSearchParams().toString();
  const current = pathname === SIGN_IN;
  const returnTo = query === "" ? pathname : `${pathname}?${query}`;
  const href = current ? SIGN_IN : `${SIGN_IN}?${new URLSearchParams({ returnTo })}`;
  return (
    <Link href={href} variant="nav" current={current} fullLoad>
      {label}
    </Link>
  );
}

export function SignOutButton({ label, pendingLabel }: { label: string; pendingLabel: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="secondary" isDisabled={pending}>
      {pending ? pendingLabel : label}
    </Button>
  );
}
