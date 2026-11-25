import "server-only";
import { headers } from "next/headers";
import type { Identity } from "@/domain/auth/identity";
import { createSessionClient } from "@/infrastructure/db/session-client";
import { AUTH_UNAVAILABLE_HEADER } from "./session-refresh";
import { verifiedIdentity } from "./verified-identity";

/**
 * The visitor of a page (a server component), from verified claims. When
 * proxy.ts found the auth service slow or down, the visitor counts as signed
 * out at once (02-architecture.md section 11.1).
 */
export async function pageIdentity(): Promise<Identity | null> {
  if ((await headers()).get(AUTH_UNAVAILABLE_HEADER) === "1") return null;
  return verifiedIdentity(await createSessionClient("read-only"));
}
