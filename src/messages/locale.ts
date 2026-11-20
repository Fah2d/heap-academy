// The one setting for the interface language (ADR-0016, NFR-I18N-03). The
// document's `lang` and `dir` come from it; nothing else names a language.
export type Locale = "en" | "ar";

export const LOCALE: Locale = "en";

const DIRECTIONS = { en: "ltr", ar: "rtl" } as const satisfies Record<Locale, "ltr" | "rtl">;

export function documentAttributes(locale: Locale): { lang: Locale; dir: "ltr" | "rtl" } {
  return { lang: locale, dir: DIRECTIONS[locale] };
}
