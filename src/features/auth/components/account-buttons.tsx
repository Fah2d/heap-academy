"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { useFormStatus } from "react-dom";
import { deviceProgress } from "@/features/progress";
import { Button, Link } from "@/ui";

const SIGN_IN = "/sign-in";

/**
 * "Sign in", carrying the page the visitor is on, so sign-in returns there
 * (FR-AUTH-04). Loads in full so the sign-in page gets its own policy
 * (FR-AUTH-06); every link to sign-in should be this one. On the sign-in page
 * the policy is already there, and a reload would lose the form.
 */
export function SignInLink({ label }: { label: string }) {
  const pathname = usePathname();
  const query = useSearchParams().toString();
  const current = pathname === SIGN_IN;
  const returnTo = query === "" ? pathname : `${pathname}?${query}`;
  const href = current ? SIGN_IN : `${SIGN_IN}?${new URLSearchParams({ returnTo })}`;
  return (
    <Link href={href} variant="nav" current={current} fullLoad={!current}>
      {label}
    </Link>
  );
}

/**
 * Signing out also forgets the completions on this device, so the next account
 * here does not take them as its own (the owner's decision of 2026-11-24).
 */
export function SignOutButton({ label, pendingLabel }: { label: string; pendingLabel: string }) {
  const { pending } = useFormStatus();
  return (
    <Button
      type="submit"
      variant="secondary"
      isDisabled={pending}
      onPress={() => void deviceProgress().clear()}
    >
      {pending ? pendingLabel : label}
    </Button>
  );
}
