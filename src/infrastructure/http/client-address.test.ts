import { describe, expect, it, vi } from "vitest";
import { clientAddress, UNKNOWN_CLIENT } from "./client-address";

vi.mock("server-only", () => ({}));

const of = (value: string) => clientAddress(new Headers({ "x-real-ip": value }));

describe("clientAddress", () => {
  it("[T-14] takes the platform's IPv4 address from x-real-ip", () => {
    expect(of("203.0.113.7")).toBe("203.0.113.7");
    expect(of(" 203.0.113.7 ")).toBe("203.0.113.7");
  });

  it("[T-14] counts an IPv6 address by its /64 prefix, however it is written", () => {
    expect(of("2001:DB8::1")).toBe("2001:db8:0:0::/64");
    expect(of("2001:db8:0:0:ffff:ffff:ffff:ffff")).toBe("2001:db8:0:0::/64");
    expect(of("2001:db8:0:0:1::")).toBe("2001:db8:0:0::/64");
    expect(of("2001:db8:aa:bb:cc:dd:ee:ff")).toBe("2001:db8:aa:bb::/64");
    expect(of("2001:db8:aa:bc::1")).toBe("2001:db8:aa:bc::/64");
    expect(of("::1")).toBe("0:0:0:0::/64");
    expect(of("64:ff9b::192.0.2.1")).toBe("64:ff9b:0:0::/64");
  });

  it("[T-14] counts an IPv4 address mapped into IPv6 as the IPv4 address", () => {
    expect(of("::ffff:203.0.113.7")).toBe("203.0.113.7");
    expect(of("::ffff:cb00:7107")).toBe("203.0.113.7");
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

  it("[T-14] treats a missing value, or anything but one IP address, as unknown", () => {
    expect(clientAddress(new Headers())).toBe(UNKNOWN_CLIENT);
    for (const value of [
      "",
      "203.0.113.7, 192.0.2.1",
      "not-an-address",
      "::::",
      "...",
      "999.1.1.1",
      "fe80::1%eth0",
      "1".repeat(46),
    ]) {
      expect(of(value)).toBe(UNKNOWN_CLIENT);
    }
  });
});
