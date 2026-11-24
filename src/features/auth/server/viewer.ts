import "server-only";
import { cache } from "react";
import { pageIdentity } from "@/infrastructure/auth/page-identity";

/** The page's visitor from verified claims, read once per request however many parts ask. */
export const viewer = cache(pageIdentity);

/** Whether the page's visitor is signed in (02-architecture.md section 11). */
export async function isSignedIn(): Promise<boolean> {
  return (await viewer()) !== null;
}
