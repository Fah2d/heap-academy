import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { detectInAppBrowser } from "@/domain/auth/in-app-browser";
import { safeReturnPath } from "@/domain/auth/return-path";
import { pageIdentity } from "@/infrastructure/auth/page-identity";
import { parsePublicEnvironment } from "@/infrastructure/env/schema";
import { requestEmailCode, startGoogleSignIn, verifyEmailCode } from "../server/actions";
import { SIGN_IN_FAILED_GOOGLE } from "../server/google";
import { SignInView } from "./sign-in-view";

type SearchParams = Record<string, string | string[] | undefined>;

function single(value: string | string[] | undefined): string | undefined {
  return typeof value === "string" ? value : undefined;
}

/**
 * `/sign-in` (docs/spec/03-experience.md section 5.4). A visitor who is
 * already signed in goes straight to the return path.
 */
export async function SignInPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams;
  const returnTo = safeReturnPath(single(params["returnTo"]));
  if ((await pageIdentity()) !== null) {
    redirect(returnTo);
  }
  const userAgent = (await headers()).get("user-agent");
  const environment = parsePublicEnvironment(process.env);
  return (
    <SignInView
      returnTo={returnTo}
      inAppBrowser={detectInAppBrowser(userAgent) !== null}
      googleFailed={single(params["failed"]) === SIGN_IN_FAILED_GOOGLE}
      challengeSiteKey={environment.NEXT_PUBLIC_TURNSTILE_SITE_KEY}
      actions={{ requestEmailCode, verifyEmailCode, startGoogleSignIn }}
    />
  );
}
