// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { documentNonce } from "./code-editor";

// The editor's style elements are checked against the policy the document
// was loaded with (ADR-0028), so the editor takes that load's nonce.

afterEach(() => {
  document.head.replaceChildren();
  document.body.replaceChildren();
});

function script(nonce: string) {
  const element = document.createElement("script");
  element.setAttribute("nonce", nonce);
  document.head.append(element);
}

describe("documentNonce [NFR-SEC-02]", () => {
  it("takes the nonce of the document's own scripts over a newer one from the server", () => {
    script("bG9hZA==");
    expect(documentNonce(document, "bmV4dA==")).toBe("bG9hZA==");
  });

  it("skips a script whose nonce is empty", () => {
    script("");
    script("bG9hZA==");
    expect(documentNonce(document, "bmV4dA==")).toBe("bG9hZA==");
  });

  it("uses the server's nonce when no script carries one", () => {
    document.head.append(document.createElement("script"));
    expect(documentNonce(document, "bmV4dA==")).toBe("bmV4dA==");
  });
});
