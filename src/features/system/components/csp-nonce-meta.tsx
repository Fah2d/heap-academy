import { requestNonce } from "@/infrastructure/http/nonce";

/**
 * React Aria adds one style element of its own at run time, for the elements
 * that take presses, and reads its nonce from this element; without it the
 * style policy blocks that style (docs/spec/06-security-privacy.md section 5).
 * The nonce goes in the nonce attribute only: the browser hides that one from
 * the page's markup, where a content attribute could be read.
 */
export async function CspNonceMeta() {
  const nonce = await requestNonce();
  if (nonce === "") return null;
  return <meta property="csp-nonce" nonce={nonce} />;
}
