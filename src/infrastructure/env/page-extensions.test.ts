import { describe, expect, it } from "vitest";
import { pageExtensions } from "./page-extensions";

describe("pageExtensions [WP-3.4]", () => {
  it("gives the development server every page", () => {
    expect(pageExtensions(true, undefined)).toEqual([
      "dev.tsx",
      "preview.tsx",
      "tsx",
      "ts",
      "jsx",
      "js",
    ]);
  });

  it("adds preview pages to a Vercel preview build only", () => {
    expect(pageExtensions(false, "preview")).toEqual(["preview.tsx", "tsx", "ts", "jsx", "js"]);
  });

  it.each([undefined, "production", "development", "Preview", "preview ", "", 1])(
    "builds the production set for %j",
    (value) => {
      const extensions = pageExtensions(false, value);
      expect(extensions).toEqual(["tsx", "ts", "jsx", "js"]);
      expect(extensions.some((extension) => extension.includes("."))).toBe(false);
    },
  );
});
