import type { Metadata } from "next";
import { SignInPage } from "@/features/auth";
import { signIn } from "@/messages/sign-in";

export const metadata: Metadata = {
  title: signIn.title,
  // Sign-in is never a search result (FR-SEO-01).
  robots: { index: false, follow: false },
};

export default function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return <SignInPage searchParams={searchParams} />;
}
