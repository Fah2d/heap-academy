import { expect, test } from "@playwright/test";
import {
  IMMUTABLE,
  RUNTIME_STATIC_POLICY,
  workerContentSecurityPolicy,
} from "../src/infrastructure/http/security-headers";
import { RUNTIME_ASSET_BASE_URL, runtimeAssetBase, WORKER_URL } from "../src/runtime/assets";
import { RUNTIME_FILES } from "../scripts/build-runtime.mjs";

// The runtime's response headers on the production server, where the page
// policy has no 'unsafe-eval' (06-security-privacy.md section 5.1, ADR-0033).
// The runtime itself is exercised in e2e/runtime.spec.ts.

test.describe("runtime headers on the production server", () => {
  test("[T-01] the worker script carries its own policy and is revalidated", async ({
    request,
  }) => {
    const response = await request.get(WORKER_URL);
    expect(response.status()).toBe(200);
    expect(response.headers()["content-security-policy"]).toBe(
      workerContentSecurityPolicy(RUNTIME_ASSET_BASE_URL),
    );
    expect(response.headers()["cache-control"]).toBe("no-cache");
    expect(response.headers()["content-type"]).toMatch(/javascript/);
  });

  test("[FR-RUN-07] every runtime file is immutable, nosniff, and of a type a browser accepts", async ({
    request,
  }) => {
    for (const name of [...RUNTIME_FILES, "manifest.json"]) {
      const response = await request.get(`${runtimeAssetBase}${name}`);
      expect(response.status(), name).toBe(200);
      expect(response.headers()["cache-control"], name).toBe(IMMUTABLE);
      expect(response.headers()["x-content-type-options"], name).toBe("nosniff");
      if (name.endsWith(".mjs"))
        expect(response.headers()["content-type"], name).toMatch(/javascript/);
      if (name.endsWith(".wasm"))
        expect(response.headers()["content-type"], name).toMatch(/^application\/wasm/);
    }
  });

  test("[T-15] a miss under the runtime's path still carries a policy that forbids framing", async ({
    request,
  }) => {
    const response = await request.get("/_runtime/no-such-file");
    expect(response.status()).toBe(404);
    expect(response.headers()["content-security-policy"]).toBe(RUNTIME_STATIC_POLICY);
  });

  test("[NFR-SEC-02] the page policy has no wasm-unsafe-eval and no unsafe-eval", async ({
    request,
  }) => {
    const response = await request.get("/");
    const policy = response.headers()["content-security-policy"] ?? "";
    expect(policy).toContain("script-src");
    expect(policy).not.toContain("wasm-unsafe-eval");
    expect(policy).not.toContain("'unsafe-eval'");
  });
});
