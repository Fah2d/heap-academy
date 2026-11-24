import { type GradableContent, gradableText } from "@/grader/test-case-list";

// The hash of a lesson's gradable content (docs/spec/04-content-system.md
// section 4.2). The dashboard sends the hash of what it validated; the save
// action hashes what it is about to save and reports the lesson validated
// only when the two are equal. Both sides call this one function, with the
// Web Crypto digest that browsers and Node share.

export const GRADABLE_HASH = /^[0-9a-f]{64}$/;

export async function gradableHash(content: GradableContent): Promise<string> {
  const bytes = new TextEncoder().encode(gradableText(content));
  const digest = await globalThis.crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}
