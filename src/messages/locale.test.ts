import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { documentAttributes, LOCALE } from "./locale";

describe("document language and direction", () => {
  it("[NFR-I18N-03] derives the language and the direction from the one locale setting", () => {
    expect(documentAttributes(LOCALE)).toEqual({ lang: "en", dir: "ltr" });
  });

  it("[NFR-I18N-03] sets right to left for Arabic, the likely second locale", () => {
    expect(documentAttributes("ar")).toEqual({ lang: "ar", dir: "rtl" });
  });

  it("[NFR-I18N-03] keeps code left to right whatever the interface direction", () => {
    const base = readFileSync(new URL("../ui/base.css", import.meta.url), "utf8");
    const rule = /code,\s*kbd,\s*pre,\s*samp\s*\{([^}]*)\}/.exec(base);
    expect(rule?.[1]).toContain("direction: ltr;");
  });
});
