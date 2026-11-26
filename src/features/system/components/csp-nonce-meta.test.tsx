import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

const request = vi.hoisted(() => ({ nonce: "" }));
vi.mock("@/infrastructure/http/nonce", () => ({
  requestNonce: () => Promise.resolve(request.nonce),
}));

import { CspNonceMeta } from "./csp-nonce-meta";

// React Aria adds a style element of its own at run time and takes its nonce
// from this element, or the policy blocks the style (NFR-SEC-02).

describe("CspNonceMeta", () => {
  it("[NFR-SEC-02] gives the request's nonce in the nonce attribute only", async () => {
    request.nonce = "bG9hZA==";
    const markup = renderToStaticMarkup(await CspNonceMeta());
    expect(markup).toBe('<meta property="csp-nonce" nonce="bG9hZA=="/>');
  });

  it("[NFR-SEC-02] renders nothing when the request has no nonce", async () => {
    request.nonce = "";
    expect(await CspNonceMeta()).toBeNull();
  });
});
