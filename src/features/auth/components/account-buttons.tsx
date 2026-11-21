"use client";

import { usePathname } from "next/navigation";
import { useFormStatus } from "react-dom";
import { Button, Link } from "@/ui";

const SIGN_IN = "/sign-in";

/** "Sign in", carrying the page the visitor is on, so sign-in returns there (FR-AUTH-04). */
export function SignInLink({ label }: { label: string }) {
  const pathname = usePathname();
  const current = pathname === SIGN_IN;
  const href = current ? SIGN_IN : `${SIGN_IN}?${new URLSearchParams({ returnTo: pathname })}`;
  return (
    <Link href={href} variant="nav" current={current}>
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
