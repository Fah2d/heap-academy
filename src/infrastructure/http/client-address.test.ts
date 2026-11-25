import { describe, expect, it } from "vitest";
import { clientAddress, UNKNOWN_CLIENT } from "./client-address";

describe("clientAddress", () => {
  it("[T-14] takes the platform's address from x-real-ip", () => {
    expect(clientAddress(new Headers({ "x-real-ip": "203.0.113.7" }))).toBe("203.0.113.7");
    expect(clientAddress(new Headers({ "x-real-ip": " 2001:DB8::1 " }))).toBe("2001:db8::1");
  });

  it("[T-14] a forwarding header the client sets does not change the key", () => {
    const platform = { "x-real-ip": "203.0.113.7" };
    for (const spoofed of [
      { "x-forwarded-for": "192.0.2.1" },
      { "x-forwarded-for": "192.0.2.1, 203.0.113.7" },
      { forwarded: "for=192.0.2.1" },
      { "x-vercel-forwarded-for": "192.0.2.1" },
      { "cf-connecting-ip": "192.0.2.1" },
      { "x-client-ip": "192.0.2.1" },
    ]) {
      expect(clientAddress(new Headers({ ...platform, ...spoofed }))).toBe("203.0.113.7");
      expect(clientAddress(new Headers(spoofed))).toBe(UNKNOWN_CLIENT);
    }
  });

  it("[T-14] treats a missing or malformed address as unknown", () => {
    expect(clientAddress(new Headers())).toBe(UNKNOWN_CLIENT);
    expect(clientAddress(new Headers({ "x-real-ip": "" }))).toBe(UNKNOWN_CLIENT);
    expect(clientAddress(new Headers({ "x-real-ip": "203.0.113.7, 192.0.2.1" }))).toBe(
      UNKNOWN_CLIENT,
    );
    expect(clientAddress(new Headers({ "x-real-ip": "not-an-address" }))).toBe(UNKNOWN_CLIENT);
    expect(clientAddress(new Headers({ "x-real-ip": "1".repeat(46) }))).toBe(UNKNOWN_CLIENT);
  });
});
