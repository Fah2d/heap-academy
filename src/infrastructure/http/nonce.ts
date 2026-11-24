import "server-only";
import { headers } from "next/headers";
import { nonceFromPolicy } from "./security-headers";

/**
 * This request's nonce, which proxy.ts put in the policy on the request
 * (ADR-0028). A client component that adds style elements at run time, such
 * as the code editor, is given it as a prop (02-architecture.md section 14,
 * item 12). Empty when the policy is missing, so the styles stay blocked.
 */
export async function requestNonce(): Promise<string> {
  return nonceFromPolicy((await headers()).get("content-security-policy")) ?? "";
}
