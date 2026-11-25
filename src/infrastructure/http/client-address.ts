// The caller's network address, for the per-action counters of T-14
// (docs/spec/06-security-privacy.md section 4, docs/spec/07-operations.md
// section 7). On Vercel it is `x-real-ip`, the header Vercel's own
// `ipAddress()` helper reads (`@vercel/functions` 3.11.3); Vercel documents
// it as identical to `x-forwarded-for`, which it overwrites so a client cannot
// choose it. No other forwarding header is read, so one a client adds
// (`x-forwarded-for` behind another proxy, `forwarded`, `cf-connecting-ip`)
// never changes the key.
export const CLIENT_ADDRESS_HEADER = "x-real-ip";

/** The key for a request with no usable address, such as one on the local machine. */
export const UNKNOWN_CLIENT = "unknown";

// An IPv4 or IPv6 address in text form: hex digits, dots and colons, at most
// 45 characters (an IPv6 address with an IPv4 tail).
const ADDRESS = /^[0-9A-Fa-f.:]{2,45}$/;

/** The platform's address of the caller, or `unknown` when it is absent or malformed. */
export function clientAddress(headers: Pick<Headers, "get">): string {
  const value = headers.get(CLIENT_ADDRESS_HEADER)?.trim();
  return value !== undefined && ADDRESS.test(value) ? value.toLowerCase() : UNKNOWN_CLIENT;
}
