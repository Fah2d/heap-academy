import "server-only";
import { isIP } from "node:net";

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

/** The eight groups of an IPv6 address, as numbers. */
function ipv6Groups(address: string): number[] {
  let text = address;
  const tail = /(\d+)\.(\d+)\.(\d+)\.(\d+)$/.exec(text);
  if (tail !== null) {
    const [a, b, c, d] = tail.slice(1).map(Number) as [number, number, number, number];
    text = `${text.slice(0, tail.index)}${((a << 8) | b).toString(16)}:${((c << 8) | d).toString(16)}`;
  }
  const [head = "", rest] = text.split("::");
  const front = head === "" ? [] : head.split(":");
  const back = rest === undefined || rest === "" ? [] : rest.split(":");
  const middle = new Array<string>(8 - front.length - back.length).fill("0");
  return [...front, ...(rest === undefined ? [] : middle), ...back].map((group) =>
    Number.parseInt(group, 16),
  );
}

/**
 * The platform's address of the caller, or `unknown` when it is absent or
 * not an IP address. An IPv6 address counts by its /64 prefix, the block one
 * subscriber or one server is given, so stepping through a block does not
 * escape the limit. An IPv4 address mapped into IPv6 counts as itself.
 */
export function clientAddress(headers: Pick<Headers, "get">): string {
  const value = headers.get(CLIENT_ADDRESS_HEADER)?.trim() ?? "";
  const kind = isIP(value);
  if (kind === 4) return value;
  if (kind !== 6 || value.includes("%")) return UNKNOWN_CLIENT;
  const groups = ipv6Groups(value.toLowerCase());
  if (groups.slice(0, 5).every((group) => group === 0) && groups[5] === 0xffff) {
    const [high = 0, low = 0] = groups.slice(6);
    return [high >> 8, high & 0xff, low >> 8, low & 0xff].join(".");
  }
  return `${groups
    .slice(0, 4)
    .map((group) => group.toString(16))
    .join(":")}::/64`;
}
